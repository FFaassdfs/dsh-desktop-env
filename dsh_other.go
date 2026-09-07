//go:build !windows

package main

import "os/exec"

func (a *App) startDsh() error {
	cmd := exec.Command("dsh", "web", "--no-open", "--port", dshPort)
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
