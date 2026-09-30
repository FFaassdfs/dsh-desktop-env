//go:build windows

package main

import (
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
)

// jsEntryPattern matches the quoted node entry script inside npm's cmd shim,
// e.g. "%dp0%\node_modules\@deepseek-ai\dsh\lib\bin.js".
var jsEntryPattern = regexp.MustCompile(`"[^"]+\.js"`)

// runtimeNodeName is the node executable name on this platform.
func runtimeNodeName() string { return "node.exe" }

// hiddenWindowAttr returns the process attributes used for helper processes
// (npm during a self-update, version probes): no console window, no window for
// the child either.
func hiddenWindowAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{CreationFlags: 0x08000000 | 0x00000008}
}

// resolveDshWeb locates the node entry so dsh web can be spawned as
// `node <entry> web --no-open` directly. cmd.exe combined with
// CREATE_NO_WINDOW breaks the inherited stdio of the node grandchild: neither
// the stdout pipe nor the log file ever receives its output, so the shell
// cannot observe the authenticated URL that dsh web prints. Spawning node
// directly keeps stdout capture working while the hidden-window flags apply.
//
// Order: a portable runtime shipped next to the exe (offline release) wins;
// otherwise the `dsh` npm shim on PATH is used. ok=false means resolution
// failed and the caller should fall back to the legacy `cmd /C dsh web`
// (no token capture).
func resolveDshWeb() (string, []string, bool) {
	if rt, ok := bundledRuntimeInUse(); ok {
		debugLog("resolveDshWeb: using bundled runtime at %s", rt.Root)
		return rt.NodeExe, []string{rt.Entry, "web", "--no-open", "--port", dshPort}, true
	}

	shim, err := exec.LookPath("dsh.cmd")
	if err != nil {
		debugLog("resolveDshWeb: dsh.cmd not found in PATH: %v", err)
		return "", nil, false
	}
	data, err := os.ReadFile(shim)
	if err != nil {
		debugLog("resolveDshWeb: cannot read shim %s: %v", shim, err)
		return "", nil, false
	}
	match := jsEntryPattern.Find(data)
	if match == nil {
		debugLog("resolveDshWeb: no quoted .js entry found in %s", shim)
		return "", nil, false
	}
	shimDir := filepath.Dir(shim)
	entry := strings.Trim(string(match), `"`)
	entry = strings.ReplaceAll(entry, "%~dp0", shimDir+string(filepath.Separator))
	entry = strings.ReplaceAll(entry, "%dp0%", shimDir+string(filepath.Separator))
	if _, err := os.Stat(entry); err != nil {
		debugLog("resolveDshWeb: entry %s missing: %v", entry, err)
		return "", nil, false
	}
	// Mirror the shim's own lookup: bundled node.exe next to it first, then PATH.
	node := filepath.Join(shimDir, "node.exe")
	if _, err := os.Stat(node); err != nil {
		node, err = exec.LookPath("node")
		if err != nil {
			debugLog("resolveDshWeb: node executable not found: %v", err)
			return "", nil, false
		}
	}
	return node, []string{entry, "web", "--no-open", "--port", dshPort}, true
}

func (a *App) startDsh() error {
	logDir, err := os.UserConfigDir()
	if err != nil {
		logDir = os.TempDir()
	}
	logPath := filepath.Join(logDir, "dsh-desktop", "dsh.log")
	if mkErr := os.MkdirAll(filepath.Dir(logPath), 0o755); mkErr != nil {
		logPath = os.DevNull
	}
	if logPath != os.DevNull {
		// Keep the captured log bounded across launches (shell append-only).
		_ = rotateIfTooBig(logPath, maxDshLogBytes)
	}
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		logFile = nil
	}

	var cmd *exec.Cmd
	var stdout io.Reader
	if exe, args, ok := resolveDshWeb(); ok {
		debugLog("startDsh: spawning node directly: %s %v", exe, args)
		cmd = exec.Command(exe, args...)
		if pipe, pipeErr := cmd.StdoutPipe(); pipeErr == nil {
			stdout = pipe
		} else {
			debugLog("startDsh: StdoutPipe failed, capturing nothing: %v", pipeErr)
		}
	} else {
		debugLog("startDsh: node entry unresolvable, falling back to cmd /C (no token capture)")
		cmd = exec.Command("cmd", "/C", "dsh", "web", "--no-open", "--port", dshPort)
		if logFile != nil {
			cmd.Stdout = logFile
		}
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000 | 0x00000008,
	}
	if logFile != nil {
		cmd.Stderr = logFile
	}
	if err := cmd.Start(); err != nil {
		if logFile != nil {
			logFile.Close()
		}
		return err
	}
	if logFile != nil {
		logFile.Close()
	}
	a.adoptSpawn(cmd, stdout)
	return nil
}

