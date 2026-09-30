package main

// 核心更新源（npm registry）配置 + 失败自动回退。
//
// 为什么要它：核心 `@deepseek-ai/dsh` 走的是 **npm registry**（不是 GitHub），国
// 内直连 registry.npmjs.org 经常很慢或干脆不通。2026-09-30 实测（HANDOVER §54）：
// 官方 994 ms vs 淘宝镜像 186–270 ms，且镜像上 `0.2.0-rc.1` / `0.1.7-rc.2` 的
// `integrity`/`shasum` 与官方**完全一致**（内容字节等价）。壳原先固定用 npm 默认
// 源，源不通时用户只能看到一句"下载失败"。
//
// 约定：
//   * 空字符串 = npm 默认源（registry.npmjs.org；不改用户任何 npm 配置）；
//   * 配置只写在壳自己的文件里（os.UserConfigDir()/dsh-desktop/core-feed.json），
//     **不碰用户的 ~/.npmrc**；
//   * 自动回退默认开启：先试配置的源，失败后改用淘宝镜像（若配置的本来就是淘宝，
//     不重复尝试）；
//   * 每次尝试都回报"实际用了哪个源"，面板与日志据此显示，避免用户猜。

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// 淘宝镜像（NPMMirror）。官方源不可达时的兜底。
	registryNpmmirror = "https://registry.npmmirror.com"

	// 官方源那次尝试要"快速失败"：npm 默认 fetch-retries=2 且 fetch-timeout=5min，
	// 被墙时可能卡十几分钟才轮到回退。给一个更紧的预算（足够跑完一次正常请求）；
	// 真正花时间的下载交给镜像那次（预算放宽）。
	officialFetchTimeoutMS = 45000
	officialFetchRetries   = 1
	mirrorFetchTimeoutMS   = 300000
)

// coreFeed 是落盘结构。
type coreFeed struct {
	Registry   string `json:"registry"`   // "" = 官方（npm 默认源）
	AutoMirror bool   `json:"autoMirror"` // 失败后自动改用淘宝镜像
}

// coreFeedView 是面板要显示的状态（Wails 据此生成 TS 模型）。
type coreFeedView struct {
	Registry   string `json:"registry"`
	AutoMirror bool   `json:"autoMirror"`
	Label      string `json:"label"` // 配置的源，给人看的名字
	Used       string `json:"used"`  // 上一次实际成功的源（""=还没查过）
	Note       string `json:"note"`
}

func coreFeedPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "dsh-desktop", "core-feed.json")
}

// loadCoreFeed 读配置；文件不存在/坏掉时给默认值（官方源 + 开启回退）。
func loadCoreFeed() coreFeed {
	f := coreFeed{AutoMirror: true}
	data, err := os.ReadFile(coreFeedPath())
	if err != nil {
		return f
	}
	var got coreFeed
	if json.Unmarshal(data, &got) != nil {
		return f
	}
	f.Registry = normalizeRegistry(got.Registry)
	f.AutoMirror = got.AutoMirror
	return f
}

func (f coreFeed) save() error {
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	p := coreFeedPath()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o644)
}

// normalizeRegistry 去掉首尾空白与结尾斜杠；不是 http(s) 地址一律返回 ""（=官方）。
func normalizeRegistry(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	if strings.ContainsAny(v, " \t\r\n") {
		return ""
	}
	if !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") {
		return ""
	}
	return strings.TrimRight(v, "/")
}

// registryLabel 把源变成给人看的名字。
func registryLabel(registry string) string {
	switch r := normalizeRegistry(registry); r {
	case "":
		return "官方 npm（registry.npmjs.org）"
	case registryNpmmirror:
		return "淘宝镜像（registry.npmmirror.com）"
	default:
		return r
	}
}

// registryShortLabel 给"实际使用"这类短语用，短一点。
func registryShortLabel(registry string) string {
	switch r := normalizeRegistry(registry); r {
	case "":
		return "官方源"
	case registryNpmmirror:
		return "淘宝镜像"
	default:
		return r
	}
}

