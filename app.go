package main

import (
	"bufio"
	"context"
	"io"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	dshURL       = "http://127.0.0.1:3080"
	waitTimeout  = 30 * time.Second
	pollInterval = 300 * time.Millisecond
)

type App struct {
	ctx     context.Context
	winCtx  context.Context
	cmd     *exec.Cmd
	owns    bool
	mu      sync.Mutex
	booting bool
	booted  bool
	webURL  string
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.restoreWindowState(ctx)
}

func (a *App) domReady(ctx context.Context) {
	a.winCtx = ctx
	a.startBootstrap(ctx)
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

	if !a.portOpen() {
		if err := a.startDsh(); err != nil {
			a.fail(ctx, "无法启动 DeepSeek Harness，请确认已安装：npm i -g @deepseek-ai/dsh\n\n"+err.Error())
			return
		}
		a.owns = true
	}
	if !a.waitReady(waitTimeout) {
		a.fail(ctx, "等待 DeepSeek Harness 启动超时（30 秒）\n\n请检查: "+dshURL)
		return
	}
	if a.owns {
		a.waitForURL(waitTimeout)
	}
	target := a.authenticatedURL()
	if target == "" {
		target = dshURL
	}
	a.mu.Lock()
	a.booted = true
	a.mu.Unlock()
	runtime.WindowExecJS(ctx, "window.location.href = '"+target+"';")
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
// WebView can satisfy the browser-trust fence too.
func (a *App) scanMainOutput(output io.Reader) {
	scanner := bufio.NewScanner(output)
	for scanner.Scan() {
		line := scanner.Text()
		if idx := strings.Index(line, "dsh web:"); idx >= 0 {
			rest := strings.TrimSpace(line[idx+len("dsh web:"):])
			if fields := strings.Fields(rest); len(fields) > 0 && strings.HasPrefix(fields[0], "http") {
				a.setAuthenticatedURL(fields[0])
			}
		}
	}
}

func (a *App) fail(ctx context.Context, msg string) {
	runtime.EventsEmit(ctx, "dsh-error", msg)
}

func (a *App) Retry() {
	if a.winCtx != nil {
		a.startBootstrap(a.winCtx)
	}
}

func (a *App) shutdown(ctx context.Context) {
	if a.owns && a.cmd != nil && a.cmd.Process != nil {
		exec.Command("taskkill", "/F", "/T", "/PID", strconv.Itoa(a.cmd.Process.Pid)).Run()
	}
}
