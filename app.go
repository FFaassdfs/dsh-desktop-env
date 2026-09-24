package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	// dshPort 选择固定高位端口，避开 Windows 动态端口范围（本机 1024~15000）
	// 以及 Hyper-V/WSL/winnat 会动态保留的排除端口段。
	dshPort     = "43080"
	dshHost     = "127.0.0.1"
	dshAddr     = dshHost + ":" + dshPort
	dshURL      = "http://" + dshAddr
	waitTimeout = 30 * time.Second
	// 首次启动（便携包要先解压 runtime.zip）+ 干净机器上的杀毒扫描会让 dsh web
	// 迟迟不 ready，30 秒明显不够；waitReady 一旦就绪就立刻返回，所以放宽上限是无害的。
	firstRunTimeout = 150 * time.Second
	// 等待期间每这么久回报一次进度，避免"看起来卡死"。
	waitSlice      = 10 * time.Second
	pollInterval   = 300 * time.Millisecond
	updateInterval = 24 * time.Hour

	// 日志上限：超过就轮转成 "<name>.1"，避免壳长期运行时日志无限增长。
	maxDshLogBytes   = 5 << 20 // dsh.log：5 MiB
	maxDebugLogBytes = 1 << 20 // debug.log：1 MiB
	// 报错时从文件尾最多读这么多字节（不再整文件读入内存）。
	tailReadBytes = 64 << 10 // 64 KiB
	tailLines     = 20

	// 崩溃自愈：连续自动重启的间隔按 3 倍退避（15s → 45s → 120s 封顶），
	// 连续 maxRestarts 次仍起不来就停下交给用户；一旦稳定运行
	// stableResetPeriod 就把计数清零，避免偶发崩溃累计耗尽预算。
	monitorInterval    = 5 * time.Second
	maxRestarts        = 3
	restartBackoffBase = 15 * time.Second
	restartBackoffMax  = 2 * time.Minute
	stableResetPeriod  = 5 * time.Minute
)

type App struct {
	ctx          context.Context
	winCtx       context.Context
	cmd          *exec.Cmd
	owns         bool
	mu           sync.Mutex
	booting      bool
	booted       bool
	bootedAt     time.Time
	webURL       string
	update       string
	exited       bool
	exitErr      error
	restarts     int
	monitorOn    bool
	runtimeReady chan struct{}

	// registry 文档缓存（见 version.go 的 registryCached）：面板可能被反复打开。
	registryMu sync.Mutex
	registry   *registryDoc
	registryAt time.Time

	// 首次启动解压内置运行时（runtime.zip）的结果，供 bootstrap 报准错误。
	runtimeErr  error
	runtimeSync runtimeSyncResult
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// A portable package may still carry its runtime as the single file
	// runtime.zip (fast to download/copy). Unpack it before anything tries to
	// resolve or update the harness.
	a.runtimeReady = make(chan struct{})
	go func() {
		defer close(a.runtimeReady)
		a.ensureRuntimeExtracted()
	}()
	go a.checkUpdatesLoop()
}

// ensureRuntimeExtracted unpacks (or refreshes) the package runtime on start.
func (a *App) ensureRuntimeExtracted() {
	pkgRoot := executableDir()
	if pkgRoot == "" {
		return
	}
	if !fileExists(runtimeArchivePath(pkgRoot)) {
		return
	}
	start := time.Now()
	result, err := syncRuntimeFromArchive(pkgRoot, runtimeNodeName(), func(done, total int) {
		if total > 0 && done%2000 == 0 {
			a.emitUpdate(fmt.Sprintf("正在解压内置运行时… %d/%d", done, total))
		}
	})
	if err != nil {
		debugLog("ensureRuntimeExtracted: failed: %v", err)
		a.mu.Lock()
		a.runtimeErr = err
		a.mu.Unlock()
		a.emitUpdate("内置运行时解压失败：" + err.Error())
		return
	}
	a.mu.Lock()
	a.runtimeSync = result
	a.mu.Unlock()
	elapsed := time.Since(start).Round(time.Second)
	switch result {
	case runtimeSyncExtracted:
		debugLog("ensureRuntimeExtracted: unpacked in %s", elapsed)
		a.emitUpdate(fmt.Sprintf("内置运行时已就绪（首次解压耗时 %s）", elapsed))
	case runtimeSyncUpgraded:
		debugLog("ensureRuntimeExtracted: refreshed from the package in %s", elapsed)
		a.emitUpdate(fmt.Sprintf("内置运行时已按发行包更新（耗时 %s）", elapsed))
	default:
		debugLog("ensureRuntimeExtracted: unpacked runtime is current")
	}
}

