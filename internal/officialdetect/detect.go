// Package officialdetect finds the official DeepSeek Harness desktop app on this
// machine and reports what state its dsh profile is in.
//
// WHY THIS EXISTS (2026-09-30, HANDOVER §56/§57): the official Electron desktop
// app was released and it is now the place where work happens, while our own
// Wails web shell is frozen at desktop-v0.1.20. The assistant that replaced it
// must answer three questions without ever running a harness itself:
//
//  1. is the official app installed, which version, and where?
//  2. has its reserved profile ($DSH_HOME/profiles/desktop) been initialized,
//     i.e. has the app been started at least once? (We must not create it: that
//     profile belongs to the Electron app - see the injection notes below.)
//  3. is it running right now (its host serves an authenticated URL on 19387)?
//
// The detection is deliberately layered, because no single signal is reliable:
//   - the per-user uninstall entry (HKCU) is what a normal install writes
//     (measured: DisplayName "DeepSeek Harness 0.2.0-rc.2", InstallLocation
//     D:\dshdesktopnew, UninstallString "...\Uninstall DeepSeek Harness.exe"
//     /currentuser);
//   - the machine-wide entries (HKLM + WOW6432Node) cover an all-users install;
//   - a hand-unpacked (portable/green) copy has NO registry entry at all, so a
//     caller can pass a directory to verify by file signature instead.
//
// Every function here is READ-ONLY. Nothing in this package writes to the
// registry, to $DSH_HOME, or to the official installation.
package officialdetect

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// DownloadURL is the official installer link, provided by the user on
// 2026-09-30 (HANDOVER §57.4). The assistant only ever hands this to the system
// browser: this machine cannot resolve the host from a shell (curl answers 000),
// so the assistant must never try to download or verify it itself.
const DownloadURL = "https://download.deepseek.com/desktop/dsh-latest-windows-x64.exe"

// HostPort is the port the official app's bundled host serves on. Measured from
// the app's own host entry (HANDOVER §56.2): runProfile is started with
// "--port 19387" and the authenticated URL is reported back to Electron. The
// server answers 401 to a bare URL, exactly like our own shell does on 43080.
//
// It is a variable, not a constant, so a test can aim the running-probe at a
// listener it owns instead of depending on the machine's real state.
var HostPort = 19387

// File signature of an installation directory. The .exe is the Electron shell
// (244 MB); app.asar and resources/runtime come from the packaged app. All three
// are required, so a stray folder with a similarly named exe is not accepted.
var (
	requiredExe     = "DeepSeek Harness.exe"
	requiredAppAsar = filepath.Join("resources", "app.asar")
	// resources\runtime is a DIRECTORY (it holds bin/, cli/, pnpm/,
	// primary-runtime/, office-skills/). Checking it with a file test is the bug
	// the first version of this package shipped with; detect_test.go caught it.
	requiredRuntimeDir = filepath.Join("resources", "runtime")
	requiredVersions   = filepath.Join("resources", "runtime", "versions.json")
)

// Install describes one official desktop installation found on this machine.
type Install struct {
	// DisplayName / Version / Publisher come from the uninstall entry; they are
	// empty for an installation verified by directory signature only.
	DisplayName string `json:"displayName"`
	Version     string `json:"version"`
	Publisher   string `json:"publisher"`
	// Dir is the installation directory (InstallLocation for a registry install).
	Dir string `json:"dir"`
	// UninstallString is the registered uninstaller command, verbatim.
	UninstallString string `json:"uninstallString"`
	// UserInstall is true for an HKCU entry (per-user install). Measured: the
	// official installer is asInvoker and installs per user, so no UAC prompt.
	UserInstall bool `json:"userInstall"`
	// RegistryKey is the source key, kept for diagnostics.
	RegistryKey string `json:"registryKey"`
	// SignatureVerified is true when Dir holds the expected file layout.
	SignatureVerified bool `json:"signatureVerified"`
	// RuntimeVersion is the bundled dsh version read from
	// resources/runtime/primary-runtime/runtime.json ("desktopVersion").
	RuntimeVersion string `json:"runtimeVersion"`
	// ElectronVersion comes from the "version" file (e.g. "44.0.0").
	ElectronVersion string `json:"electronVersion"`
}

