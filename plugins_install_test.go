package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 安装器解析：只看 exe 同级（便携包布局），并允许用环境变量显式覆盖。
// 关键的负向行为是「找不到就返回空」——面板据此隐藏入口，而不是显示一个
// 点了没反应的按钮。
func TestInstallerCandidatesAndLookup(t *testing.T) {
	dir := t.TempDir()
	exeDir := filepath.Join(dir, "pkg")
	if err := os.MkdirAll(exeDir, 0o755); err != nil {
		t.Fatal(err)
	}

	env := func(m map[string]string) func(string) string {
		return func(k string) string { return m[k] }
	}

	// 1) 没有环境变量、exe 同级也没有脚本 -> 空（面板隐藏入口）
	none := installerCandidates(exeDir, env(nil))
	if got := findInstaller(none); got != "" {
		t.Fatalf("expected no installer, got %q", got)
	}

	// 2) exe 同级有脚本 -> 命中
	side := filepath.Join(exeDir, installerName)
	if err := os.WriteFile(side, []byte("# stub"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := findInstaller(installerCandidates(exeDir, env(nil))); got != side {
		t.Fatalf("side-by-side installer not found: got %q want %q", got, side)
	}

	// 3) 环境变量覆盖优先于同级
	other := filepath.Join(dir, "explicit.ps1")
	if err := os.WriteFile(other, []byte("# stub"), 0o644); err != nil {
		t.Fatal(err)
	}
	got := findInstaller(installerCandidates(exeDir, env(map[string]string{installerEnvOverride: other})))
	if got != other {
		t.Fatalf("override should win: got %q want %q", got, other)
	}

	// 4) 覆盖指向不存在的文件时，退回同级那份（不要因为坏配置就假装没有）
	got = findInstaller(installerCandidates(exeDir, env(map[string]string{installerEnvOverride: filepath.Join(dir, "nope.ps1")})))
	if got != side {
		t.Fatalf("bad override should fall through to side-by-side: got %q want %q", got, side)
	}

	// 5) 空 exeDir 不应 panic，也不应凭空造出路径
	if got := findInstaller(installerCandidates("", env(nil))); got != "" {
		t.Fatalf("empty exeDir should yield nothing, got %q", got)
	}
}

// 引擎选择：PS7 优先，最终一定回落到系统自带的 powershell.exe（它必然存在）。
func TestPowershellCandidates(t *testing.T) {
	env := func(m map[string]string) func(string) string {
		return func(k string) string { return m[k] }
	}

	// 没有 ProgramW6432 / ProgramFiles 时仍需给出兜底项
	got := powershellCandidates(env(nil))
	if len(got) == 0 || !strings.HasSuffix(got[len(got)-1], "powershell.exe") {
		t.Fatalf("expected a powershell.exe fallback, got %v", got)
	}

	// 有 ProgramFiles 时应把它排在最前
	got = powershellCandidates(env(map[string]string{"ProgramFiles": `C:\PF`}))
	if !strings.Contains(got[0], "PowerShell") || !strings.HasSuffix(got[0], "pwsh.exe") {
		t.Fatalf("pwsh should be preferred, got %v", got)
	}
	if !strings.Contains(got[0], `C:\PF`) {
		t.Fatalf("ProgramFiles was not used: %v", got)
	}

	// 首选不存在 -> 返回兜底；全部不存在也要返回一个可交给 exec 去 PATH 找的名字
	if exe := firstExistingExecutable([]string{filepath.Join(t.TempDir(), "absent.exe"), "powershell.exe"}); exe != "powershell.exe" {
		t.Fatalf("expected fallback, got %q", exe)
	}
	if exe := firstExistingExecutable(nil); exe != "powershell.exe" {
		t.Fatalf("empty candidate list must still yield powershell.exe, got %q", exe)
	}
}

// trimSpace 是本地实现（避免为一个函数引入 strings），至少要行为正确。
func TestTrimSpaceLocal(t *testing.T) {
	cases := map[string]string{
		"":            "",
		"   ":         "",
		"a":           "a",
		"  a  ":       "a",
		"\t a \r\n":   "a",
		"a b":         "a b",
		"\n":          "",
		" C:\\PF\\x ": "C:\\PF\\x",
	}
	for in, want := range cases {
		if got := trimSpace(in); got != want {
			t.Errorf("trimSpace(%q) = %q, want %q", in, got, want)
		}
	}
}
