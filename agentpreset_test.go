package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// withTempHome 把 $DSH_HOME 指到临时目录并返回它（t.Setenv 会自动还原）。
func withTempHome(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("DSH_HOME", dir)
	return dir
}

func mustReadFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(b)
}

// 壳里的预设文本必须与仓库权威副本 global/zh-preset.md 逐字一致：
// 改了一处没改另一处，这个测试就会红。
func TestZhPresetMatchesCanonicalFile(t *testing.T) {
	want := strings.TrimRight(mustReadFile(t, filepath.Join("global", "zh-preset.md")), "\r\n")
	got := strings.TrimRight(zhPresetBlock, "\r\n")
	if got != want {
		t.Errorf("zhPresetBlock 与 global/zh-preset.md 不一致:\n--- 壳内 ---\n%s\n--- 权威副本 ---\n%s", got, want)
	}
}

// 本机的完整全局预设 global/AGENTS.md 里也内嵌同一段（面板因此能对它正确显示
// 「已添加 / 一键移除」）——两处不一致时这个测试会红。
func TestGlobalAgentsEmbedsPresetBlock(t *testing.T) {
	doc := mustReadFile(t, filepath.Join("global", "AGENTS.md"))
	block := strings.TrimRight(zhPresetBlock, "\r\n")
	if !strings.Contains(doc, block) {
		t.Errorf("global/AGENTS.md 里没有与 global/zh-preset.md 逐字一致的那一段（改了预设文本要同步这里）")
	}
}

func TestZhPresetEnableDisableRoundTrip(t *testing.T) {
	home := withTempHome(t)
	a := &App{}
	path := filepath.Join(home, "AGENTS.md")

	if v := a.GlobalZhPresetStatus(); v.Enabled || v.HasFile {
		t.Fatalf("初始状态应为未添加: %+v", v)
	}
	if msg := a.SetGlobalZhPreset(true); !strings.Contains(msg, "已添加") {
		t.Errorf("添加返回: %q", msg)
	}
	if got := mustReadFile(t, path); !strings.Contains(got, zhPresetBegin) || !strings.Contains(got, zhPresetEnd) {
		t.Errorf("写入内容缺少标记:\n%s", got)
	}
	if v := a.GlobalZhPresetStatus(); !v.Enabled || !v.HasFile {
		t.Errorf("状态应为已添加: %+v", v)
	}
	if msg := a.SetGlobalZhPreset(true); !strings.Contains(msg, "无需重复添加") {
		t.Errorf("重复添加返回: %q", msg)
	}
	if n := strings.Count(mustReadFile(t, path), zhPresetBegin); n != 1 {
		t.Errorf("标记出现 %d 次，应为 1", n)
	}
	// 移除：该文件本来只有我们这一段 ⇒ 直接删文件，不留空壳
	if msg := a.SetGlobalZhPreset(false); !strings.Contains(msg, "已移除") {
		t.Errorf("移除返回: %q", msg)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("只含本段的文件应被删除，err=%v", err)
	}
	if msg := a.SetGlobalZhPreset(false); !strings.Contains(msg, "不存在") {
		t.Errorf("重复移除返回: %q", msg)
	}
}

func TestZhPresetNeverClobbersUserContent(t *testing.T) {
	home := withTempHome(t)
	path := filepath.Join(home, "AGENTS.md")
	mine := "# 我自己的全局预设\n\n- 这条不要动\n"
	if err := os.WriteFile(path, []byte(mine), 0o644); err != nil {
		t.Fatal(err)
	}
	a := &App{}
	if v := a.GlobalZhPresetStatus(); v.Enabled || !v.HasFile {
		t.Fatalf("应识别为「有文件但没预设」: %+v", v)
	}
	a.SetGlobalZhPreset(true)
	got := mustReadFile(t, path)
	if !strings.HasPrefix(got, mine) {
		t.Errorf("用户已有内容必须原样保留在前，实际:\n%s", got)
	}
	if !strings.Contains(got, zhPresetBegin) {
		t.Errorf("预设应被追加，实际:\n%s", got)
	}
	a.SetGlobalZhPreset(false)
	got = mustReadFile(t, path)
	if strings.Contains(got, zhPresetBegin) || strings.Contains(got, zhPresetEnd) {
		t.Errorf("移除后不应残留标记:\n%s", got)
	}
	if !strings.Contains(got, "这条不要动") {
		t.Errorf("移除后用户内容必须保留，实际:\n%s", got)
	}
}

func TestZhPresetKeepsBOMIfPresent(t *testing.T) {
	home := withTempHome(t)
	path := filepath.Join(home, "AGENTS.md")
	if err := os.WriteFile(path, []byte("\ufeff# 带 BOM 的全局预设\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	a := &App{}
	a.SetGlobalZhPreset(true)
	if got := mustReadFile(t, path); !strings.HasPrefix(got, "\ufeff") {
		t.Errorf("原文件带 BOM ⇒ 写入后也应保留 BOM")
	}
}

func TestRemoveMarkedBlock(t *testing.T) {
	text := "A\n" + zhPresetBegin + "\nB\n" + zhPresetEnd + "\nC\n"
	got := removeMarkedBlock(text, zhPresetBegin, zhPresetEnd)
	if strings.Contains(got, "B") || strings.Contains(got, zhPresetBegin) {
		t.Errorf("块未被删干净: %q", got)
	}
	if !strings.Contains(got, "A") || !strings.Contains(got, "C") {
		t.Errorf("块外内容被误删: %q", got)
	}
	if s := removeMarkedBlock("plain", zhPresetBegin, zhPresetEnd); s != "plain" {
		t.Errorf("没有标记时应原样返回，得到 %q", s)
	}
}
