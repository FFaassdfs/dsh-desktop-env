package officialdetect

// Tests for the pure detection logic. The registry is injected, so these run
// without touching the real registry, and the file-system cases use a temp
// directory that mimics the official layout (HANDOVER §56.1).
//
// The two failure modes that matter most here are the ones that bit this project
// before: resolving the harness home to the WRONG place (a blank $DSH_HOME must
// never fall back to the working directory - that created a second home inside
// the user profile twice, HANDOVER §46), and trusting a lone .exe as "installed".

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// testProbePort is a port the suite binds itself; the running-probe test points
// HostPort at it so the result never depends on the machine's real state.
const testProbePort = 45997

var testListener net.Listener

// startProbeListener binds testProbePort once (and answers 401 to everything, the
// way the authenticated gate of both shells does).
func startProbeListener(t *testing.T) {
	t.Helper()
	if testListener != nil {
		return
	}
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", testProbePort))
	if err != nil {
		t.Skipf("cannot bind the probe port: %v", err)
	}
	testListener = listener
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			_, _ = conn.Write([]byte("HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n"))
			conn.Close()
		}
	}()
}

// fakeRegistry is the injected RegistrySource.
type fakeRegistry struct {
	entries []RegistryEntry
	err     error
}

func (f fakeRegistry) UninstallEntries() ([]RegistryEntry, error) { return f.entries, f.err }

// makeInstall creates a directory that passes VerifyDir.
func makeInstall(t *testing.T, dir, electronVersion, desktopVersion string) {
	t.Helper()
	for _, sub := range []string{"resources/runtime/primary-runtime"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", sub, err)
		}
	}
	files := map[string]string{
		"DeepSeek Harness.exe": "MZ fake",
		"version":              electronVersion,
		"resources/app.asar":   "asar",
	}
	for name, content := range files {
		write(t, filepath.Join(dir, name), content)
	}
	write(t, filepath.Join(dir, "resources/runtime/versions.json"), `{"node":"24.18.1"}`)
	write(t, filepath.Join(dir, "resources/runtime/primary-runtime/runtime.json"),
		`{"desktopVersion": "`+desktopVersion+`", "platform": "win32", "arch": "x64"}`)
}

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir for %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func TestDetectReportsInstalledAppWithFileDetails(t *testing.T) {
	dir := t.TempDir()
	makeInstall(t, dir, "44.0.0", "0.2.0-rc.2")
	home := t.TempDir()

	// The running-probe is exercised against a port this test actually owns, so
	// the assertion does not depend on whether the official app happens to be
	// running on the machine executing the suite.
	startProbeListener(t)
	restorePort := HostPort
	HostPort = testProbePort
	t.Cleanup(func() { HostPort = restorePort })

	state, err := Detect(context.Background(), fakeRegistry{entries: []RegistryEntry{{
		DisplayName:     "DeepSeek Harness 0.2.0-rc.2",
		DisplayVersion:  "0.2.0-rc.2",
		InstallLocation: dir,
		UninstallString: `"` + filepath.Join(dir, "Uninstall DeepSeek Harness.exe") + `" /currentuser`,
		UserInstall:     true,
	}}}, home)
	if err != nil {
		t.Fatalf("Detect: %v", err)
	}
	if !state.Installed || len(state.Installs) != 1 {
		t.Fatalf("expected exactly one install, got %+v", state.Installs)
	}
	got := state.Installs[0]
	if !got.SignatureVerified {
		t.Errorf("signature should verify for a full layout")
	}
	if got.ElectronVersion != "44.0.0" {
		t.Errorf("ElectronVersion = %q, want 44.0.0", got.ElectronVersion)
	}
	if got.RuntimeVersion != "0.2.0-rc.2" {
		t.Errorf("RuntimeVersion = %q, want 0.2.0-rc.2", got.RuntimeVersion)
	}
	if !got.UserInstall {
		t.Errorf("UserInstall should survive from the registry entry")
	}
	if !state.Running {
		t.Errorf("the test's own listener on the probe port should be reported as running")
	}
	if state.DownloadURL != DownloadURL {
		t.Errorf("DownloadURL = %q", state.DownloadURL)
	}
}

func TestDetectIgnoresUnrelatedUninstallEntries(t *testing.T) {
	home := t.TempDir()
	state, err := Detect(context.Background(), fakeRegistry{entries: []RegistryEntry{
		{DisplayName: "DeepSeek Harness Chat", InstallLocation: `C:\nope`},
		{DisplayName: "Something Else", InstallLocation: `C:\also-nope`},
	}}, home)
	if err != nil {
		t.Fatalf("Detect: %v", err)
	}
	if state.Installed {
		t.Fatalf("only entries matching %q may count, got %+v", displayNameMatch, state.Installs)
	}
}

func TestDetectNotesInstalledButNeverStarted(t *testing.T) {
	dir := t.TempDir()
	makeInstall(t, dir, "44.0.0", "0.2.0-rc.2")
	home := t.TempDir() // no profiles/desktop yet

	state, err := Detect(context.Background(), fakeRegistry{entries: []RegistryEntry{{
		DisplayName: "DeepSeek Harness 0.2.0-rc.2", InstallLocation: dir,
	}}}, home)
	if err != nil {
		t.Fatalf("Detect: %v", err)
	}
	if state.ProfileInitialized {
		t.Fatalf("profile must not be reported as initialized")
	}
	if !hasNote(state.Notes, "先打开一次官方桌面版") {
		t.Fatalf("expected the first-start hint, notes = %v", state.Notes)
	}
}

