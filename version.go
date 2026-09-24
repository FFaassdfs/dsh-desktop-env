package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// 核心版本的选择与更新。
//
// 背景（2026-09-23）：升级前的逻辑是 `installed == dist-tags.latest` 的**字符串等值**比较，
// 不等就静默 `npm i -g @deepseek-ai/dsh`（无版本号 ⇒ 装 latest）。后果有两个：
//  1. 上游把更新的 rc 放在 `next`、`latest` 钉在旧 rc 上时，壳永远看不到新版（0.1.5-rc.3 vs 0.1.7-rc.1）；
//  2. 它不比较版本大小，所以你手动装了更新的版本，下一次检查会把你**降级**回去。
//
// 现在：按 semver 比较（含预发布序 alpha < beta < rc < 正式），**只提示不自动装**，
// 并把「各通道最新版本」交给用户在状态面板里选择；可选「跳过此版本」（落盘记住）。

// 版本号本身怎么比较、怎么解析，一律复用既有的 `compareDshVersions` / `splitVersion`
// （runtime.go）——那是壳里唯一的一份实现，运行时换版也用它，别再写第二份。

// coreChannel 返回版本所属通道：stable / alpha / beta / rc / other。
func coreChannel(v string) string {
	nums, pre := splitVersion(v)
	if nums == nil {
		return "other"
	}
	if pre == "" {
		return "stable"
	}
	name, _, _ := strings.Cut(pre, ".")
	return name
}

// channelOrder 是面板里的展示顺序（正式 → rc → beta → alpha → 其他）。
var channelOrder = []string{"stable", "rc", "beta", "alpha", "other"}

// ---- registry ----

// registryDoc 只保留我们需要的三块：dist-tags、版本列表、发布时间。
type registryDoc struct {
	DistTags map[string]string          `json:"dist-tags"`
	Versions map[string]json.RawMessage `json:"versions"`
	Time     map[string]string          `json:"time"`
}

const dshRegistryURL = "https://registry.npmjs.org/@deepseek-ai/dsh"

// registryCacheTTL 让面板反复打开时不必每次都打 registry。
const registryCacheTTL = 5 * time.Minute

// registryCached 取 registry 文档并缓存一小段时间；失败时退回上一次成功的结果。
func (a *App) registryCached() (*registryDoc, error) {
	a.registryMu.Lock()
	defer a.registryMu.Unlock()
	if a.registry != nil && time.Since(a.registryAt) < registryCacheTTL {
		return a.registry, nil
	}
	doc, err := fetchRegistry()
	if err != nil {
		if a.registry != nil {
			return a.registry, nil // 网络抖动不该让面板空掉
		}
		return nil, err
	}
	a.registry, a.registryAt = doc, time.Now()
	return doc, nil
}

// fetchRegistry 取 npm registry 上 dsh 的文档（完整文档仅 ~0.17 MB，带发布时间）。
func fetchRegistry() (*registryDoc, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(dshRegistryURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry returned HTTP %d", resp.StatusCode)
	}
	var doc registryDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}
	if len(doc.Versions) == 0 {
		return nil, fmt.Errorf("registry document carries no versions")
	}
	return &doc, nil
}

// newestPerChannel 取每个通道里 semver 最大的版本。
func newestPerChannel(doc *registryDoc) map[string]string {
	newest := map[string]string{}
	for v := range doc.Versions {
		ch := coreChannel(v)
		cur, ok := newest[ch]
		if !ok || compareDshVersions(v, cur) > 0 {
			newest[ch] = v
		}
	}
	return newest
}

// coreOption 是面板里一行可选版本。
type coreOption struct {
	Channel   string `json:"channel"`
	Version   string `json:"version"`
	Published string `json:"published"` // 本地时间 "2006-01-02 15:04"，取不到为空
	Installed bool   `json:"installed"`
	Skipped   bool   `json:"skipped"`
	Newer     bool   `json:"newer"` // 严格比当前安装的新
}

// coreVersionsView 是 GetCoreVersions 的返回体。
type coreVersionsView struct {
	Installed string       `json:"installed"`
	LatestTag string       `json:"latestTag"` // dist-tags.latest（上游"推荐"通道）
	Options   []coreOption `json:"options"`
	Skipped   string       `json:"skipped"`
	Error     string       `json:"error"`
}

// buildCoreOptions 把 registry 文档压成"每个通道一行"的选项列表。
func buildCoreOptions(doc *registryDoc, installed, skipped string) []coreOption {
	newest := newestPerChannel(doc)
	out := make([]coreOption, 0, len(newest))
	for _, ch := range channelOrder {
		v, ok := newest[ch]
		if !ok {
			continue
		}
		out = append(out, coreOption{
			Channel:   ch,
			Version:   v,
			Published: formatRegistryTime(doc.Time[v]),
			Installed: v == installed,
			Skipped:   v == skipped,
			Newer:     installed != "" && compareDshVersions(v, installed) > 0,
		})
	}
	return out
}

// formatRegistryTime 把 ISO 时间转成本地 "2006-01-02 15:04"。
func formatRegistryTime(iso string) string {
	if iso == "" {
		return ""
	}
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return ""
	}
	return t.Local().Format("2006-01-02 15:04")
}