// State is the full picture the panel shows in card 1.
type State struct {
	// Installed is true when at least one installation was found.
	Installed bool `json:"installed"`
	// Installs lists every distinct installation directory found.
	Installs []Install `json:"installs"`
	// DownloadURL is the official installer link shown when nothing is installed.
	DownloadURL string `json:"downloadUrl"`
	// DSHHome is the harness home both the official app and our frozen shell use.
	DSHHome string `json:"dshHome"`
	// DesktopProfile is $DSH_HOME/profiles/desktop.
	DesktopProfile string `json:"desktopProfile"`
	// ProfileInitialized is true when that profile exists (the official app
	// creates it on first start). Our injector must not create it itself.
	ProfileInitialized bool `json:"profileInitialized"`
	// PatchEntries counts the loader insert entries in the profile's
	// cordis.patch.yml, split into ours and the app's own.
	PatchFile       string   `json:"patchFile"`
	OurPatchEntries []string `json:"ourPatchEntries"`
	AppPatchEntries []string `json:"appPatchEntries"`
	PatchReadError  string   `json:"patchReadError,omitempty"`
	// Running reports whether the official host is serving on HostPort.
	Running bool `json:"running"`
	// Port is HostPort (echoed so the UI never hardcodes it).
	Port int `json:"port"`
	// Notes are human-readable observations (e.g. "installed but never started").
	Notes []string `json:"notes"`
}

// RegistrySource supplies uninstall entries. It is an interface so the logic
// below can be tested without touching a real registry (see detect_test.go).
type RegistrySource interface {
	// UninstallEntries returns every application uninstall entry it can read,
	// from HKCU and HKLM (including the 32-bit view on 64-bit Windows).
	UninstallEntries() ([]RegistryEntry, error)
}

// RegistryEntry is one application uninstall record.
type RegistryEntry struct {
	DisplayName     string
	DisplayVersion  string
	Publisher       string
	InstallLocation string
	UninstallString string
	KeyPath         string
	UserInstall     bool
}

// displayNameMatch is the substring every official desktop uninstall entry
// carries. Measured 2026-09-30: "DeepSeek Harness 0.2.0-rc.2".
//
// Matching is exact-after-stripping-the-version, NOT a substring test: a
// substring test also matches unrelated products whose name merely starts with
// it (detect_test.go pins this with "DeepSeek Harness Chat").
const displayNameMatch = "DeepSeek Harness"

// matchesOfficialName reports whether a registry DisplayName belongs to the
// official desktop app. Accepted shapes: "DeepSeek Harness", "DeepSeek Harness
// <version>" (as written by the installer), optionally followed by a suffix that
// starts with a digit or 'v' (e.g. "-nightly") - but never a different product
// name such as "DeepSeek Harness Chat".
func matchesOfficialName(displayName string) bool {
	name := strings.TrimSpace(displayName)
	if !strings.HasPrefix(name, displayNameMatch) {
		return false
	}
	rest := strings.TrimSpace(strings.TrimPrefix(name, displayNameMatch))
	if rest == "" {
		return true
	}
	// Strip a separating dash and accept only a version-like remainder.
	rest = strings.TrimSpace(strings.TrimPrefix(rest, "-"))
	if rest == "" {
		return true
	}
	first := rest[0]
	return first >= '0' && first <= '9' || first == 'v' || first == 'V'
}

