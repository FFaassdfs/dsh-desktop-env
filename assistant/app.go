package main

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
	"strings"

	"dsh-desktop/internal/officialdetect"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the object bound to the frontend. Every exported method becomes a JS
// call; every method here is either read-only or explicitly user-triggered, and
// none of them starts a harness.
type App struct {
	ctx context.Context
}

// NewApp builds the assistant.
func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

// OfficialState is what card 1 renders: the detection result plus the paths the
// user needs to be able to see (the home both apps share, and the profile the
// official app owns).
func (a *App) OfficialState() (officialdetect.State, error) {
	state, err := officialdetect.Detect(a.context(), officialdetect.NewRegistry(), "")
	if err != nil {
		return state, fmt.Errorf("检测官方桌面版失败: %w", err)
	}
	return state, nil
}

// AdoptInstallDir verifies a directory the user picked by hand. A hand-unpacked
// copy of the official app has no registry entry, so this is the fallback for
// "I installed it but the panel says it is missing".
func (a *App) AdoptInstallDir(dir string) (officialdetect.Install, error) {
	install, ok := officialdetect.DetectDir(dir)
	if !ok {
		return install, fmt.Errorf("这个目录看起来不是官方桌面版的安装目录（缺少 DeepSeek Harness.exe / resources\\app.asar / resources\\runtime）")
	}
	return install, nil
}

// PickInstallDir opens a folder picker and verifies the chosen directory.
func (a *App) PickInstallDir() (officialdetect.Install, error) {
	dir, err := wailsruntime.OpenDirectoryDialog(a.context(), wailsruntime.OpenDialogOptions{
		Title: "选择官方桌面版的安装目录",
	})
	if err != nil {
		return officialdetect.Install{}, err
	}
	if strings.TrimSpace(dir) == "" {
		return officialdetect.Install{}, nil // cancelled
	}
	return a.AdoptInstallDir(dir)
}

// OpenDownloadPage hands the official installer URL to the system browser. The
// assistant never downloads it itself: the host is not resolvable from a shell
// on this machine (measured, HANDOVER §57.4), and we must not redistribute the
// official binary.
func (a *App) OpenDownloadPage() error {
	return openInBrowser(officialdetect.DownloadURL)
}

// OpenPath reveals a path in Explorer (a log directory, the profile folder, the
// backup folder). It never modifies anything.
func (a *App) OpenPath(path string) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("路径为空")
	}
	return exec.Command("explorer.exe", path).Start()
}

func (a *App) context() context.Context {
	if a.ctx != nil {
		return a.ctx
	}
	return context.Background()
}

// openInBrowser uses the platform opener; the assistant ships for Windows only,
// but keeping the switch means the package still builds for a developer on
// another platform (where the Wails GUI is not built anyway).
func openInBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}
