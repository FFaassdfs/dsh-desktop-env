package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// 版本号的比较与解析由 runtime.go 的 compareDshVersions / splitVersion 提供
// （单一事实源，用例在 runtime_test.go 的 TestCompareDshVersions 里）。这里只测
// 本文件新增的通道归类、每通道取最新、选项构造与偏好落盘。

func TestCoreChannel(t *testing.T) {
	cases := map[string]string{
		"0.1.7-rc.1":    "rc",
		"0.1.7-alpha.2": "alpha",
		"0.1.6-beta.1":  "beta",
		"0.1.5":         "stable",
		"garbage":       "other",
	}
	for v, want := range cases {
		if got := coreChannel(v); got != want {
			t.Errorf("coreChannel(%q) = %q, want %q", v, got, want)
		}
	}
}

func TestCoreChannelEdges(t *testing.T) {
	// splitVersion 的宽容度决定了通道归类：带 v 前缀 / 两段版本 / 构建元数据
	if got := coreChannel("v0.1.7-rc.1"); got != "rc" {
		t.Errorf("a leading v should still classify as rc, got %q", got)
	}
	if got := coreChannel("0.1.7"); got != "stable" {
		t.Errorf("0.1.7 should be stable, got %q", got)
	}
	if got := coreChannel("0.1.7-rc.1+build.9"); got != "rc" {
		t.Errorf("build metadata should not confuse the channel, got %q", got)
	}
	if got := coreChannel("0.2"); got != "stable" {
		t.Errorf("a two-segment version is padded and stable, got %q", got)
	}
}

// registryFixture 造一份最小的 registry 文档：三个通道各若干版本 + 发布时间。
func registryFixture(t *testing.T) *registryDoc {
	t.Helper()
	versions := []string{
		"0.1.5-alpha.1", "0.1.5-rc.1", "0.1.5-rc.2", "0.1.5-rc.3",
		"0.1.6-alpha.1", "0.1.6-alpha.2", "0.1.7-alpha.1", "0.1.7-alpha.2",
		"0.1.7-rc.1", "0.1.4",
	}
	doc := &registryDoc{
		DistTags: map[string]string{"latest": "0.1.5-rc.3", "next": "0.1.7-rc.1", "alpha": "0.1.7-alpha.2"},
		Versions: map[string]json.RawMessage{},
		Time:     map[string]string{},
	}
	for i, v := range versions {
		doc.Versions[v] = json.RawMessage(`{"version":"` + v + `"}`)
		doc.Time[v] = "2026-09-2" + string(rune('0'+i%10)) + "T13:44:12.289Z"
	}
	return doc
}

func TestNewestPerChannel(t *testing.T) {
	newest := newestPerChannel(registryFixture(t))
	want := map[string]string{"stable": "0.1.4", "rc": "0.1.7-rc.1", "alpha": "0.1.7-alpha.2"}
	for ch, v := range want {
		if newest[ch] != v {
			t.Errorf("newest[%s] = %q, want %q", ch, newest[ch], v)
		}
	}
	if _, ok := newest["beta"]; ok {
		t.Error("no beta version exists, so no beta entry is expected")
	}
}

func TestBuildCoreOptions(t *testing.T) {
	doc := registryFixture(t)
	opts := buildCoreOptions(doc, "0.1.5-rc.2", "")

	// 展示顺序固定：stable → rc → beta → alpha（beta 不存在则跳过）
	if len(opts) != 3 {
		t.Fatalf("expected 3 options (stable/rc/alpha), got %d: %+v", len(opts), opts)
	}
	if opts[0].Channel != "stable" || opts[1].Channel != "rc" || opts[2].Channel != "alpha" {
		t.Errorf("unexpected channel order: %s, %s, %s", opts[0].Channel, opts[1].Channel, opts[2].Channel)
	}
	// 只有比当前新的才算 newer（stable 0.1.4 比 0.1.5-rc.2 旧）
	if opts[0].Newer {
		t.Errorf("stable %s should not be newer than 0.1.5-rc.2", opts[0].Version)
	}
	if !opts[1].Newer || !opts[2].Newer {
		t.Errorf("rc %s / alpha %s should both be newer than 0.1.5-rc.2", opts[1].Version, opts[2].Version)
	}
	// installed / skipped 标记
	if opts[1].Installed || opts[1].Skipped {
		t.Error("rc option should be neither installed nor skipped in this fixture")
	}
	opts2 := buildCoreOptions(doc, "0.1.7-rc.1", "0.1.7-alpha.2")
	if !opts2[1].Installed {
		t.Error("rc option should be marked installed")
	}
	if !opts2[2].Skipped {
		t.Error("alpha option should be marked skipped")
	}
	if opts2[1].Newer {
		t.Error("the installed version is not newer than itself")
	}
	// 发布时间被转成本地时间（能解析出来就非空）
	if opts[1].Published == "" {
		t.Error("published time should be rendered")
	}
}

