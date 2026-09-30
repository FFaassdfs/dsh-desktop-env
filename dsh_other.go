//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

// runtimeNodeName is the node executable name on this platform.
func runtimeNodeName() string { return "node" }

// hiddenWindowAttr has no meaning off Windows.
func hiddenWindowAttr() *syscall.SysProcAttr { return nil }

// startDsh prefers a portable runtime shipped next to the exe (offline release)
// and falls back to the `dsh` CLI on PATH.
func (a *App) startDsh() error {
	var cmd *exec.Cmd
	if rt, ok := bundledRuntimeInUse(); ok {
		debugLog("startDsh: using bundled runtime at %s", rt.Root)
		cmd = exec.Command(rt.NodeExe, rt.Entry, "web", "--no-open", "--port", dshPort)
	} else {
		cmd = exec.Command("dsh", "web", "--no-open", "--port", dshPort)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	a.adoptSpawn(cmd, stdout)
	return nil
}

// npmInstallGlobalVersion 安装一个明确版本（非 Windows 路径；版本由调用方给出，
// 壳不再自己装 latest —— 见 version.go）。
// 源走 corefeed.go 的配置：配置的源失败后自动改用淘宝镜像；返回**实际使用**的源。
func (a *App) npmInstallGlobalVersion(version string) (string, error) {
	feed := loadCoreFeed()
	attempts := registryAttempts(feed.Registry, feed.AutoMirror)
	used, err := installWithRegistryFallback(attempts, func(registry string) error {
		args := []string{"install", "-g"}
		args = append(args, npmRegistryArgs(registry)...)
		args = append(args, npmFetchBudgetArgs(registry)...)
		args = append(args, "@deepseek-ai/dsh@"+version)
		return exec.Command("npm", args...).Run()
	})
	if err != nil {
		return "", err
	}
	a.noteRegistryUsed(used)
	return used, nil
}

// startInstaller 在非 Windows 上直接调用 pwsh（便携发行包只做 win-x64，这条路
// 径主要是让 GOOS=linux 的 vet/编译能通过）。同样跑 .ps1 而非 .cmd。
func (a *App) startInstaller(path string) error {
	engine := "pwsh"
	if _, err := exec.LookPath(engine); err != nil {
		engine = "powershell"
	}
	cmd := exec.Command(engine, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path)
	return cmd.Start()
}
