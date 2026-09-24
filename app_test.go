package main

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

// TestMain 把用户配置目录指向临时目录。
//
// debugLog / dshLogPath / updatePrefs 都写"真实用户目录"，而测试会大量调用它们
// （尤其 versionFromPackageJSON、runtime 套件）——2026-09-24 实测：本机真实的
// debug.log 里有 **27% 是 go test 的噪音**，而那个文件恰恰是排查"新电脑启动失败"
// 时唯一能看到真相的地方。测试不该污染它。
func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "dsh-desktop-test-")
	if err == nil {
		// Windows 用 %AppData%，其他平台用 XDG_CONFIG_HOME，两个都隔离。
		_ = os.Setenv("AppData", dir)
		_ = os.Setenv("XDG_CONFIG_HOME", dir)
	}
	code := m.Run()
	if dir != "" {
		_ = os.RemoveAll(dir)
	}
	os.Exit(code)
}

// probeRuntimeNode 是"首次启动失败"诊断的第一道闸：它证明内置 node 到底能不能跑。
func TestProbeRuntimeNode(t *testing.T) {
	// 不存在的可执行文件必须报错，且错误里带上路径（否则用户不知道该看哪里）
	err := probeRuntimeNode("definitely-not-here-xyz.exe")
	if err == nil {
		t.Fatal("a missing node executable must be reported")
	}
	if !strings.Contains(err.Error(), "definitely-not-here-xyz.exe") {
		t.Errorf("the error should name the executable, got %v", err)
	}

	// 真 node（本机有就用真身的，验证成功路径）
	node, lookErr := exec.LookPath("node")
	if lookErr != nil {
		t.Skip("node not on PATH; only the failure path is covered here")
	}
	if err := probeRuntimeNode(node); err != nil {
		t.Errorf("probing a working node should succeed, got %v", err)
	}
}

func TestDshLogPath(t *testing.T) {
	p := dshLogPath()
	if p == "" {
		t.Fatal("dshLogPath must not be empty")
	}
	if !strings.Contains(p, "dsh-desktop") || !strings.HasSuffix(p, "dsh.log") {
		t.Errorf("unexpected log path: %s", p)
	}
}

// knownStartupFault 是"启动即崩"的分类器：命中的必须是真故障，且不能误伤
// 那些看起来相似、但处理方式完全相反的失败（端口冲突）。
func TestKnownStartupFault(t *testing.T) {
	// 命中：2026-09-24 事故 dsh.log 里的真实片段（逐字取自现场日志）
	real := "file:///D:/dsh-desktop/runtime/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:1112\n" +
		"\tif (hmr === void 0) throw new Error(`${binName}: user patch-layer watching requires the Cordis HMR service`);\n" +
		"Error: dsh: user patch-layer watching requires the Cordis HMR service\n" +
		"    at watchUserPatches (file:///D:/dsh-desktop/runtime/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:1112:28)\n" +
		"Node.js v24.20.0"
	hint := knownStartupFault(real)
	if hint == "" {
		t.Fatal("the HMR start-up fault must be recognised")
	}
	// 指引必须自带可操作的出路，否则等于没说
	for _, want := range []string{"0.1.7-rc.1", "重启服务", "cordis.patch.yml"} {
		if !strings.Contains(hint, want) {
			t.Errorf("the hint should mention %q, got:\n%s", want, hint)
		}
	}

	// 不命中：端口冲突在处理方式上与它相反，误判会把用户引向错误方向
	portErr := "Error: listen EACCES: permission denied 127.0.0.1:43080\n    at Server.setupListenHandle"
	if got := knownStartupFault(portErr); got != "" {
		t.Errorf("a port conflict must not be classified as the HMR fault, got:\n%s", got)
	}

	// 不命中：空日志 / 无关错误 / 只提到 HMR 但语句不同的情况
	for _, s := range []string{"", "Node.js v24.20.0", "Error: dsh: HMR service ready"} {
		if got := knownStartupFault(s); got != "" {
			t.Errorf("unexpected classification for %q: %s", s, got)
		}
	}
}