func TestDetectClassifiesPatchEntries(t *testing.T) {
	dir := t.TempDir()
	makeInstall(t, dir, "44.0.0", "0.2.0-rc.2")
	home := t.TempDir()
	write(t, filepath.Join(home, "profiles/desktop/cordis.patch.yml"), strings.Join([]string{
		"# Your patch layer for this dsh profile, applied after every bundle layer:",
		"- id: agent-default-model",
		`  name: "@deepseek-ai/dsh-agent-default-model"`,
		"- insert:",
		"    - id: plugin-core-version",
		"      name: 'dsh-client-ui-plugin-core-version'",
		"- insert:",
		"    - id: plugin-presets",
		"      name: 'dsh-client-ui-plugin-presets'",
		"",
	}, "\n"))

	state, err := Detect(context.Background(), fakeRegistry{entries: []RegistryEntry{{
		DisplayName: "DeepSeek Harness 0.2.0-rc.2", InstallLocation: dir,
	}}}, home)
	if err != nil {
		t.Fatalf("Detect: %v", err)
	}
	if !state.ProfileInitialized {
		t.Fatalf("profile should be detected once cordis.patch.yml exists")
	}
	if len(state.OurPatchEntries) != 2 {
		t.Errorf("OurPatchEntries = %v, want 2", state.OurPatchEntries)
	}
	if len(state.AppPatchEntries) != 1 || state.AppPatchEntries[0] != "agent-default-model" {
		t.Errorf("AppPatchEntries = %v, want [agent-default-model]", state.AppPatchEntries)
	}
}

func TestVerifyDirRejectsPartialLayout(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, requiredExe), "MZ")
	if VerifyDir(dir) {
		t.Fatalf("a lone exe must not verify")
	}
	if _, ok := DetectDir(dir); ok {
		t.Fatalf("DetectDir accepted a partial layout")
	}
	makeInstall(t, dir, "44.0.0", "0.2.0-rc.2")
	if !VerifyDir(dir) {
		t.Fatalf("full layout should verify")
	}
	if install, ok := DetectDir(dir); !ok || install.RuntimeVersion != "0.2.0-rc.2" {
		t.Fatalf("DetectDir = %+v, ok=%v", install, ok)
	}
}

func TestResolveDSHHomePrecedence(t *testing.T) {
	explicit := t.TempDir()
	got, err := ResolveDSHHome(explicit)
	if err != nil {
		t.Fatalf("ResolveDSHHome: %v", err)
	}
	if !samePath(got, explicit) {
		t.Errorf("explicit path must win: got %q want %q", got, explicit)
	}

	env := t.TempDir()
	t.Setenv("DSH_HOME", env)
	got, err = ResolveDSHHome("")
	if err != nil {
		t.Fatalf("ResolveDSHHome: %v", err)
	}
	if !samePath(got, env) {
		t.Errorf("$DSH_HOME must be used: got %q want %q", got, env)
	}

	// The regression that matters: a blank override must NOT resolve to the
	// working directory (that mistake created C:\Users\<user>\profiles, see
	// HANDOVER §46.4-3).
	t.Setenv("DSH_HOME", "   ")
	got, err = ResolveDSHHome("")
	if err != nil {
		t.Fatalf("ResolveDSHHome: %v", err)
	}
	wd, _ := os.Getwd()
	if samePath(got, wd) {
		t.Fatalf("blank $DSH_HOME resolved to the working directory: %q", got)
	}
	if !strings.HasSuffix(got, ".dsh") {
		t.Errorf("blank override should fall back to ~/.dsh, got %q", got)
	}
}

func TestJSONStringField(t *testing.T) {
	doc := `{"desktopVersion": "0.2.0-rc.2", "node": "24.21.0"}`
	if got := jsonStringField(doc, "desktopVersion"); got != "0.2.0-rc.2" {
		t.Errorf("desktopVersion = %q", got)
	}
	if got := jsonStringField(doc, "missing"); got != "" {
		t.Errorf("missing field should be empty, got %q", got)
	}
	if got := jsonStringField(`{"n": 5}`, "n"); got != "" {
		t.Errorf("non-string field should be empty, got %q", got)
	}
	if got := jsonStringField(`{"s": "a\"b"}`, "s"); got != `a"b` {
		t.Errorf("escaped quote = %q", got)
	}
}

func TestProbePortIsFalseWhenNothingListens(t *testing.T) {
	// Port 0 never accepts connections; the probe must report "not running"
	// rather than hanging or panicking.
	if ProbePort(context.Background(), 0) {
		t.Fatalf("port 0 must not be reported as running")
	}
}

func hasNote(notes []string, needle string) bool {
	for _, note := range notes {
		if strings.Contains(note, needle) {
			return true
		}
	}
	return false
}

func samePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}
