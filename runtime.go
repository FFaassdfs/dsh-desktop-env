package main

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Portable ("offline") release support.
//
// The normal install uses the globally installed npm package and resolves it
// through the `dsh` shim on PATH. A portable release instead ships its own
// runtime next to the exe:
//
//	dsh-desktop.exe
//	runtime\
//	  node.exe
//	  node_modules\@deepseek-ai\dsh\lib\bin.js
//
// Resolution order (most specific first): $DSH_DESKTOP_RUNTIME, <exeDir>\runtime,
// <exeDir>. When such a runtime is found the shell uses it and must NOT run the
// npm self-update (that would silently diverge from the shipped runtime).

// runtimeEnvOverride points at a runtime root explicitly (also used by tests).
const runtimeEnvOverride = "DSH_DESKTOP_RUNTIME"

var (
	runtimeEntryRel   = filepath.Join("node_modules", "@deepseek-ai", "dsh", "lib", "bin.js")
	runtimePackageRel = filepath.Join("node_modules", "@deepseek-ai", "dsh", "package.json")
)

// harnessRuntime is a self-contained harness runtime found on disk.
type harnessRuntime struct {
	Root    string
	NodeExe string
	Entry   string
	Package string
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

// portableRuntimeIn reports whether dir holds a complete portable runtime.
// nodeName is platform specific ("node.exe" on Windows, "node" elsewhere).
func portableRuntimeIn(dir, nodeName string) (harnessRuntime, bool) {
	if dir == "" {
		return harnessRuntime{}, false
	}
	rt := harnessRuntime{
		Root:    dir,
		NodeExe: filepath.Join(dir, nodeName),
		Entry:   filepath.Join(dir, runtimeEntryRel),
		Package: filepath.Join(dir, runtimePackageRel),
	}
	if !fileExists(rt.NodeExe) || !fileExists(rt.Entry) {
		return harnessRuntime{}, false
	}
	return rt, true
}

// runtimeCandidateDirs lists directories that may hold a portable runtime, most
// specific first. env is injected so the order is testable.
func runtimeCandidateDirs(exeDir string, env func(string) string) []string {
	dirs := make([]string, 0, 3)
	if env != nil {
		if v := strings.TrimSpace(env(runtimeEnvOverride)); v != "" {
			dirs = append(dirs, v)
		}
	}
	if exeDir != "" {
		dirs = append(dirs, filepath.Join(exeDir, "runtime"), exeDir)
	}
	return dirs
}

// findPortableRuntime returns the first complete portable runtime among dirs.
func findPortableRuntime(dirs []string, nodeName string) (harnessRuntime, bool) {
	for _, dir := range dirs {
		if rt, ok := portableRuntimeIn(dir, nodeName); ok {
			return rt, true
		}
	}
	return harnessRuntime{}, false
}

// executableDir returns the directory of the running executable ("" when unknown).
func executableDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exe)
}

// bundledRuntimeInUse returns the portable runtime this shell runs from, if any.
func bundledRuntimeInUse() (harnessRuntime, bool) {
	return findPortableRuntime(runtimeCandidateDirs(executableDir(), os.Getenv), runtimeNodeName())
}

// ---- portable self-update ----------------------------------------------------
//
// The portable package carries its own runtime, so "npm i -g" would be useless
// (nothing reads the global install). Instead the bundled npm installs the newer
// harness into a staging prefix next to the runtime, and the swap happens at the
// next start - nothing under the live runtime is touched while dsh is running.

// updateStagingDir is the npm prefix used to prepare a newer harness.
func updateStagingDir(runtimeRoot string) string {
	return filepath.Join(filepath.Dir(runtimeRoot), ".update")
}

// bundledNpmCLI returns the npm CLI entry shipped inside the runtime ("" if absent).
func bundledNpmCLI(runtimeRoot string) string {
	p := filepath.Join(runtimeRoot, "node_modules", "npm", "bin", "npm-cli.js")
	if !fileExists(p) {
		return ""
	}
	return p
}

// stagedRuntimeIn reports whether dir (an npm prefix) holds a complete harness.
func stagedRuntimeIn(dir string) (harnessRuntime, bool) {
	if dir == "" {
		return harnessRuntime{}, false
	}
	rt := harnessRuntime{
		Root:    dir,
		Entry:   filepath.Join(dir, runtimeEntryRel),
		Package: filepath.Join(dir, runtimePackageRel),
	}
	if !fileExists(rt.Entry) {
		return harnessRuntime{}, false
	}
	return rt, true
}

func dirExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && info.IsDir()
}

// runtimeBackupDir is where the replaced node_modules is kept for rollback.
func runtimeBackupDir(runtimeRoot string) string {
	return filepath.Join(runtimeRoot, "node_modules.old")
}

// swapRuntimeModules replaces <runtimeRoot>\node_modules with the staged one,
// keeping the previous tree at runtimeBackupDir for rollback. node.exe and the
// licence stay in place. Returns a rollback function.
func swapRuntimeModules(runtimeRoot, stagingRoot string) (func(), error) {
	live := filepath.Join(runtimeRoot, "node_modules")
	staged := filepath.Join(stagingRoot, "node_modules")
	if !dirExists(staged) {
		return nil, fmt.Errorf("staged node_modules missing: %s", staged)
	}
	backup := runtimeBackupDir(runtimeRoot)
	_ = os.RemoveAll(backup)
	if dirExists(live) {
		if err := os.Rename(live, backup); err != nil {
			return nil, fmt.Errorf("cannot move the current runtime aside: %w", err)
		}
	}
	if err := os.Rename(staged, live); err != nil {
		if dirExists(backup) {
			_ = os.Rename(backup, live)
		}
		return nil, fmt.Errorf("cannot install the staged runtime: %w", err)
	}
	rollback := func() {
		_ = os.RemoveAll(live)
		if dirExists(backup) {
			_ = os.Rename(backup, live)
		}
	}
	return rollback, nil
}

// cleanupRuntimeBackup drops the rollback copy once the new runtime is known good.
func cleanupRuntimeBackup(runtimeRoot string) {
	_ = os.RemoveAll(runtimeBackupDir(runtimeRoot))
}

// compareDshVersions compares dsh version strings such as "0.1.5-rc.2" or
// "0.1.6-alpha.2" and returns -1, 0 or +1. A release outranks a prerelease of the
// same numeric triple (0.1.5 > 0.1.5-rc.2). Shapes that do not parse fall back to
// a plain string comparison so callers never have to handle an error.
func compareDshVersions(a, b string) int {
	an, ap := splitVersion(a)
	bn, bp := splitVersion(b)
	if an == nil || bn == nil {
		return strings.Compare(a, b)
	}
	for i := 0; i < 3; i++ {
		if an[i] != bn[i] {
			if an[i] < bn[i] {
				return -1
			}
			return 1
		}
	}
	// Same numbers: no prerelease wins.
	if ap == "" && bp == "" {
		return 0
	}
	if ap == "" {
		return 1
	}
	if bp == "" {
		return -1
	}
	at, bt := strings.Split(ap, "."), strings.Split(bp, ".")
	for i := 0; i < len(at) && i < len(bt); i++ {
		ai, aErr := strconv.Atoi(at[i])
		bi, bErr := strconv.Atoi(bt[i])
		if aErr == nil && bErr == nil {
			if ai != bi {
				if ai < bi {
					return -1
				}
				return 1
			}
			continue
		}
		if c := strings.Compare(at[i], bt[i]); c != 0 {
			return c
		}
	}
	switch {
	case len(at) < len(bt):
		return -1
	case len(at) > len(bt):
		return 1
	}
	return 0
}

// splitVersion returns the numeric triple and the prerelease part ("" when none).
// A nil slice means the string does not look like a version at all.
func splitVersion(v string) ([]int, string) {
	v = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(v), "v"))
	if v == "" {
		return nil, ""
	}
	core, pre := v, ""
	if i := strings.IndexByte(v, '-'); i >= 0 {
		core, pre = v[:i], v[i+1:]
	} else if i := strings.IndexByte(v, '+'); i >= 0 {
		core = v[:i]
	}
	parts := strings.Split(core, ".")
	nums := make([]int, 0, 3)
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil, ""
		}
		nums = append(nums, n)
	}
	if len(nums) == 0 || len(nums) > 3 {
		return nil, ""
	}
	for len(nums) < 3 {
		nums = append(nums, 0)
	}
	return nums, pre
}

// ---- single-file runtime archive --------------------------------------------
//
// Copying an unpacked portable package means copying ~27k tiny files, which is
// slow on Windows (per-file overhead + antivirus). The release therefore ships
// the runtime as ONE file, runtime.zip, and the shell unpacks it on first start
// (once, ~30 s). See HANDOVER §27.11.

// runtimeArchiveName is the single-file runtime inside a portable package.
const runtimeArchiveName = "runtime.zip"

