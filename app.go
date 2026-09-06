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
	dshURL         = "http://127.0.0.1:3080"
	waitTimeout    = 30 * time.Second
	pollInterval   = 300 * time.Millisecond
	updateInterval = 24 * time.Hour
)

type App struct {
	ctx        context.Context
	winCtx     context.Context
	cmd        *exec.Cmd
	owns       bool
	mu         sync.Mutex
	booting    bool
	booted     bool
	webURL     string
	update     string
	exited     bool
	exitErr    error
	restarts   int
	monitorOn  bool
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.checkUpdatesLoop()
}

func (a *App) domReady(ctx context.Context) {
	a.winCtx = ctx
	a.startBootstrap(ctx)
}

// debugLog appends a diagnostic line to the dsh-desktop debug log so the
// bootstrap path can be inspected without a visible console.
func debugLog(format string, args ...interface{}) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return
	}
	path := filepath.Join(dir, "dsh-desktop", "debug.log")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
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

	a.emitStatus("正在启动 DeepSeek Harness…")
	if !a.portOpen() {
		debugLog("bootstrap: port 3080 closed, spawning dsh web")
		if err := a.startDsh(); err != nil {
			debugLog("bootstrap: startDsh failed: %v", err)
			a.fail(ctx, "无法启动 DeepSeek Harness，请确认已安装：npm i -g @deepseek-ai/dsh\n\n"+err.Error())
			return
		}
		a.owns = true
	} else {
		debugLog("bootstrap: port 3080 already open, adopting existing instance")
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
	a.restarts = 0
	a.mu.Unlock()
	debugLog("bootstrap: ready")
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
	conn, err := net.DialTimeout("tcp", "127.0.0.1:3080", 800*time.Millisecond)
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
// ("dsh web: http://127.0.0.1:3080/?token=...") and remembers it so the shell
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
// failure can surface the real cause (e.g. EACCES on a reserved port).
func (a *App) tailDshLog() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	p := filepath.Join(dir, "dsh-desktop", "dsh.log")
	data, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	const n = 20
	if len(lines) == 0 {
		return ""
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
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

// healthMonitor watches the owned dsh web process and restarts it (up to 3
// times) if it exits unexpectedly. This recovers from transient crashes without
// user intervention, but stops after repeated failures so a persistently
// broken port (e.g. reserved by Hyper-V/WSL) does not restart in a tight loop.
func (a *App) healthMonitor() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		a.mu.Lock()
		owns := a.owns
		booted := a.booted
		restarts := a.restarts
		a.mu.Unlock()
		if !owns || !booted {
			continue
		}
		exited, _ := a.childExited()
		if !exited {
			continue
		}
		a.mu.Lock()
		a.restarts++
		restarts = a.restarts
		a.mu.Unlock()
		if restarts > 3 {
			a.emitStatus("服务反复启动失败，已停止自动重启")
			a.fail(a.winCtx, "服务进程反复退出，请检查端口 3080 是否被占用或系统保留（如 Hyper-V/WSL/winnat）。\n\n"+a.tailDshLog())
			return
		}
		a.emitStatus("服务掉线，正在自动重启…")
		a.Restart()
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

// Retry re-runs bootstrap after a startup failure.
func (a *App) Retry() {
	a.startBootstrap(a.winCtx)
}

// Restart restarts the owned dsh web process (picks up a freshly installed
// harness version) and re-bootstraps.
func (a *App) Restart() {
	a.mu.Lock()
	wasBooted := a.booted
	a.booting = false
	a.booted = false
	a.webURL = ""
	cmd := a.cmd
	owns := a.owns
	a.cmd = nil
	a.owns = false
	a.mu.Unlock()
	if wasBooted && owns && cmd != nil && cmd.Process != nil {
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
	shim, err := exec.LookPath("dsh.cmd")
	if err != nil {
		shim, err = exec.LookPath("dsh")
	}
	if err != nil {
		debugLog("installedVersion: dsh shim not found: %v", err)
		return ""
	}
	pkg := filepath.Join(filepath.Dir(shim), "node_modules", "@deepseek-ai", "dsh", "package.json")
	data, err := os.ReadFile(pkg)
	if err != nil {
		debugLog("installedVersion: cannot read %s: %v", pkg, err)
		return ""
	}
	var m struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		debugLog("installedVersion: cannot parse %s: %v", pkg, err)
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

func (a *App) checkUpdatesLoop() {
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
