//go:build !windows

package main

import "os/exec"

func (a *App) startDsh() error {
	cmd := exec.Command("dsh", "web", "--no-open")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	a.cmd = cmd
	go a.scanMainOutput(stdout)
	return nil
}

func (a *App) npmInstallGlobal() error {
	return exec.Command("npm", "install", "-g", "@deepseek-ai/dsh").Run()
}