// registryAttempts 返回按顺序尝试的源（""=npm 默认源）。
// autoMirror 为真且配置的不是淘宝时，末尾追加淘宝兜底。
func registryAttempts(configured string, autoMirror bool) []string {
	configured = normalizeRegistry(configured)
	out := []string{configured}
	if autoMirror && configured != registryNpmmirror {
		out = append(out, registryNpmmirror)
	}
	return out
}

// npmRegistryArgs 把源转成 npm 参数。官方（""）不传参数，保持 npm 自身配置。
func npmRegistryArgs(registry string) []string {
	r := normalizeRegistry(registry)
	if r == "" {
		return nil
	}
	return []string{"--registry=" + r}
}

// npmFetchBudgetArgs 给每次尝试加带上限：官方源快速失败，镜像源耐心下载。
func npmFetchBudgetArgs(registry string) []string {
	if normalizeRegistry(registry) == "" {
		return []string{
			fmt.Sprintf("--fetch-timeout=%d", officialFetchTimeoutMS),
			fmt.Sprintf("--fetch-retries=%d", officialFetchRetries),
		}
	}
	return []string{fmt.Sprintf("--fetch-timeout=%d", mirrorFetchTimeoutMS)}
}

// installWithRegistryFallback 依次尝试每个源，成功即返回**实际使用**的那个。
// run 收到源（""=官方）并返回错误。
func installWithRegistryFallback(attempts []string, run func(registry string) error) (string, error) {
	if len(attempts) == 0 {
		attempts = []string{""}
	}
	var lastErr error
	for i, registry := range attempts {
		err := run(registry)
		if err == nil {
			return registry, nil
		}
		lastErr = err
		if i < len(attempts)-1 {
			debugLog("core feed: %s failed (%v) - falling back to %s",
				registryLabel(registry), err, registryLabel(attempts[i+1]))
		}
	}
	return "", lastErr
}

// noteLastUsed 记下面板要显示的"上次实际使用的源"（与 registry 缓存共用互斥）。
func (a *App) noteRegistryUsed(registry string) {
	a.registryMu.Lock()
	a.registryUsed = registry
	a.registryMu.Unlock()
}

// ---- 面板接口 ----

// CoreFeedStatus 报告当前更新源配置与上次实际使用的源。
func (a *App) CoreFeedStatus() coreFeedView {
	f := loadCoreFeed()
	a.registryMu.Lock()
	used := a.registryUsed
	a.registryMu.Unlock()

	view := coreFeedView{
		Registry:   f.Registry,
		AutoMirror: f.AutoMirror,
		Label:      registryLabel(f.Registry),
	}
	if used != "" || f.Registry != "" {
		view.Used = registryShortLabel(used)
	}
	switch {
	case f.Registry == "" && f.AutoMirror:
		view.Note = "官方源优先；不通时自动改用淘宝镜像"
	case f.Registry == "" && !f.AutoMirror:
		view.Note = "只用官方源（已关闭自动回退）"
	case f.AutoMirror && f.Registry != registryNpmmirror:
		view.Note = "用 " + registryShortLabel(f.Registry) + "；不通时自动改用淘宝镜像"
	default:
		view.Note = "用 " + registryShortLabel(f.Registry)
	}
	if used != "" {
		view.Note += "（上次实际使用：" + registryShortLabel(used) + "）"
	}
	return view
}

// SetCoreFeed 保存更新源配置，返回给用户看的一句话。
// registry 为空 = 官方源；非 http(s) 的值会被拒绝（不写盘）。
func (a *App) SetCoreFeed(registry string, autoMirror bool) string {
	raw := strings.TrimSpace(registry)
	norm := normalizeRegistry(raw)
	if raw != "" && norm == "" {
		return "这个源不是 http(s) 地址，未保存：" + raw
	}
	f := coreFeed{Registry: norm, AutoMirror: autoMirror}
	if err := f.save(); err != nil {
		return "保存失败：" + err.Error()
	}
	msg := "更新源已保存：" + registryLabel(norm)
	if autoMirror && norm != registryNpmmirror {
		msg += "；不通时自动改用淘宝镜像"
	}
	return msg
}
