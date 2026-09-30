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

func zhFirstLine(s string) string {
	if i := strings.IndexAny(s, "\r\n"); i >= 0 {
		return s[:i]
	}
	return s
}

func zhLastLine(s string) string {
	parts := strings.Split(strings.TrimRight(s, "\r\n"), "\n")
	return strings.TrimRight(parts[len(parts)-1], "\r")
}

// 内嵌的那段（= global/zh-preset.md）必须自带锚点，且确实覆盖"语言 + 日常避坑"两类内容。
// 它由 go:embed 编进二进制，所以这里测的不是"两处是否一致"，而是"有没有被人改空/改残"。
func TestZhPresetEmbeddedBlock(t *testing.T) {
	got := strings.TrimRight(zhPresetBlock, "\r\n")
	if !strings.HasPrefix(got, zhPresetBegin) || !strings.HasSuffix(got, zhPresetEnd) {
		t.Fatalf("内嵌预设必须以锚点开头/结尾，实际头部=%q 尾部=%q", zhFirstLine(got), zhLastLine(got))
	}
	for _, want := range []string{
		"默认用中文（简体）回复与交互", // 语言与交互
		"UTF-8 BOM",        // 编码：5.1 要有 BOM
		"ConvertFrom-Json", // 5.1 把顶层数组当一个对象
		"Start-Process",    // 静默失败，断言落在产物上
		"tar.exe",          // 解压大 zip
		"结尾",               // 文件名结尾的点/空格
	} {
		if !strings.Contains(got, want) {
			t.Errorf("内嵌预设缺少关键内容 %q（被删空了？）", want)
		}
	}
	if n := len([]byte(got)); n < 1500 || n > 6000 {
		t.Errorf("预设 %d 字节，超出预期 1500..6000：整条基线预算只有 64 KiB，"+
			"超限时全局文件最先被丢，别让它膨胀", n)
	}
}

// 锚点常量必须与内嵌文本里的锚点一致（改名时不会只改一半）。
func TestZhPresetMarkersMatchConstants(t *testing.T) {
	if !strings.Contains(zhPresetBlock, zhPresetBegin) || !strings.Contains(zhPresetBlock, zhPresetEnd) {
		t.Errorf("zhPresetBegin/End 常量与内嵌文本里的锚点不一致")
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