func (a *App) domReady(ctx context.Context) {
	a.winCtx = ctx
	a.startBootstrap(ctx)
}

// debugLog appends a diagnostic line to the dsh-desktop debug log so the
// bootstrap path can be inspected without a visible console. The file is
// rotated once it passes maxDebugLogBytes.
func debugLog(format string, args ...interface{}) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return
	}
	path := filepath.Join(dir, "dsh-desktop", "debug.log")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	_ = rotateIfTooBig(path, maxDebugLogBytes)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, format+"\n", args...)
}

func (a *App) startBootstrap(ctx context.Context) {
	a.mu.Lock()
	if a.booting || a.booted {
		a.mu.Unlock()
		return
	}
	a.booting = true
	a.mu.Unlock()
	go a.bootstrap(ctx)
}

func (a *App) bootstrap(ctx context.Context) {
	defer func() {
		a.mu.Lock()
		a.booting = false
		a.mu.Unlock()
	}()

	// First start may have to unpack the bundled runtime archive.
	if a.runtimeReady != nil {
		<-a.runtimeReady
	}

	// A staged portable self-update is applied here, before anything runs.
	a.applyPendingRuntimeUpdate()

	// 解压失败必须在这里就说清楚：否则后面会退化成"请确认已安装 npm i -g …"这种
	// 误导性提示（干净机器上根本没装全局 dsh，用户会去装一个不必要的东西）。
	a.mu.Lock()
	runtimeErr := a.runtimeErr
	runtimeSync := a.runtimeSync
	a.mu.Unlock()
	if runtimeErr != nil {
		debugLog("bootstrap: bundled runtime unpack failed: %v", runtimeErr)
		a.fail(ctx, "内置运行时解压失败，无法启动：\n\n"+runtimeErr.Error()+
			"\n\n可尝试：① 把发行包解压到较短、可写的路径（如 D:\\dsh-desktop）后重试；"+
			"② 手动把包内 runtime.zip 解压到 exe 同级的 runtime\\ 目录；③ 检查磁盘空间与杀毒软件拦截。")
		return
	}

	// 便携包先用内置 node 自证可运行：干净/受管机器上它可能被策略或杀软拦下，
	// 那种情况下后面所有报错都会跑偏，不如在这里给出原始错误。
	rt, portable := bundledRuntimeInUse()
	if portable {
		if err := probeRuntimeNode(rt.NodeExe); err != nil {
			debugLog("bootstrap: bundled node unusable: %v", err)
			a.fail(ctx, "内置 Node 无法运行，DeepSeek Harness 起不来：\n\n"+err.Error()+
				"\n\n请把 "+filepath.Dir(rt.NodeExe)+" 加入杀毒/应用控制策略白名单后重试。")
			return
		}
	}

	a.emitStatus("正在启动 DeepSeek Harness…")
	if !a.portOpen() {
		debugLog("bootstrap: port %s closed, spawning dsh web", dshPort)
		if err := a.startDsh(); err != nil {
			debugLog("bootstrap: startDsh failed: %v", err)
			a.fail(ctx, "无法启动 DeepSeek Harness：\n\n"+err.Error()+
				"\n\n若这不是便携包，请确认已安装：npm i -g @deepseek-ai/dsh")
			return
		}
		a.owns = true
	} else {
		debugLog("bootstrap: port %s already open, adopting existing instance", dshPort)
	}

	// 首次启动（刚解压完）+ 便携包给更宽的上限：就绪即返回，放宽只影响"多久才放弃"。
	timeout := waitTimeout
	if portable || runtimeSync == runtimeSyncExtracted {
		timeout = firstRunTimeout
	}
	startWait := time.Now()
	ready := false
	for time.Now().Before(startWait.Add(timeout)) {
		slice := waitSlice
		if left := time.Until(startWait.Add(timeout)); left < slice {
			slice = left
		}
		if a.waitReady(slice) {
			ready = true
			break
		}
		if exited, _ := a.childExited(); exited {
			break
		}
		a.emitStatus(fmt.Sprintf("正在启动 DeepSeek Harness…（已等待 %d 秒）", int(time.Since(startWait).Seconds())))
	}
	if !ready {
		waited := time.Since(startWait).Round(time.Second)
		if exited, _ := a.childExited(); exited {
			debugLog("bootstrap: dsh web exited before ready")
			a.fail(ctx, fmt.Sprintf("DeepSeek Harness 启动失败，进程已退出（等待 %s）：\n\n", waited)+
				a.tailDshLog()+"\n\n完整日志："+dshLogPath())
		} else if !a.owns {
			debugLog("bootstrap: waitReady timed out on an adopted listener")
			a.fail(ctx, fmt.Sprintf("端口 %s 上已有程序在监听，但它不像 dsh web 那样响应（等待 %s 超时）。\n\n"+
				"可能是别的程序占用了该端口，或上一次的 dsh 实例卡住了：请结束占用进程后重试。\n\n地址: %s",
				dshPort, waited, dshURL))
		} else {
			debugLog("bootstrap: waitReady timed out")
			a.fail(ctx, fmt.Sprintf("等待 DeepSeek Harness 启动超时（%s）\n\n请检查: %s\n\n日志: %s",
				waited, dshURL, dshLogPath()))
		}
		return
	}
	if a.owns {
		if a.waitForURL(waitTimeout) {
			debugLog("bootstrap: authenticated URL captured")
		} else {
			debugLog("bootstrap: waitForURL timed out (no token URL captured)")
		}
	}
	target := a.authenticatedURL()
	if target == "" {
		target = dshURL
		debugLog("bootstrap: no token URL, falling back to bare URL")
	}
	a.mu.Lock()
	a.booted = true
	a.bootedAt = time.Now()
	a.mu.Unlock()
	debugLog("bootstrap: ready")
	if rt, ok := bundledRuntimeInUse(); ok {
		// The new runtime proved itself by starting: drop the rollback copy.
		cleanupRuntimeBackup(rt.Root)
	}
	a.emitStatus("DeepSeek Harness 已启动")
	a.emitURL(target)
	runtime.BrowserOpenURL(ctx, target)

	a.mu.Lock()
	startMonitor := a.owns && !a.monitorOn
	if startMonitor {
		a.monitorOn = true
	}
	a.mu.Unlock()
	if startMonitor {
		go a.healthMonitor()
	}
}

