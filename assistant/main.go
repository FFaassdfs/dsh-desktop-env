// Package main is the DSH desktop assistant: a small standalone panel that looks
// after the OFFICIAL DeepSeek Harness desktop app.
//
// WHAT IT IS (HANDOVER §57, decided 2026-09-30):
//   - our own Wails web shell is frozen at desktop-v0.1.20; the official Electron
//     desktop app is where work happens now;
//   - this assistant therefore runs NO harness and hosts NO service. It must not
//     become a second writer of $DSH_HOME: the two known incidents (2026-09-24,
//     2026-09-30) both came from multiple harness processes sharing one home;
//   - its job is the part the official app structurally will not do: tell you
//     what is installed, inject/update/remove our plugins in the official app's
//     reserved profile, install the global preset document, and guard $DSH_HOME
//     (fingerprint + backup + restore).
//
// S1 (this build) implements card 1 - detection and the official download link -
// plus the shared plumbing the later cards need.
package main

import (
	"embed"
	"log"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	// --- diagnostics hooks (2026-10-08, the 8000ffff controller failure) -------
	//
	// The first build of the assistant died silently on this machine: WebView2's
	// CreateCoreWebView2Controller completed with 0x8000ffff, and everything the
	// app printed went to the invisible stderr of a windowsgui process. Two knobs
	// exist so the failure can be bisected WITHOUT rebuilding, and so a broken
	// machine state can be worked around:
	//
	//   DSH_ASSISTANT_BROWSER_PATH  -> force the WebView2 runtime folder (the
	//                                  WEBVIEW2_BROWSER_EXECUTABLE_FOLDER env var
	//                                  is NOT usable for this: go-webview2's
	//                                  preventEnvAndRegistryOverrides overwrites
	//                                  it with the app's own value before the
	//                                  loader runs);
	//   DSH_ASSISTANT_DISABLE_GPU=1 -> the Wails option WebviewGpuIsDisabled (the
	//                                  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS env
	//                                  var is overwritten the same way).
	//
	// They also feed the startup log (see app.go), because a GUI process that
	// dies before creating a window has nowhere else to report.
	winOpts := &windows.Options{
		WebviewIsTransparent: false,
		WindowIsTranslucent:  false,
	}
	if p := os.Getenv("DSH_ASSISTANT_BROWSER_PATH"); p != "" {
		winOpts.WebviewBrowserPath = p
	}
	if os.Getenv("DSH_ASSISTANT_DISABLE_GPU") == "1" {
		winOpts.WebviewGpuIsDisabled = true
	}

	err := wails.Run(&options.App{
		Title:  "DSH 桌面助手",
		Width:  560,
		Height: 640,
		// A panel, not a document window: keep it small and let it be resized.
		MinWidth:  480,
		MinHeight: 420,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind:             []interface{}{app},
		Windows:          winOpts,
	})
	if err != nil {
		log.Fatalf("dsh-assistant: %v", err)
	}
}
