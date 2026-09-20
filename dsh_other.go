//go:build !windows

package main

import (
	"os/exec"
)

// runtimeNodeName is the node executable name on this platform.
func runtimeNodeName() string { return "node" }

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

func (a *App) npmInstallGlobal() error {
	return exec.Command("npm", "install", "-g", "@deepseek-ai/dsh").Run()
}
