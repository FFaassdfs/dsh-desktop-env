//go:build !windows

package main

import "os/exec"

func (a *App) startDsh() error {
	cmd := exec.Command("dsh", "web")
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