func (a *App) portOpen() bool {
	conn, err := net.DialTimeout("tcp", dshAddr, 800*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// waitReady reports whether the dsh web server is reachable. Since current dsh
// versions answer the bare root URL with 401 (browser-trust fence) until the
// launch token redeems a session cookie, any HTTP response counts as "up".
func (a *App) waitReady(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 2 * time.Second}
	for time.Now().Before(deadline) {
		if a.owns {
			if exited, _ := a.childExited(); exited {
				return false
			}
		}
		resp, err := client.Get(dshURL)
		if err == nil {
			resp.Body.Close()
			return true
		}
		time.Sleep(pollInterval)
	}
	return false
}

func (a *App) setAuthenticatedURL(url string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if url != "" {
		a.webURL = url
	}
}

func (a *App) authenticatedURL() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.webURL
}

// waitForURL waits until dsh web has printed its authenticated root URL.
func (a *App) waitForURL(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if a.authenticatedURL() != "" {
			return true
		}
		time.Sleep(pollInterval)
	}
	return a.authenticatedURL() != ""
}

// scanMainOutput watches dsh web's stdout for the printed authenticated URL
// ("dsh web: http://127.0.0.1:<port>/?token=...") and remembers it so the shell
// can hand that URL to the system browser.
func (a *App) scanMainOutput(output io.Reader) {
	scanner := bufio.NewScanner(output)
	for scanner.Scan() {
		line := scanner.Text()
		if idx := strings.Index(line, "dsh web:"); idx >= 0 {
			rest := strings.TrimSpace(line[idx+len("dsh web:"):])
			if fields := strings.Fields(rest); len(fields) > 0 && strings.HasPrefix(fields[0], "http") {
				debugLog("scanMainOutput: captured authenticated URL")
				a.setAuthenticatedURL(fields[0])
			}
		}
	}
}

