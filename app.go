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
	dshPort        = "43080"
	dshHost        = "127.0.0.1"
	dshAddr        = dshHost + ":" + dshPort
	dshURL         = "http://" + dshAddr
	waitTimeout    = 30 * time.Second
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
		a.emitUpdate("内置运行时解压失败：" + err.Error())
		return
	}
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

	a.emitStatus("正在启动 DeepSeek Harness…")
	if !a.portOpen() {
		debugLog("bootstrap: port %s closed, spawning dsh web", dshPort)
		if err := a.startDsh(); err != nil {
			debugLog("bootstrap: startDsh failed: %v", err)
			a.fail(ctx, "无法启动 DeepSeek Harness，请确认已安装：npm i -g @deepseek-ai/dsh\n\n"+err.Error())
			return
		}
		a.owns = true
	} else {
		debugLog("bootstrap: port %s already open, adopting existing instance", dshPort)
	}
	if !a.waitReady(waitTimeout) {
		if exited, _ := a.childExited(); exited {
			debugLog("bootstrap: dsh web exited before ready")
			a.fail(ctx, "DeepSeek Harness 启动失败，进程已退出：\n\n"+a.tailDshLog())
		} else {
			debugLog("bootstrap: waitReady timed out")
			a.fail(ctx, "等待 DeepSeek Harness 启动超时（30 秒）\n\n请检查: "+dshURL)
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
			a.fail(a.winCtx, fmt.Sprintf("服务进程连续 %d 次自动重启仍失败，已停止自动重启。\n请检查端口 %s 是否被占用或系统保留（如 Hyper-V/WSL/winnat），然后点「重启服务」。\n\n%s", maxRestarts, dshPort, a.tailDshLog()))
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

func (a *App) latestVersion() string {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get("https://registry.npmjs.org/@deepseek-ai/dsh")
	if err != nil {
		debugLog("latestVersion: registry fetch failed: %v", err)
		return ""
	}
	defer resp.Body.Close()
	var m struct {
		DistTags struct {
			Latest string `json:"latest"`
		} `json:"dist-tags"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		debugLog("latestVersion: registry decode failed: %v", err)
		return ""
	}
	return m.DistTags.Latest
}

func (a *App) checkUpdates() {
	a.emitUpdate("正在检查更新…")
	if rt, ok := bundledRuntimeInUse(); ok {
		// Portable release: same user-visible behaviour as the script install
		// (query the registry, fetch the newer harness, then ask for a restart),
		// except that the new version is installed into the package's own runtime
		// instead of the global npm prefix - nothing reads the global install here.
		a.checkBundledUpdate(rt)
		return
	}
	installed := a.installedVersion()
	latest := a.latestVersion()
	if latest == "" {
		a.emitUpdate("检查更新失败（网络不可用）")
		return
	}
	if installed == "" {
		a.emitUpdate("已安装版本未知，最新版本 " + latest)
		return
	}
	if installed == latest {
		a.emitUpdate("已是最新版本 " + latest)
		return
	}
	a.emitUpdate("发现新版本 " + latest + "（当前 " + installed + "），正在自动更新…")
	if err := a.npmInstallGlobal(); err != nil {
		debugLog("checkUpdates: npm install failed: %v", err)
		a.emitUpdate("更新失败，请手动执行 npm i -g @deepseek-ai/dsh")
		return
	}
	a.emitUpdate("已更新到 " + latest + "，请点击「重启服务」生效")
}

// ---- portable (bundled runtime) self-update ---------------------------------

// checkBundledUpdate mirrors the npm self-update path for a portable package:
// query the registry, download the newer harness into a staging prefix using the
// BUNDLED npm, then ask the user to restart (the swap happens at next start).
func (a *App) checkBundledUpdate(rt harnessRuntime) {
	current := versionFromPackageJSON(rt.Package)
	latest := a.latestVersion()
	if latest == "" {
		a.emitUpdate("检查更新失败（网络不可用）")
		return
	}
	if current == "" {
		a.emitUpdate("内置运行时版本未知，最新版本 " + latest)
		return
	}
	if current == latest {
		// Drop any stale staged tree (e.g. left over from a folder that was later
		// replaced by hand) so it cannot be applied on a future start.
		if _, ok := stagedRuntimeIn(updateStagingDir(rt.Root)); ok {
			debugLog("checkBundledUpdate: discarding stale staged runtime (already on %s)", latest)
			_ = os.RemoveAll(updateStagingDir(rt.Root))
		}
		a.emitUpdate("已是最新版本 " + latest)
		return
	}

	npmCLI := bundledNpmCLI(rt.Root)
	if npmCLI == "" {
		debugLog("checkBundledUpdate: no bundled npm, cannot self-update")
		a.emitUpdate("内置运行时 " + current + "（本包未内置 npm，无法自更新；请下载新版发行包）")
		return
	}
	// Already staged and waiting for a restart?
	staging := updateStagingDir(rt.Root)
	if staged, ok := stagedRuntimeIn(staging); ok {
		if v := versionFromPackageJSON(staged.Package); v == latest {
			a.emitUpdate("已下载 " + latest + "，重启服务后生效")
			return
		}
		_ = os.RemoveAll(staging)
	}

	a.emitUpdate("发现新版本 " + latest + "（当前 " + current + "），正在下载…")
	if err := a.stageBundledRuntime(rt, npmCLI, latest); err != nil {
		debugLog("checkBundledUpdate: staging failed: %v", err)
		a.emitUpdate("自动更新失败：" + err.Error() + "（也可下载新版发行包）")
		return
	}
	debugLog("checkBundledUpdate: staged %s at %s", latest, staging)
	a.emitUpdate("已下载 " + latest + "，请点击「重启服务」生效")
}

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
