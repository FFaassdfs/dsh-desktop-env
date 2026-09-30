package main

import (
	"os"
	"runtime"
	"strings"
	"testing"
)

// withTempConfigDir 把"用户配置目录"指到临时目录，返回它。
// os.UserConfigDir() 在 Windows 看 %AppData%，Linux 看 $XDG_CONFIG_HOME，macOS 看 $HOME。
func withTempConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	switch runtime.GOOS {
	case "windows":
		t.Setenv("AppData", dir)
	default:
		t.Setenv("XDG_CONFIG_HOME", dir)
		t.Setenv("HOME", dir)
	}
	return dir
}

func TestNormalizeRegistry(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", ""},
		{"   ", ""},
		{"https://registry.npmmirror.com", "https://registry.npmmirror.com"},
		{"https://registry.npmmirror.com/", "https://registry.npmmirror.com"},
		{"http://npm.internal.corp:4873/", "http://npm.internal.corp:4873"},
		{"registry.npmjs.org", ""}, // 没有 scheme ⇒ 拒绝（视为官方）
		{"ftp://example.com", ""},  // 非 http(s) ⇒ 拒绝
		{"https://a b.com", ""},    // 含空格 ⇒ 拒绝
		{"  https://x.example/  ", "https://x.example"},
	}
	for _, c := range cases {
		if got := normalizeRegistry(c.in); got != c.want {
			t.Errorf("normalizeRegistry(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestRegistryAttempts(t *testing.T) {
	cases := []struct {
		name       string
		configured string
		autoMirror bool
		want       []string
	}{
		{"官方 + 回退开", "", true, []string{"", registryNpmmirror}},
		{"官方 + 回退关", "", false, []string{""}},
		{"淘宝 + 回退开（不重复）", registryNpmmirror, true, []string{registryNpmmirror}},
		{"自定义 + 回退开", "https://npm.corp.example/", true, []string{"https://npm.corp.example", registryNpmmirror}},
		{"自定义 + 回退关", "https://npm.corp.example/", false, []string{"https://npm.corp.example"}},
	}
	for _, c := range cases {
		got := registryAttempts(c.configured, c.autoMirror)
		if strings.Join(got, "|") != strings.Join(c.want, "|") {
			t.Errorf("%s: registryAttempts(%q,%v) = %v, want %v", c.name, c.configured, c.autoMirror, got, c.want)
		}
	}
}

func TestNpmRegistryArgs(t *testing.T) {
	if a := npmRegistryArgs(""); a != nil {
		t.Errorf("官方源不应追加任何 npm 参数（保持用户 npm 配置），得到 %v", a)
	}
	got := npmRegistryArgs(registryNpmmirror + "/")
	if len(got) != 1 || got[0] != "--registry="+registryNpmmirror {
		t.Errorf("镜像源应追加 --registry=…，得到 %v", got)
	}
}

// 官方那次必须有更紧的超时/重试预算，否则被墙时要等十几分钟才轮到回退。
func TestNpmFetchBudget(t *testing.T) {
	official := strings.Join(npmFetchBudgetArgs(""), " ")
	if !strings.Contains(official, "fetch-timeout=") || !strings.Contains(official, "fetch-retries=") {
		t.Errorf("官方源应同时限制超时与重试，得到 %q", official)
	}
	mirror := strings.Join(npmFetchBudgetArgs(registryNpmmirror), " ")
	if !strings.Contains(mirror, "fetch-timeout=") || strings.Contains(mirror, "fetch-retries=") {
		t.Errorf("镜像源只放宽超时、不再压低重试，得到 %q", mirror)
	}
	if officialFetchTimeoutMS >= mirrorFetchTimeoutMS {
		t.Errorf("官方源超时(%d)应远小于镜像源(%d)", officialFetchTimeoutMS, mirrorFetchTimeoutMS)
	}
}

func TestInstallWithRegistryFallback(t *testing.T) {
	// 第一次就成功 ⇒ 返回配置的源，且不尝试第二次
	tried := 0
	used, err := installWithRegistryFallback([]string{"", registryNpmmirror}, func(string) error {
		tried++
		return nil
	})
	if err != nil || used != "" || tried != 1 {
		t.Errorf("首个源成功时：used=%q err=%v tried=%d", used, err, tried)
	}

	// 官方失败 ⇒ 回退到淘宝，并回报"用的是淘宝"
	tried = 0
	used, err = installWithRegistryFallback([]string{"", registryNpmmirror}, func(registry string) error {
		tried++
		if registry == "" {
			return os.ErrDeadlineExceeded
		}
		return nil
	})
	if err != nil {
		t.Fatalf("回退应成功，得到 %v", err)
	}
	if used != registryNpmmirror {
		t.Errorf("应回报实际使用的淘宝镜像，得到 %q", used)
	}
	if tried != 2 {
		t.Errorf("应尝试两次，实际 %d", tried)
	}

	// 全部失败 ⇒ 返回最后一个错误，且 used 为空
	tried = 0
	used, err = installWithRegistryFallback([]string{"", registryNpmmirror}, func(string) error {
		tried++
		return os.ErrPermission
	})
	if err == nil || used != "" || tried != 2 {
		t.Errorf("全部失败时：used=%q err=%v tried=%d", used, err, tried)
	}

	// 空列表也要能跑（视为官方源一次）
	used, err = installWithRegistryFallback(nil, func(registry string) error {
		if registry != "" {
			t.Errorf("空列表应退化成官方源一次，得到 %q", registry)
		}
		return nil
	})
	if err != nil || used != "" {
		t.Errorf("空列表：used=%q err=%v", used, err)
	}
}

func TestCoreFeedSaveLoadRoundTrip(t *testing.T) {
	withTempConfigDir(t)
	a := &App{}

	// 默认：官方源 + 开启回退
	f := loadCoreFeed()
	if f.Registry != "" || !f.AutoMirror {
		t.Fatalf("默认配置应为官方源且开启回退，得到 %+v", f)
	}
	if p := coreFeedPath(); !strings.Contains(p, "dsh-desktop") {
		t.Errorf("配置文件应落在 dsh-desktop 目录下，得到 %s", p)
	}

	// 保存淘宝 + 关回退 ⇒ 落盘并能读回
	if msg := a.SetCoreFeed(registryNpmmirror+"/", false); !strings.Contains(msg, "已保存") {
		t.Errorf("保存返回：%q", msg)
	}
	f = loadCoreFeed()
	if f.Registry != registryNpmmirror || f.AutoMirror {
		t.Errorf("读回配置不符：%+v", f)
	}
	if _, err := os.Stat(coreFeedPath()); err != nil {
		t.Errorf("配置文件应存在：%v", err)
	}

	// 非法值被拒绝且不写盘
	if msg := a.SetCoreFeed("registry.npmjs.org", true); !strings.Contains(msg, "未保存") {
		t.Errorf("非法源应被拒绝，得到 %q", msg)
	}
	if f = loadCoreFeed(); f.Registry != registryNpmmirror {
		t.Errorf("非法值不应覆盖已保存的配置，得到 %+v", f)
	}
}

func TestCoreFeedStatusReportsLastUsed(t *testing.T) {
	withTempConfigDir(t)
	a := &App{}

	v := a.CoreFeedStatus()
	if v.Registry != "" || !v.AutoMirror || v.Used != "" {
		t.Fatalf("初始状态不符：%+v", v)
	}
	if !strings.Contains(v.Note, "淘宝") {
		t.Errorf("默认说明应提到自动回退，得到 %q", v.Note)
	}

	a.noteRegistryUsed(registryNpmmirror)
	v = a.CoreFeedStatus()
	if v.Used != "淘宝镜像" {
		t.Errorf("应报告上次实际使用的源，得到 %q", v.Used)
	}
	if !strings.Contains(v.Note, "上次实际使用") {
		t.Errorf("说明里应带上「上次实际使用」，得到 %q", v.Note)
	}

	// 自定义源 + 关回退
	_ = a.SetCoreFeed("https://npm.corp.example", false)
	v = a.CoreFeedStatus()
	if !strings.Contains(v.Note, "https://npm.corp.example") {
		t.Errorf("自定义源说明不符：%q", v.Note)
	}
	if strings.Contains(v.Note, "自动改用淘宝") {
		t.Errorf("关掉回退后不该再提自动回退：%q", v.Note)
	}
}

func TestRegistryDocURL(t *testing.T) {
	if got := registryDocURL(""); got != "https://registry.npmjs.org/@deepseek-ai%2Fdsh" {
		t.Errorf("官方文档地址不符：%s", got)
	}
	want := registryNpmmirror + "/@deepseek-ai%2Fdsh"
	if got := registryDocURL(registryNpmmirror + "/"); got != want {
		t.Errorf("镜像文档地址 = %s，want %s", got, want)
	}
}