// Detect assembles the full state. registry and home may be nil/empty: a nil
// registry skips registry detection, an empty home uses $DSH_HOME (falling back
// to ~/.dsh, exactly like the harness itself does).
func Detect(ctx context.Context, registry RegistrySource, home string) (State, error) {
	state := State{DownloadURL: DownloadURL, Port: HostPort}

	dshHome, err := ResolveDSHHome(home)
	if err != nil {
		return state, err
	}
	state.DSHHome = dshHome
	state.DesktopProfile = filepath.Join(dshHome, "profiles", "desktop")
	state.ProfileInitialized = dirExists(state.DesktopProfile)

	// --- installations -------------------------------------------------------
	seen := map[string]bool{}
	if registry != nil {
		entries, err := registry.UninstallEntries()
		if err != nil {
			state.Notes = append(state.Notes, "读取注册表失败: "+err.Error())
		}
		for _, entry := range entries {
			if !matchesOfficialName(entry.DisplayName) {
				continue
			}
			dir := strings.TrimSpace(entry.InstallLocation)
			key := strings.ToLower(dir)
			if dir != "" && seen[key] {
				continue
			}
			if dir != "" {
				seen[key] = true
			}
			state.Installs = append(state.Installs, Install{
				DisplayName:       entry.DisplayName,
				Version:           entry.DisplayVersion,
				Publisher:         entry.Publisher,
				Dir:               dir,
				UninstallString:   entry.UninstallString,
				UserInstall:       entry.UserInstall,
				RegistryKey:       entry.KeyPath,
				SignatureVerified: dir != "" && VerifyDir(dir),
			})
		}
	}
	for i := range state.Installs {
		enrich(&state.Installs[i])
	}
	state.Installed = len(state.Installs) > 0

	// --- profile patch layer -------------------------------------------------
	patch := filepath.Join(state.DesktopProfile, "cordis.patch.yml")
	state.PatchFile = patch
	if text, err := os.ReadFile(patch); err == nil {
		state.OurPatchEntries, state.AppPatchEntries = splitPatchEntries(string(text), ourPatchIDs)
	} else if !os.IsNotExist(err) {
		state.PatchReadError = err.Error()
	}

	// --- running -------------------------------------------------------------
	state.Running = ProbePort(ctx, HostPort)

	// --- notes ---------------------------------------------------------------
	switch {
	case !state.Installed:
		state.Notes = append(state.Notes, "未检测到官方桌面版；点「打开下载页」获取官方安装包。")
	case len(state.Installs) > 0 && !state.ProfileInitialized:
		state.Notes = append(state.Notes,
			"已安装但尚未启动过：请先打开一次官方桌面版（它会创建 profiles\\desktop），然后再回来补插件。")
	}
	if state.Installed && state.ProfileInitialized && len(state.OurPatchEntries) == 0 {
		state.Notes = append(state.Notes, "官方 desktop profile 里还没有本地插件条目。")
	}
	return state, nil
}

// DetectDir verifies a caller-supplied directory (for a hand-unpacked copy that
// has no registry entry) and returns it as an Install when it matches.
func DetectDir(dir string) (Install, bool) {
	dir = strings.TrimSpace(dir)
	if dir == "" || !VerifyDir(dir) {
		return Install{}, false
	}
	install := Install{Dir: dir, SignatureVerified: true, DisplayName: "DeepSeek Harness (手动指定)"}
	enrich(&install)
	return install, true
}

// VerifyDir reports whether dir holds the official installation layout: the
// Electron shell, the packed app, and the packaged runtime tree.
func VerifyDir(dir string) bool {
	if !fileExists(filepath.Join(dir, requiredExe)) || !fileExists(filepath.Join(dir, requiredAppAsar)) {
		return false
	}
	if !dirExists(filepath.Join(dir, requiredRuntimeDir)) {
		return false
	}
	// versions.json pins the bundled Node/pnpm pair; its presence distinguishes a
	// real packaged runtime from an empty directory.
	return fileExists(filepath.Join(dir, requiredVersions))
}