// runtimeArchivePath returns where the runtime archive lives for a package root.
func runtimeArchivePath(pkgRoot string) string {
	return filepath.Join(pkgRoot, runtimeArchiveName)
}

// needsRuntimeExtraction reports the archive path when a package still has to be
// unpacked: no usable runtime\ directory, but runtime.zip present.
func needsRuntimeExtraction(pkgRoot, nodeName string) (string, bool) {
	if _, ok := portableRuntimeIn(filepath.Join(pkgRoot, "runtime"), nodeName); ok {
		return "", false
	}
	archive := runtimeArchivePath(pkgRoot)
	if !fileExists(archive) {
		return "", false
	}
	return archive, true
}

// extractZip unpacks zipPath into destDir. Entry paths are validated so a
// malicious archive cannot write outside destDir (zip-slip). onProgress may be nil.
func extractZip(zipPath, destDir string, onProgress func(done, total int)) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()
	total := len(reader.File)
	for i, entry := range reader.File {
		if err := extractZipEntry(entry, destDir); err != nil {
			return fmt.Errorf("%s: %w", entry.Name, err)
		}
		if onProgress != nil {
			onProgress(i+1, total)
		}
	}
	return nil
}

func extractZipEntry(entry *zip.File, destDir string) error {
	name := strings.TrimPrefix(strings.ReplaceAll(entry.Name, "\\", "/"), "./")
	clean := filepath.Clean(filepath.FromSlash(name))
	if clean == "." || clean == "" {
		return nil
	}
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return fmt.Errorf("unsafe path in archive")
	}
	target := filepath.Join(destDir, clean)
	if rel, err := filepath.Rel(destDir, target); err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("entry escapes the destination directory")
	}
	if entry.FileInfo().IsDir() {
		return os.MkdirAll(target, 0o755)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	in, err := entry.Open()
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// installRuntimeFromArchive unpacks the package runtime archive into runtime\.
// The archive is unpacked into a temporary sibling first and only renamed into
// place when it is complete and usable, so an interrupted first start never
// leaves a half-extracted runtime behind.
func installRuntimeFromArchive(pkgRoot, nodeName string, onProgress func(done, total int)) error {
	archive, needed := needsRuntimeExtraction(pkgRoot, nodeName)
	if !needed {
		return nil
	}
	live := filepath.Join(pkgRoot, "runtime")
	tmp := filepath.Join(pkgRoot, ".runtime-extract")
	_ = os.RemoveAll(tmp)
	if err := os.MkdirAll(tmp, 0o755); err != nil {
		return err
	}
	if err := extractZip(archive, tmp, onProgress); err != nil {
		_ = os.RemoveAll(tmp)
		return err
	}
	if _, ok := portableRuntimeIn(tmp, nodeName); !ok {
		_ = os.RemoveAll(tmp)
		return fmt.Errorf("archive holds no usable runtime (missing %s or %s)", nodeName, runtimeEntryRel)
	}
	if dirExists(live) {
		_ = os.RemoveAll(live)
	}
	if err := os.Rename(tmp, live); err != nil {
		_ = os.RemoveAll(tmp)
		return err
	}
	return nil
}

// extractRuntimeRequested reports whether the CLI was asked to only unpack the
// runtime (used by install-offline.ps1 and by the release verification).
func extractRuntimeRequested(args []string) bool {
	for _, a := range args {
		if a == "--extract-runtime" {
			return true
		}
	}
	return false
}

// RunExtractRuntime unpacks the runtime next to the executable and returns an
// exit code. It does not start the GUI.
func RunExtractRuntime() int {
	pkgRoot := executableDir()
	if pkgRoot == "" {
		fmt.Println("cannot determine the executable directory")
		return 1
	}
	archive, needed := needsRuntimeExtraction(pkgRoot, runtimeNodeName())
	if !needed {
		if _, ok := portableRuntimeIn(filepath.Join(pkgRoot, "runtime"), runtimeNodeName()); ok {
			fmt.Println("runtime already extracted")
			return 0
		}
		fmt.Println("no " + runtimeArchiveName + " next to the executable (and no runtime directory)")
		return 1
	}
	fmt.Printf("extracting %s ...\n", archive)
	start := time.Now()
	if err := installRuntimeFromArchive(pkgRoot, runtimeNodeName(), nil); err != nil {
		fmt.Println("extraction failed:", err)
		return 1
	}
	fmt.Printf("runtime ready in %s\n", time.Since(start).Round(time.Second))
	return 0
}