// childExited reports whether the currently-owned dsh web process has exited,
// together with its exit error (nil for a clean exit).
func (a *App) childExited() (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.exited, a.exitErr
}

// dshLogPath is where dsh web's stdout/stderr is captured; the path is shown in
// startup failures so the user can hand over the log without hunting for it.
func dshLogPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "(日志目录不可用)"
	}
	return filepath.Join(dir, "dsh-desktop", "dsh.log")
}

// hmrFaultSignature 是"内置核心过旧导致启动即崩"的日志签名。
//
// 2026-09-24 事故（用户报告「整个本地 harness 全崩溃」）：便携包内置
// harness 0.1.5-rc.2 在 profile 存在**用户 patch 层**（cordis.patch.yml 有内容，
// 即装了插件）时，dsh web 启动即抛下面这条错误并退出；壳只报"服务反复启动
// 失败"+日志尾部，用户看到的是天书，不知道该做什么。
//
//	Error: dsh: user patch-layer watching requires the Cordis HMR service
//	    at watchUserPatches (.../dsh-app-boot/lib/index.js:1112:28)
//
// 上游 0.1.7-rc.1 起已修复（实测：同一 DSH_HOME 换成 0.1.7-rc.1 后正常启动）。
// 便携包**默认预装 6 个插件** ⇒ 必然命中，所以这不是罕见路径。
const hmrFaultSignature = "user patch-layer watching requires the Cordis HMR service"

// knownStartupFault 把"启动即崩"的已知签名翻成可操作的中文指引（无匹配返回 ""）。
//
// 为什么必须优先于"端口被占用"提示：在壳看来「一启动就退出」与「端口冲突」
// 长得一样，但两者的处理方式完全相反——端口冲突要用户去腾端口，而这个故障
// 要用户升级核心。误报会把用户引到错误的方向上。
func knownStartupFault(logTail string) string {
	if strings.Contains(logTail, hmrFaultSignature) {
		return "检测到已知的 harness 缺陷（内置核心版本过旧）：\n" +
			"当前内置核心在「已配置插件」时会因缺少 Cordis HMR 服务而启动即退出。\n" +
			"该问题在 0.1.7-rc.1 及以后已修复。\n\n" +
			"解决办法（任选其一）：\n" +
			"① 在状态面板「核心版本」里把核心更新到 0.1.7-rc.1 或更新，再点「重启服务」；\n" +
			"② 下载新版便携发行包，解压覆盖本目录；\n" +
			"③ 想先用起来：把 profiles\\web\\cordis.patch.yml 里的插件条目临时删掉。"
	}
	return ""
}

// probeRuntimeNode runs "<node> --version" so a bundled runtime that cannot
// execute at all (blocked by policy/antivirus, wrong architecture, ...) is
// reported as such, with the raw error, before dsh is even involved.
func probeRuntimeNode(nodeExe string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, nodeExe, "--version").CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s --version 失败：%w\n%s", nodeExe, err, firstLine(string(out)))
	}
	return nil
}

// tailDshLog returns the last few lines of dsh web's stderr log so a startup
// failure can surface the real cause (e.g. EACCES on a reserved port). It reads
// only the tail of the file, so a huge log cannot stall the error path.
func (a *App) tailDshLog() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	p := filepath.Join(dir, "dsh-desktop", "dsh.log")
	text, err := tailFile(p, tailReadBytes)
	if err != nil {
		return ""
	}
	return lastLines(text, tailLines)
}

