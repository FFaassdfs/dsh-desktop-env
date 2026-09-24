package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// 面板尺寸的唯一来源是 main.go 的 panelWidth/panelHeight。
//
// 注意：minWindowWidth/minWindowHeight 只在 restoreWindowState 的「尺寸是否
// 有效」校验里用到，而 restoreWindowState / captureWindowState 自 §23 把窗口
// 改成固定尺寸后就**不再被调用**（main.go 没有 OnBeforeClose，也没有调用点）。
// 保留它们只是为了不破坏 windowstate_test.go 覆盖的还原逻辑；数值刻意与
// main.go 对齐，避免注释说"保持一致"而实际早已漂移（2026-09-24 修正：
// 旧值是 400x260，与当时的 440x400 并不一致）。
const (
	minWindowWidth  = panelWidth
	minWindowHeight = panelHeight
)

// WindowState 记录窗口大小、位置与最大化状态，用于跨启动还原。
type WindowState struct {
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Maximised bool `json:"maximised"`
}

func windowStatePath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "dsh-desktop", "window.json")
}

func loadWindowStateFrom(path string) (*WindowState, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var s WindowState
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func loadWindowState() (*WindowState, error) {
	return loadWindowStateFrom(windowStatePath())
}

func (s *WindowState) saveTo(path string) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (s *WindowState) save() error {
	return s.saveTo(windowStatePath())
}

// restoreWindowState 在启动时应用上次保存的窗口状态。
func (a *App) restoreWindowState(ctx context.Context) {
	state, err := loadWindowState()
	if err != nil || state == nil {
		return
	}
	// 尺寸无效（例如关机瞬间捕获到的零值）则不还原，避免把窗口压成不可用状态
	if state.Width < minWindowWidth || state.Height < minWindowHeight {
		return
	}
	runtime.WindowSetSize(ctx, state.Width, state.Height)
	if state.Maximised {
		runtime.WindowMaximise(ctx)
		return
	}
	runtime.WindowSetPosition(ctx, state.X, state.Y)
}

// captureWindowState 作为 OnBeforeClose 回调：在窗口关闭前保存状态。
// 返回 false 表示不阻止关闭。
func (a *App) captureWindowState(ctx context.Context) bool {
	w, h := runtime.WindowGetSize(ctx)
	x, y := runtime.WindowGetPosition(ctx)
	isMax := runtime.WindowIsMaximised(ctx)
	state := &WindowState{Width: w, Height: h, X: x, Y: y, Maximised: isMax}
	_ = state.save()
	return false
}
