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

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
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
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})
	if err != nil {
		log.Fatalf("dsh-assistant: %v", err)
	}
}