// adoptSpawn records the started process and starts its output/exit watchers.
// The exit watcher only marks the process exited if it is still the current one,
// so a replaced (restarted) process never clobbers the new one's state.
func (a *App) adoptSpawn(cmd *exec.Cmd, stdout io.Reader) {
	a.mu.Lock()
	a.exited = false
	a.exitErr = nil
	a.cmd = cmd
	a.mu.Unlock()
	if stdout != nil {
		go a.scanMainOutput(stdout)
	}
	go func() {
		err := cmd.Wait()
		a.mu.Lock()
		if a.cmd == cmd {
			a.exited = true
			a.exitErr = err
		}
		a.mu.Unlock()
	}()
}

// restartBackoff returns the wait before the n-th consecutive auto-restart
// (n >= 1): 15s, 45s, then capped at 2m. Backoff keeps a persistently broken
// port (e.g. reserved by Hyper-V/WSL/winnat) from restarting in a tight loop.
func restartBackoff(n int) time.Duration {
	if n < 1 {
		n = 1
	}
	d := restartBackoffBase
	for i := 1; i < n; i++ {
		if d >= restartBackoffMax {
			return restartBackoffMax
		}
		d *= 3
	}
	if d > restartBackoffMax {
		return restartBackoffMax
	}
	return d
}

// healthMonitor watches the owned dsh web process. When it exits unexpectedly it
// restarts it with exponential backoff, up to maxRestarts consecutive attempts;
// that budget is cleared again after the service has stayed up for
// stableResetPeriod. Previously a failed auto-restart left the shell dormant
// (booted stayed false, so the monitor skipped forever) and a merely slow crash
// loop could burn the budget without backoff.
func (a *App) healthMonitor() {
	ticker := time.NewTicker(monitorInterval)
	defer ticker.Stop()
	for range ticker.C {
		a.mu.Lock()
		owns := a.owns
		booted := a.booted
		booting := a.booting
		restarts := a.restarts
		bootedAt := a.bootedAt
		a.mu.Unlock()
		if !owns || booting {
			continue
		}
		exited, _ := a.childExited()
		if !exited {
			// 进程还在：稳定运行足够久就把连续重启计数清零。
			if booted && restarts > 0 && !bootedAt.IsZero() && time.Since(bootedAt) >= stableResetPeriod {
				a.mu.Lock()
				a.restarts = 0
				a.mu.Unlock()
				debugLog("healthMonitor: stable for %s, restart budget reset", stableResetPeriod)
				a.emitStatus("服务已稳定运行，重启计数已重置")
			}
			continue
		}
		// 子进程已退出：掉线，或上一次自动重启的 bootstrap 没能就绪。
		a.mu.Lock()
		a.restarts++
		restarts = a.restarts
		a.mu.Unlock()
		if restarts > maxRestarts {
			a.emitStatus("服务反复启动失败，已停止自动重启")
			// 先认已知故障，再退回通用提示：两者在壳看来都是"进程一启动就退出"，
			// 但处理方式相反（升级核心 vs 腾端口），不能混为一谈。
			tail := a.tailDshLog()
			hint := knownStartupFault(tail)
			if hint == "" {
				hint = fmt.Sprintf("请检查端口 %s 是否被占用或系统保留（如 Hyper-V/WSL/winnat），然后点「重启服务」。", dshPort)
			}
			a.fail(a.winCtx, fmt.Sprintf("服务进程连续 %d 次自动重启仍失败，已停止自动重启。\n\n%s\n\n%s",
				maxRestarts, hint, tail))
			return
		}
		delay := restartBackoff(restarts)
		debugLog("healthMonitor: child exited, restart %d/%d in %s", restarts, maxRestarts, delay)
		a.emitStatus(fmt.Sprintf("服务掉线，%s 后自动重启（第 %d/%d 次）", delay, restarts, maxRestarts))
		time.Sleep(delay)
		// 退避期间用户可能已经手动重启，那就不要再插手。
		a.mu.Lock()
		stillOwned := a.owns
		nowBooting := a.booting
		a.mu.Unlock()
		if !stillOwned || nowBooting {
			continue
		}
		a.restartOwned()
	}
}

// ---- frontend events ----

func (a *App) emitStatus(s string) {
	if a.winCtx != nil {
		runtime.EventsEmit(a.winCtx, "dsh-status", s)
	}
}

func (a *App) emitURL(u string) {
	if a.winCtx != nil {
		runtime.EventsEmit(a.winCtx, "dsh-url", u)
	}
}