// newerChannels 返回比 installed 严格更新、且没被用户跳过的通道最新版本（按版本从新到旧）。
func newerChannels(doc *registryDoc, installed, skipped string) []coreOption {
	var out []coreOption
	for _, opt := range buildCoreOptions(doc, installed, skipped) {
		if opt.Newer && opt.Version != skipped {
			out = append(out, opt)
		}
	}
	sort.Slice(out, func(i, j int) bool { return compareDshVersions(out[i].Version, out[j].Version) > 0 })
	return out
}

// channelLabel 给状态栏用的人类可读通道名。
func channelLabel(ch string) string {
	switch ch {
	case "rc":
		return "rc"
	case "alpha":
		return "alpha"
	case "beta":
		return "beta"
	case "stable":
		return "正式"
	default:
		return ch
	}
}

// ---- 用户偏好（跳过某个版本） ----

// updatePrefs 是壳的更新偏好，与 window.json 放在同一个配置目录。
type updatePrefs struct {
	// SkippedCore 是用户选择"跳过"的核心版本；只有出现比它更新的版本时才会再提示。
	SkippedCore string `json:"skippedCore,omitempty"`
}

func updatePrefsPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "dsh-desktop", "update.json")
}

func loadUpdatePrefsFrom(path string) (updatePrefs, error) {
	var p updatePrefs
	data, err := os.ReadFile(path)
	if err != nil {
		return p, err
	}
	if err := json.Unmarshal(data, &p); err != nil {
		return p, err
	}
	return p, nil
}

func saveUpdatePrefsTo(path string, p updatePrefs) error {
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func loadUpdatePrefs() updatePrefs {
	p, err := loadUpdatePrefsFrom(updatePrefsPath())
	if err != nil {
		return updatePrefs{}
	}
	return p
}

func saveUpdatePrefs(p updatePrefs) error {
	return saveUpdatePrefsTo(updatePrefsPath(), p)
}

// ---- 对前端暴露的方法 ----

// GetCoreVersions 返回"当前核心版本 + 各通道最新版本"，供状态面板渲染选择器。
// 网络失败不致命：返回带 Error 的空列表，面板照常显示当前版本。
func (a *App) GetCoreVersions() coreVersionsView {
	view := coreVersionsView{Installed: a.installedVersion(), Skipped: loadUpdatePrefs().SkippedCore}
	doc, err := a.registryCached()
	if err != nil {
		debugLog("GetCoreVersions: %v", err)
		view.Error = err.Error()
		return view
	}
	view.LatestTag = doc.DistTags["latest"]
	view.Options = buildCoreOptions(doc, view.Installed, view.Skipped)
	return view
}

// UpdateCore 把核心装到指定版本。只有用户点了按钮才会走到这里——壳不再自动安装任何版本。
func (a *App) UpdateCore(version string) string {
	version = strings.TrimSpace(version)
	if nums, _ := splitVersion(version); nums == nil {
		return "版本号不合法：" + version
	}
	doc, err := a.registryCached()
	if err != nil {
		return "无法确认版本（registry 不可用）：" + err.Error()
	}
	if _, ok := doc.Versions[version]; !ok {
		return "registry 上没有这个版本：" + version
	}

	if rt, ok := bundledRuntimeInUse(); ok {
		npmCLI := bundledNpmCLI(rt.Root)
		if npmCLI == "" {
			return "本包未内置 npm，无法自更新；请下载新版发行包"
		}
		a.emitUpdate("正在下载核心 " + version + "…")
		if err := a.stageBundledRuntime(rt, npmCLI, version); err != nil {
			debugLog("UpdateCore: staging %s failed: %v", version, err)
			return "下载失败：" + err.Error()
		}
		// 已经装上这个版本了，跳过记录就没意义了
		if loadUpdatePrefs().SkippedCore == version {
			_ = saveUpdatePrefs(updatePrefs{})
		}
		a.emitUpdate("已下载核心 " + version + "，请点击「重启服务」生效")
		return "已下载 " + version + "，重启服务后生效"
	}

	a.emitUpdate("正在安装核心 " + version + "…")
	if err := a.npmInstallGlobalVersion(version); err != nil {
		debugLog("UpdateCore: npm install %s failed: %v", version, err)
		return "安装失败：" + err.Error() + "（也可手动执行 npm i -g @deepseek-ai/dsh@" + version + "）"
	}
	if loadUpdatePrefs().SkippedCore == version {
		_ = saveUpdatePrefs(updatePrefs{})
	}
	a.emitUpdate("已安装核心 " + version + "，请点击「重启服务」生效")
	return "已安装 " + version + "，重启服务后生效"
}

// SkipCoreVersion 记住"这个版本我不想装"，之后的检查只在出现更新的版本时才提示。
func (a *App) SkipCoreVersion(version string) string {
	version = strings.TrimSpace(version)
	if nums, _ := splitVersion(version); nums == nil {
		return "版本号不合法：" + version
	}
	if err := saveUpdatePrefs(updatePrefs{SkippedCore: version}); err != nil {
		return "保存失败：" + err.Error()
	}
	a.emitUpdate("已跳过核心 " + version + "（出现更新的版本时会再提示）")
	return "已跳过 " + version
}

// ClearSkippedCore 恢复提醒。
func (a *App) ClearSkippedCore() string {
	p := loadUpdatePrefs()
	if p.SkippedCore == "" {
		return "当前没有跳过任何版本"
	}
	was := p.SkippedCore
	if err := saveUpdatePrefs(updatePrefs{}); err != nil {
		return "保存失败：" + err.Error()
	}
	a.emitUpdate("已恢复对核心 " + was + " 的更新提醒")
	return "已恢复提醒（此前跳过 " + was + "）"
}
