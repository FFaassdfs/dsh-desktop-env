package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
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