// npmInstallGlobalVersion 安装 @deepseek-ai/dsh 的**一个明确版本**。
// 版本号始终由调用方给出：壳自己不再装 "latest"（见 version.go）——那既会漏掉
// next/alpha 上的新版本，也可能把用户选好的版本静默降级回去。
// npm 进程的 stdout 不捕获（落在隐藏控制台里），只以退出码判断成功与否。
//
// 源走 corefeed.go 的配置：先试配置的源，失败（被墙/超时）后自动改用淘宝镜像；
// 返回值是**实际使用**的源（""=官方），面板据此说明"这次用的是哪个源"。
func (a *App) npmInstallGlobalVersion(version string) (string, error) {
	feed := loadCoreFeed()
	attempts := registryAttempts(feed.Registry, feed.AutoMirror)
	used, err := installWithRegistryFallback(attempts, func(registry string) error {
		return npmInstallGlobalVersionOnce(version, registry)
	})
	if err != nil {
		return "", err
	}
	a.noteRegistryUsed(used)
	return used, nil
}

// npmInstallGlobalVersionOnce 用**一个**源做一次全局安装。
func npmInstallGlobalVersionOnce(version, registry string) error {
	args := []string{"/C", "npm", "install", "-g"}
	args = append(args, npmRegistryArgs(registry)...)
	args = append(args, npmFetchBudgetArgs(registry)...)
	args = append(args, "@deepseek-ai/dsh@"+version)
	cmd := exec.Command("cmd", args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000 | 0x00000008,
	}
	return cmd.Run()
}

// startInstaller 在后台启动发行包自带的插件安装器（见 plugins_install.go）。
//
// 三个刻意的选择：
//  1. **跑 .ps1，不跑 .cmd**——.cmd 末尾有 `pause`（那是给双击用的），由壳启动会
//     永远等不到进程退出。
//  2. **窗口可见**（不用 hiddenWindowAttr）：安装器会打印插件清单与进度，用户
//     需要看到它到底在做什么；把它藏起来只会让人以为"点了没反应"。
//  3. **刻意不传 `-Plugins`**——`install-offline.ps1` 的参数默认值是 `all`，也就是
//     「一键装全部预置插件」，跑完脚本自己退出：**没有菜单、不需要控制台输入**。
//     面板文案按这个语义写（见 app.go 的 InstallBundledPlugins）。
//     ⚠️ 2026-09-28 实测过这个困惑：用户点「安装预置插件」只看到 PowerShell 窗口
//     一闪（因为默认 `all` 一秒装完就退出），而当时的面板文案却写着"请按提示选择
//     要装的插件"。**已定为一键安装**（用户决定，文案同步改写），所以：
//     **不要"顺手"在这里补 `-Plugins ask`**——那会变成"要点两次 + 必须与控制台
//     交互"，是另一个产品形态。要看菜单的用户请双击包里的 `install-offline.cmd`
//     （带菜单 + `pause`），或自行加 `-Plugins ask`。
func (a *App) startInstaller(path string) error {
	engine := firstExistingExecutable(powershellCandidates(os.Getenv))
	cmd := exec.Command(engine, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path)
	return cmd.Start()
}
