package main

// 全局中文交互预设（壳面板的「全局预设」开关）
//
// 机制（官方 @deepseek-ai/dsh-agent-instructions 的行为，实测口径见其 README.zh.md）：
//   * 每个会话的**第一次请求**会把 $DSH_HOME/AGENTS.md 作为持久基线注入 ⇒ **所有项目**生效；
//   * 项目目录内更具体的 AGENTS.md / CLAUDE.md 优先于它（可用 AGENTS.local.md 做本地 overlay）；
//   * 整条基线的预算默认 64 KiB（dsh-base 的 maxBytes），超预算时**先丢宽泛的**——也就是全局文件
//     最先被丢。所以这块只写"语言与交互"几条，不放私货。
//
// 设计取舍：
//   * **带标记的块 + 只增删自己那一段**：$DSH_HOME/AGENTS.md 是**用户自己的**文件，可能已有大量
//     内容；壳绝不整体覆盖。移除时只删 begin..end；若文件因此变空（说明本来只有我们写的）才删文件。
//   * **文本硬编码在这里**（而不是读包内文件）：壳要能在源码装 / 便携包 / 任意路径下都工作，不能依赖
//     包布局。权威副本仍是仓库的 `global/zh-preset.md`（便携包也带它，供安装器首装使用），
//     `TestZhPresetMatchesCanonicalFile` 逐字断言两者一致 ⇒ 改一处必须改另一处，否则测试红。

import (
	"os"
	"path/filepath"
	"strings"
)

const (
	zhPresetBegin = "<!-- dsh-desktop:zh-preset:begin -->"
	zhPresetEnd   = "<!-- dsh-desktop:zh-preset:end -->"
)

// zhPresetBlock 是壳写入的内容，必须与 global/zh-preset.md 逐字一致。
const zhPresetBlock = zhPresetBegin + `
> 本段由 dsh-desktop 壳面板的「全局预设」按钮管理（添加 / 移除）；上下两行注释是锚点，请勿手改。

- **默认用中文（简体）回复与交互**：正文、报错说明、日志、提交信息、文档一律中文，除非用户明确要求其他语言。
- 代码标识符、命令、路径、上游英文原文与专有名词**保持原样**——不要为了"中文"去翻译标识符或改写命令。
- 需要用户看的结论、表格、清单优先中文；引用上游英文原文时保留原文并附中文说明。
` + zhPresetEnd + "\n"

// zhPresetView 是面板要显示的状态（Wails 会据此生成 TS 模型）。
type zhPresetView struct {
	Enabled bool   `json:"enabled"` // 文件里已经含我们那段
	Path    string `json:"path"`    // 目标文件（$DSH_HOME/AGENTS.md）
	Note    string `json:"note"`    // 一句话现状说明（面板直接显示）
	HasFile bool   `json:"hasFile"` // 文件是否已存在（用户可能自己写过内容）
}

// dshHomeDir 解析 $DSH_HOME（与官方 dsh 同规则：环境变量优先，否则 ~/.dsh）。
func dshHomeDir() string {
	if v := strings.TrimSpace(os.Getenv("DSH_HOME")); v != "" {
		return v
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ""
	}
	return filepath.Join(home, ".dsh")
}

// zhPresetPath 是全局指令文件的位置。
func zhPresetPath() string {
	home := dshHomeDir()
	if home == "" {
		return ""
	}
	return filepath.Join(home, "AGENTS.md")
}

// GlobalZhPresetStatus 报告"全局中文预设"当前是否已添加。
func (a *App) GlobalZhPresetStatus() zhPresetView {
	path := zhPresetPath()
	view := zhPresetView{Path: path}
	if path == "" {
		view.Note = "找不到用户目录（$DSH_HOME / ~/.dsh）"
		return view
	}
	text, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			view.Note = "尚未添加（添加后所有项目都会默认用中文交互）"
			return view
		}
		view.Note = "读取失败：" + err.Error()
		return view
	}
	view.HasFile = true
	view.Enabled = strings.Contains(string(text), zhPresetBegin)
	if view.Enabled {
		view.Note = "已添加（所有项目默认中文交互；点「移除」可撤销）"
	} else {
		view.Note = "文件已存在但没有本预设（添加只会追加一段，不会覆盖你的内容）"
	}
	return view
}

// SetGlobalZhPreset 添加（enable=true）或移除该预设，返回给用户看的一句话。
func (a *App) SetGlobalZhPreset(enable bool) string {
	path := zhPresetPath()
	if path == "" {
		return "找不到用户目录（$DSH_HOME / ~/.dsh），无法写入全局预设"
	}
	text, err := os.ReadFile(path)
	exists := err == nil
	if err != nil && !os.IsNotExist(err) {
		return "读取 " + path + " 失败：" + err.Error()
	}
	body := ""
	if exists {
		body = string(text)
	}
	has := strings.Contains(body, zhPresetBegin)

	if enable {
		if has {
			return "全局中文预设已在 " + path + "（无需重复添加）"
		}
		next := body
		if strings.TrimSpace(next) != "" {
			if !strings.HasSuffix(next, "\n") {
				next += "\n"
			}
			next += "\n" // 与用户已有内容之间留一个空行
		}
		next += zhPresetBlock
		if err := writeZhPreset(path, next, body); err != nil {
			return "写入失败：" + err.Error()
		}
		return "已添加全局中文预设 → " + path + "（新会话生效，所有项目都适用）"
	}

	if !has {
		return "全局中文预设不存在（无需移除）"
	}
	next := strings.TrimRight(removeMarkedBlock(body, zhPresetBegin, zhPresetEnd), "\r\n")
	if strings.TrimSpace(next) == "" {
		// 文件本来就只有我们这一段 ⇒ 删掉文件，别留一个空壳
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return "移除失败：" + err.Error()
		}
		return "已移除全局中文预设（该文件本来只有这一段，已一并删除）"
	}
	if err := writeZhPreset(path, next+"\n", body); err != nil {
		return "移除失败：" + err.Error()
	}
	return "已从 " + path + " 移除全局中文预设（你自己的内容原样保留）"
}

// removeMarkedBlock 删掉 begin..end 整段（含两个标记）。找不到标记时原样返回。
func removeMarkedBlock(text, begin, end string) string {
	i := strings.Index(text, begin)
	if i < 0 {
		return text
	}
	rest := text[i+len(begin):]
	j := strings.Index(rest, end)
	if j < 0 {
		return text[:i]
	}
	return text[:i] + rest[j+len(end):]
}

// writeZhPreset 写 UTF-8；原文件带 BOM 就保留 BOM（不把用户的文件改脏）。
func writeZhPreset(path, next, previous string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	if strings.HasPrefix(previous, "\ufeff") && !strings.HasPrefix(next, "\ufeff") {
		next = "\ufeff" + next
	}
	return os.WriteFile(path, []byte(next), 0o644)
}