func (a *App) emitUpdate(s string) {
	a.mu.Lock()
	a.update = s
	a.mu.Unlock()
	if a.winCtx != nil {
		runtime.EventsEmit(a.winCtx, "dsh-update", s)
	}
}

func (a *App) fail(ctx context.Context, msg string) {
	runtime.EventsEmit(ctx, "dsh-error", msg)
}

// ---- bound methods (called from the status panel) ----

// Retry re-runs bootstrap after a startup failure. User-initiated, so the
// consecutive-restart budget is cleared first.
func (a *App) Retry() {
	a.mu.Lock()
	a.restarts = 0
	a.mu.Unlock()
	a.startBootstrap(a.winCtx)
}

// Restart restarts the owned dsh web process (picks up a freshly installed
// harness version) and re-bootstraps. User-initiated, so the restart budget is
// cleared first.
func (a *App) Restart() {
	a.mu.Lock()
	a.restarts = 0
	a.mu.Unlock()
	a.restartOwned()
}

// restartOwned kills the owned process (if any) and re-bootstraps. Kept separate
// from Restart so the health monitor can restart without clearing the budget it
// is accounting for.
func (a *App) restartOwned() {
	a.mu.Lock()
	a.booting = false
	a.booted = false
	a.bootedAt = time.Time{}
	a.webURL = ""
	cmd := a.cmd
	owns := a.owns
	a.cmd = nil
	a.owns = false
	a.mu.Unlock()
	if owns && cmd != nil && cmd.Process != nil {
		exec.Command("taskkill", "/F", "/T", "/PID", strconv.Itoa(cmd.Process.Pid)).Run()
	}
	a.startBootstrap(a.winCtx)
}

// OpenBrowser opens the captured URL (or the bare URL) in the system browser.
func (a *App) OpenBrowser() {
	u := a.authenticatedURL()
	if u == "" {
		u = dshURL
	}
	if a.ctx != nil {
		runtime.BrowserOpenURL(a.ctx, u)
	}
}

// Quit closes the application.
func (a *App) Quit() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
}

// GetUpdateStatus returns the last update-check status message.
func (a *App) GetUpdateStatus() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.update
}

// ---- 预置插件安装 ----

// HasPluginInstaller 报告本机是否有发行包自带的插件安装器。没有时面板隐藏入口
// （源码装的使用者自己跑命令更快，壳不去猜仓库在哪）。
func (a *App) HasPluginInstaller() bool {
	return installerPathForThisExe() != ""
}

// InstallBundledPlugins 启动发行包自带的安装器，把预置插件装进 $DSH_HOME。
//
// 刻意「只启动、不等待、不判断成败」：安装器自己有交互菜单与校验，壳再去解释它
// 的结果只会引入第二套可能不一致的判断逻辑（见 plugins_install.go 的说明）。
// 用户能看到弹出的窗口，装完自己决定要不要重启服务。
func (a *App) InstallBundledPlugins() string {
	path := installerPathForThisExe()
	if path == "" {
		return "本机没有找到插件安装器（install-offline.ps1）——只有便携发行包才带它。"
	}
	if err := a.startInstaller(path); err != nil {
		debugLog("InstallBundledPlugins: cannot start %s: %v", path, err)
		return "无法启动插件安装器：" + err.Error()
	}
	debugLog("InstallBundledPlugins: started %s", path)
	return "已打开插件安装器窗口，请按提示选择要装的插件。装好后建议重启服务，让它生效。"
}

// ---- version / update ----

func (a *App) installedVersion() string {
	// A portable release ships its own runtime next to the exe: read that first
	// so the panel reports the version actually being served.
	if rt, ok := bundledRuntimeInUse(); ok {
		if v := versionFromPackageJSON(rt.Package); v != "" {
			return v
		}
		debugLog("installedVersion: bundled runtime manifest unreadable: %s", rt.Package)
		return ""
	}

	shim, err := exec.LookPath("dsh.cmd")
	if err != nil {
		shim, err = exec.LookPath("dsh")
	}
	if err != nil {
		debugLog("installedVersion: dsh shim not found: %v", err)
		return ""
	}
	pkg := filepath.Join(filepath.Dir(shim), "node_modules", "@deepseek-ai", "dsh", "package.json")
	return versionFromPackageJSON(pkg)
}