// enrich fills the file-derived fields of an installation.
func enrich(install *Install) {
	if install.Dir == "" {
		return
	}
	install.SignatureVerified = VerifyDir(install.Dir)
	if !install.SignatureVerified {
		return
	}
	if b, err := os.ReadFile(filepath.Join(install.Dir, "version")); err == nil {
		install.ElectronVersion = strings.TrimSpace(string(b))
	}
	// desktopVersion lives in the packaged runtime manifest; it is the version of
	// the bundled harness, which is not the same number as the app version.
	if b, err := os.ReadFile(filepath.Join(install.Dir, "resources", "runtime", "primary-runtime", "runtime.json")); err == nil {
		install.RuntimeVersion = jsonStringField(string(b), "desktopVersion")
	}
}

// ourPatchIDs are the loader insert ids our installer writes. They are the
// contract between scripts/setup-plugins.mjs (frozen CLI path) and the
// assistant's own Go injector - keep the two in sync (HANDOVER §57.3).
var ourPatchIDs = []string{
	"plugin-core-version",
	"plugin-explainer",
	"plugin-model-capabilities",
	"plugin-model-sync",
	"plugin-project-explorer",
	"plugin-presets",
	"plugin-provider-presets",
}

// splitPatchEntries classifies the "id: <name>" markers of a cordis.patch.yml
// into ours and the app's own. It is intentionally a text scan rather than a
// YAML parse: the file is a patch list and the ids are the only thing we need,
// and a text scan cannot be broken by the `!!js` expressions the format allows.
func splitPatchEntries(text string, ours []string) (ourIDs, appIDs []string) {
	for _, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)
		// Match a list item ("- id: x") or an inline mapping key ("id: x").
		trimmed = strings.TrimPrefix(trimmed, "- ")
		if !strings.HasPrefix(trimmed, "id:") {
			continue
		}
		id := strings.TrimSpace(strings.TrimPrefix(trimmed, "id:"))
		id = strings.Trim(id, `'"`)
		if id == "" {
			continue
		}
		if contains(ours, id) {
			ourIDs = append(ourIDs, id)
			continue
		}
		appIDs = append(appIDs, id)
	}
	sort.Strings(ourIDs)
	sort.Strings(appIDs)
	return ourIDs, appIDs
}

// ResolveDSHHome mirrors @deepseek-ai/dsh-home-paths: an explicit path wins, then
// $DSH_HOME, then ~/.dsh. A blank or whitespace-only override is treated as
// unset, so a blank variable never resolves the home to the working directory
// (that mistake created a second home in the user profile twice - HANDOVER §46).
func ResolveDSHHome(configured string) (string, error) {
	if strings.TrimSpace(configured) != "" {
		return filepath.Abs(configured)
	}
	if env := strings.TrimSpace(os.Getenv("DSH_HOME")); env != "" {
		return filepath.Abs(env)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot resolve the user home: %w", err)
	}
	return filepath.Join(home, ".dsh"), nil
}

// ProbePort reports whether something is answering on 127.0.0.1:port. Any HTTP
// status counts as "running": the authenticated gate answers 401 to a bare URL
// (measured for both 19387 and our own 43080), and only a transport error means
// nothing is listening.
//
// The client must NOT use a proxy: Go's default transport honours HTTP_PROXY /
// HTTPS_PROXY from the environment, and on a machine behind a corporate proxy a
// loopback probe would be sent to the proxy and fail even though the local
// server is up. This box has PAC/proxy auto-discovery configured (it is what
// makes Invoke-RestMethod hang, HANDOVER §10.7), so a direct transport is the
// only correct choice here.
func ProbePort(ctx context.Context, port int) bool {
	client := &http.Client{
		Timeout:   1500 * time.Millisecond,
		Transport: &http.Transport{Proxy: nil},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://127.0.0.1:%d/", port), nil)
	if err != nil {
		return false
	}
	resp, err := client.Do(req)
	if err != nil {
		// A 401 arrives as a response, not an error; an error here means the
		// connection was refused or timed out, i.e. nothing is serving.
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode > 0
}

// --- small helpers ------------------------------------------------------------

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}