func TestNewerChannelsSkipsSkipped(t *testing.T) {
	doc := registryFixture(t)
	// 跳过 rc 之后，只剩 alpha 可提示
	newer := newerChannels(doc, "0.1.5-rc.2", "0.1.7-rc.1")
	if len(newer) != 1 || newer[0].Version != "0.1.7-alpha.2" {
		t.Fatalf("expected only the alpha offer, got %+v", newer)
	}
	// 从新到旧排序：rc(0.1.7-rc.1) 在 alpha(0.1.7-alpha.2) 之前
	all := newerChannels(doc, "0.1.5-rc.2", "")
	if len(all) != 2 || all[0].Version != "0.1.7-rc.1" || all[1].Version != "0.1.7-alpha.2" {
		t.Fatalf("expected rc first then alpha, got %+v", all)
	}
	// 已是最新时没有任何提示
	if got := newerChannels(doc, "0.1.7-rc.1", ""); len(got) != 0 {
		t.Errorf("nothing should be offered when the newest is installed, got %+v", got)
	}
	// 用户手动装了更新的版本时，旧 latest 不会被当成"更新"（这正是以前会降级的场景）
	if got := newerChannels(doc, "0.1.7-rc.1", ""); len(got) != 0 {
		t.Errorf("0.1.5-rc.3 (dist-tags.latest) must not be offered as an update to 0.1.7-rc.1")
	}
}

func TestFormatRegistryTime(t *testing.T) {
	if got := formatRegistryTime("2026-09-23T13:44:12.289Z"); got == "" {
		t.Error("a valid RFC3339 timestamp should render")
	}
	if got := formatRegistryTime(""); got != "" {
		t.Errorf("empty input should render empty, got %q", got)
	}
	if got := formatRegistryTime("not a time"); got != "" {
		t.Errorf("unparseable time should render empty, got %q", got)
	}
}

// TestFetchRegistryLive 真的去 npm 取一次文档。单测不该依赖网络，所以默认跳过；
// 需要时显式打开：
//
//	$env:DSH_LIVE_REGISTRY="1"; go test -run TestFetchRegistryLive -v ./...
//
// 它验证的是本功能唯一的对外依赖：registry 文档的形状（dist-tags / versions / time）
// 以及"每通道取最新"在真实数据上的表现。
func TestFetchRegistryLive(t *testing.T) {
	if os.Getenv("DSH_LIVE_REGISTRY") == "" {
		t.Skip("set DSH_LIVE_REGISTRY=1 to query the npm registry")
	}
	doc, err := fetchRegistry()
	if err != nil {
		t.Fatalf("fetchRegistry: %v", err)
	}
	newest := newestPerChannel(doc)
	if len(newest) < 2 {
		t.Errorf("live registry should expose more than one channel, got %v", newest)
	}
	for _, ch := range channelOrder {
		if v, ok := newest[ch]; ok {
			t.Logf("channel %-6s -> %-16s published %s  (latest tag: %s)", ch, v, doc.Time[v], doc.DistTags["latest"])
		}
	}
	opts := buildCoreOptions(doc, "0.1.5-rc.2", "")
	if len(opts) == 0 {
		t.Fatal("no options built from the live registry")
	}
	for _, o := range opts {
		t.Logf("  offer %-6s %-16s published=%-16s installed=%-5v newer=%v",
			o.Channel, o.Version, o.Published, o.Installed, o.Newer)
	}
	// 真实数据下，"比 0.1.5-rc.2 新的通道" 必须至少有一个（否则选择器没有意义）
	if len(newerChannels(doc, "0.1.5-rc.2", "")) == 0 {
		t.Error("expected at least one newer channel than 0.1.5-rc.2")
	}
}

func TestUpdatePrefsRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "update.json")

	// 文件不存在：*From 变体把错误交给调用方，但偏好必须是空的
	// （容忍型包装 loadUpdatePrefs 才是吞掉错误的那个；测试只用 *To 变体，
	//  以免碰到用户真实的配置目录）
	p, err := loadUpdatePrefsFrom(path)
	if err == nil {
		t.Error("a missing file should be reported to the caller")
	}
	if p.SkippedCore != "" {
		t.Errorf("a missing file must still yield empty prefs, got %+v", p)
	}

	if err := saveUpdatePrefsTo(path, updatePrefs{SkippedCore: "0.1.7-rc.1"}); err != nil {
		t.Fatalf("save failed: %v", err)
	}
	p, err = loadUpdatePrefsFrom(path)
	if err != nil {
		t.Fatalf("load failed: %v", err)
	}
	if p.SkippedCore != "0.1.7-rc.1" {
		t.Errorf("skipped version round-tripped as %q", p.SkippedCore)
	}

	// 恢复提醒 = 写回空偏好（字段 omitempty，所以文件里不再出现该键）
	if err := saveUpdatePrefsTo(path, updatePrefs{}); err != nil {
		t.Fatalf("clear failed: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read back failed: %v", err)
	}
	if bytes.Contains(data, []byte("skippedCore")) {
		t.Errorf("cleared prefs should not carry the key any more, got %s", data)
	}
	p, _ = loadUpdatePrefsFrom(path)
	if p.SkippedCore != "" {
		t.Errorf("clearing should persist an empty skip, got %q", p.SkippedCore)
	}
}

// 跳过记录只在"出现更新的版本"时才该被忽略——这里直接对比较函数做一层确认，
// 因为 checkUpdates 的提示逻辑依赖它。
func TestSkipOnlyMasksTheExactVersion(t *testing.T) {
	if compareDshVersions("0.1.7-rc.1", "0.1.7-rc.1") != 0 {
		t.Fatal("same version must compare equal (skip must hide exactly this one)")
	}
	if compareDshVersions("0.1.7-rc.2", "0.1.7-rc.1") <= 0 {
		t.Fatal("a newer rc must outrank the skipped one, so the notice comes back")
	}
	if compareDshVersions("0.1.5-rc.3", "0.1.7-rc.1") >= 0 {
		t.Fatal("an older version must never be treated as an update")
	}
}