// versionFromPackageJSON reads the "version" field of a dsh package manifest.
func versionFromPackageJSON(pkg string) string {
	data, err := os.ReadFile(pkg)
	if err != nil {
		debugLog("versionFromPackageJSON: cannot read %s: %v", pkg, err)
		return ""
	}
	var m struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		debugLog("versionFromPackageJSON: cannot parse %s: %v", pkg, err)
		return ""
	}
	return m.Version
}

// checkUpdates 只**提示**可用更新，绝不自动安装。
//
// 这里以前是 `installed == dist-tags.latest` 的字符串等值比较 + 静默 `npm i -g`，
// 那既看不到 `next`/`alpha` 上的新版本，也会把用户手动装的新版本降级回去。
// 现在按 semver 比较每个通道的最新版本，把决定权交给面板上的按钮（version.go）。
func (a *App) checkUpdates() {
	a.emitUpdate("正在检查更新…")
	installed := a.installedVersion()
	doc, err := a.registryCached()
	if err != nil {
		debugLog("checkUpdates: %v", err)
		a.emitUpdate("检查更新失败（网络不可用）")
		return
	}
	if installed == "" {
		a.emitUpdate("已安装版本未知，可在下方「核心版本」里手动选择")
		return
	}

	// 便携包：若已经下载好一个更新的版本在等重启，先把这件事说清楚。
	if rt, ok := bundledRuntimeInUse(); ok {
		staging := updateStagingDir(rt.Root)
		if staged, ok := stagedRuntimeIn(staging); ok {
			v := versionFromPackageJSON(staged.Package)
			if v != "" && compareDshVersions(v, installed) > 0 {
				a.emitUpdate("已下载核心 " + v + "，重启服务后生效")
				return
			}
			debugLog("checkUpdates: discarding stale staged runtime (installed %s, staged %s)", installed, v)
			_ = os.RemoveAll(staging)
		}
	}

	prefs := loadUpdatePrefs()
	newer := newerChannels(doc, installed, prefs.SkippedCore)
	if len(newer) == 0 {
		if prefs.SkippedCore != "" && compareDshVersions(prefs.SkippedCore, installed) > 0 {
			a.emitUpdate("当前 " + installed + "（已跳过 " + prefs.SkippedCore + "）")
			return
		}
		a.emitUpdate("已是最新（当前 " + installed + "）")
		return
	}
	parts := make([]string, 0, len(newer))
	for _, o := range newer {
		parts = append(parts, channelLabel(o.Channel)+" "+o.Version)
	}
	a.emitUpdate("有可用更新：" + strings.Join(parts, "、") + "（当前 " + installed + "）—— 在下方「核心版本」里选择")
}

// ---- portable (bundled runtime) update --------------------------------------

// 便携包的更新不再自动下载：UpdateCore(version)（见 version.go）在用户点按钮时调用
// stageBundledRuntime，把指定版本装进暂存目录；下次启动由 applyPendingRuntimeUpdate 换入。

// stageBundledRuntime installs @deepseek-ai/dsh@version into the staging prefix
// with the bundled npm, then verifies that the staged tree actually runs.
func (a *App) stageBundledRuntime(rt harnessRuntime, npmCLI, version string) error {
	staging := updateStagingDir(rt.Root)
	_ = os.RemoveAll(staging)
	if err := os.MkdirAll(staging, 0o755); err != nil {
		return fmt.Errorf("cannot create %s: %w", staging, err)
	}
	cmd := exec.Command(rt.NodeExe, npmCLI, "install",
		"--prefix", staging,
		"--no-audit", "--no-fund", "--loglevel=error",
		"@deepseek-ai/dsh@"+version)
	cmd.SysProcAttr = hiddenWindowAttr()
	cmd.Dir = staging
	cmd.Env = append(os.Environ(),
		"npm_config_cache="+filepath.Join(filepath.Dir(rt.Root), ".npm-cache"),
		"npm_config_update_notifier=false",
		"npm_config_fund=false",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("npm install %s failed: %v", version, firstLine(string(out)))
	}
	staged, ok := stagedRuntimeIn(staging)
	if !ok {
		return fmt.Errorf("staged tree is incomplete (no %s)", runtimeEntryRel)
	}
	if got := probeRuntimeVersion(rt.NodeExe, staged.Entry); got != version {
		return fmt.Errorf("staged runtime reports %q instead of %s", got, version)
	}
	return nil
}

