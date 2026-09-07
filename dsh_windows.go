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

// resolveDshWeb locates the node entry behind the `dsh` npm shim so dsh web
// can be spawned as `node <entry> web --no-open` directly. cmd.exe combined
// with CREATE_NO_WINDOW breaks the inherited stdio of the node grandchild:
// neither the stdout pipe nor the log file ever receives its output, so the
// shell cannot observe the authenticated URL that dsh web prints. Spawning
// node directly keeps stdout capture working while the hidden-window flags
// apply. ok=false means resolution failed and the caller should fall back to
// the legacy `cmd /C dsh web` (no token capture).
func resolveDshWeb() (string, []string, bool) {
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

// npmInstallGlobal updates the global @deepseek-ai/dsh package. The stdout of
// the npm process is not captured (it lands in the hidden console); the exit
// code alone reports success.
func (a *App) npmInstallGlobal() error {
	cmd := exec.Command("cmd", "/C", "npm", "install", "-g", "@deepseek-ai/dsh")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000 | 0x00000008,
	}
	return cmd.Run()
}
