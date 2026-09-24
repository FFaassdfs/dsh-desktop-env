package main

import (
	"embed"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// 状态面板的固定尺寸（不可缩放，所以四个值必须一致）。
//
// 2026-09-24：由 440x400 放大到 500x560。原尺寸是在面板只有「状态 + URL +
// 三个按钮」时定的；后来陆续加了「核心版本」选择器（§40）和「预置插件」入口，
// 440 宽会把状态与说明文字截断。560 高在 768p 笔记本屏上也放得下
// （768 减去任务栏约 40px 后仍有 728px 可用）。
//
// 抽成常量的理由：这四个值以前是**各自硬编码**的，改尺寸时漏改一处就会出现
// 「Min/Max 与实际尺寸打架」的怪现象。
const (
	panelWidth  = 500
	panelHeight = 560
)

func main() {
	// Portable packages ship their runtime as a single runtime.zip: unpacking it
	// is also exposed as a CLI mode (used by install-offline.ps1 and by the
	// release verification, and it avoids starting the GUI/single-instance lock).
	if extractRuntimeRequested(os.Args[1:]) {
		os.Exit(RunExtractRuntime())
	}

	app := NewApp()

	err := wails.Run(&options.App{
		Title:         "DeepSeek Harness",
		Width:         panelWidth,
		Height:        panelHeight,
		DisableResize: true,
		MinWidth:      panelWidth,
		MinHeight:     panelHeight,
		MaxWidth:      panelWidth,
		MaxHeight:     panelHeight,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnDomReady: app.domReady,
		OnShutdown: app.shutdown,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "dsh-desktop-9a7f1e2b",
			OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
				if app.winCtx != nil {
					runtime.WindowShow(app.winCtx)
				}
			},
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