// applyPendingRuntimeUpdate swaps a verified staged runtime into place. It runs
// before the harness is started, so the live runtime is never touched while dsh
// is running (Windows would refuse to replace those files anyway).
func (a *App) applyPendingRuntimeUpdate() {
	rt, ok := bundledRuntimeInUse()
	if !ok {
		return
	}
	staging := updateStagingDir(rt.Root)
	staged, ok := stagedRuntimeIn(staging)
	if !ok {
		return
	}
	want := versionFromPackageJSON(staged.Package)
	if got := probeRuntimeVersion(rt.NodeExe, staged.Entry); want == "" || got != want {
		debugLog("applyPendingRuntimeUpdate: staged runtime failed its probe, discarding")
		_ = os.RemoveAll(staging)
		return
	}
	// Never let a stale staged tree win over what is on disk: after someone
	// unzips a newer package over this folder, an older pending update may still
	// be lying around (it is not shipped in the zip, so it survives the copy).
	current := versionFromPackageJSON(rt.Package)
	if current != "" && compareDshVersions(want, current) <= 0 {
		debugLog("applyPendingRuntimeUpdate: staged %s is not newer than the runtime in place (%s), discarding", want, current)
		_ = os.RemoveAll(staging)
		return
	}
	rollback, err := swapRuntimeModules(rt.Root, staging)
	if err != nil {
		debugLog("applyPendingRuntimeUpdate: swap failed: %v", err)
		// 换入失败几乎总是因为 dsh 正在运行、runtime\node_modules 被占用
		//（Windows 不允许替换被打开的文件）。swapRuntimeModules 已把原树放回
		// 原处，这里只需丢弃暂存树——否则每次启动都会重试一次、日志反复刷同一条。
		_ = os.RemoveAll(staging)
		a.emitUpdate("内置运行时更新未生效（文件被占用），已放弃本次更新")
		return
	}
	if got := probeRuntimeVersion(rt.NodeExe, filepath.Join(rt.Root, runtimeEntryRel)); got != want {
		debugLog("applyPendingRuntimeUpdate: swapped runtime reports %q, want %s - rolling back", got, want)
		rollback()
		return
	}
	_ = os.RemoveAll(staging)
	debugLog("applyPendingRuntimeUpdate: applied harness %s", want)
	a.emitUpdate("内置运行时已更新到 " + want)
}

// probeRuntimeVersion runs `node <entry> --version` and returns the first output
// line ("" when the runtime cannot be loaded at all).
func probeRuntimeVersion(nodeExe, entry string) string {
	cmd := exec.Command(nodeExe, entry, "--version")
	cmd.SysProcAttr = hiddenWindowAttr()
	out, err := cmd.Output()
	if err != nil {
		debugLog("probeRuntimeVersion: %s failed: %v", entry, err)
		return ""
	}
	return firstLine(string(out))
}

// firstLine returns the first non-empty line, trimmed.
func firstLine(s string) string {
	for _, line := range strings.Split(s, "\n") {
		if t := strings.TrimSpace(line); t != "" {
			return t
		}
	}
	return ""
}

func (a *App) checkUpdatesLoop() {
	// Wait until the runtime is in place: a portable package that has not been
	// unpacked yet must not take the "global npm" update path.
	if a.runtimeReady != nil {
		<-a.runtimeReady
	}
	a.checkUpdates()
	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()
	for range ticker.C {
		a.checkUpdates()
	}
}

func (a *App) shutdown(ctx context.Context) {
	if a.owns && a.cmd != nil && a.cmd.Process != nil {
		exec.Command("taskkill", "/F", "/T", "/PID", strconv.Itoa(a.cmd.Process.Pid)).Run()
	}
}
