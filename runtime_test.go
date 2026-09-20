package main

import (
	"os"
	"path/filepath"
	"testing"
)

// makeRuntime lays out a fake portable runtime and returns its root.
func makeRuntime(t *testing.T, root, nodeName string, withNode, withEntry bool) string {
	t.Helper()
	entryDir := filepath.Join(root, "node_modules", "@deepseek-ai", "dsh", "lib")
	if err := os.MkdirAll(entryDir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", entryDir, err)
	}
	if withEntry {
		if err := os.WriteFile(filepath.Join(entryDir, "bin.js"), []byte("// entry"), 0o644); err != nil {
			t.Fatalf("write entry: %v", err)
		}
	}
	if err := os.WriteFile(
		filepath.Join(root, "node_modules", "@deepseek-ai", "dsh", "package.json"),
		[]byte(`{"name":"@deepseek-ai/dsh","version":"9.9.9"}`), 0o644); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
	if withNode {
		if err := os.WriteFile(filepath.Join(root, nodeName), []byte("fake node"), 0o644); err != nil {
			t.Fatalf("write node: %v", err)
		}
	}
	return root
}

func TestPortableRuntimeIn_RequiresNodeAndEntry(t *testing.T) {
	const node = "node.exe"

	complete := makeRuntime(t, filepath.Join(t.TempDir(), "rt"), node, true, true)
	rt, ok := portableRuntimeIn(complete, node)
	if !ok {
		t.Fatalf("complete runtime not detected")
	}
	if rt.Root != complete {
		t.Errorf("Root = %q, want %q", rt.Root, complete)
	}
	if rt.NodeExe != filepath.Join(complete, node) {
		t.Errorf("NodeExe = %q", rt.NodeExe)
	}
	if rt.Entry != filepath.Join(complete, runtimeEntryRel) {
		t.Errorf("Entry = %q", rt.Entry)
	}
	if rt.Package != filepath.Join(complete, runtimePackageRel) {
		t.Errorf("Package = %q", rt.Package)
	}

	noNode := makeRuntime(t, filepath.Join(t.TempDir(), "rt"), node, false, true)
	if _, ok := portableRuntimeIn(noNode, node); ok {
		t.Errorf("runtime without the node executable must not be accepted")
	}

	noEntry := makeRuntime(t, filepath.Join(t.TempDir(), "rt"), node, true, false)
	if _, ok := portableRuntimeIn(noEntry, node); ok {
		t.Errorf("runtime without the dsh entry must not be accepted")
	}

	if _, ok := portableRuntimeIn("", node); ok {
		t.Errorf("empty dir must not be accepted")
	}
	if _, ok := portableRuntimeIn(filepath.Join(t.TempDir(), "missing"), node); ok {
		t.Errorf("missing dir must not be accepted")
	}
}

func TestRuntimeCandidateDirs_OrderAndOverrides(t *testing.T) {
	exeDir := `C:\app\current`
	env := func(k string) string {
		if k == runtimeEnvOverride {
			return `  D:\explicit\rt  `
		}
		return ""
	}
	got := runtimeCandidateDirs(exeDir, env)
	want := []string{`D:\explicit\rt`, filepath.Join(exeDir, "runtime"), exeDir}
	if len(got) != len(want) {
		t.Fatalf("got %d dirs, want %d: %v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("dir[%d] = %q, want %q", i, got[i], want[i])
		}
	}

	// No override: exe-relative candidates only.
	got = runtimeCandidateDirs(exeDir, func(string) string { return "" })
	if len(got) != 2 || got[0] != filepath.Join(exeDir, "runtime") || got[1] != exeDir {
		t.Errorf("without override got %v", got)
	}

	// Unknown exe dir: only the override remains.
	got = runtimeCandidateDirs("", env)
	if len(got) != 1 || got[0] != `D:\explicit\rt` {
		t.Errorf("with empty exeDir got %v", got)
	}

	// No candidates at all.
	if got := runtimeCandidateDirs("", nil); len(got) != 0 {
		t.Errorf("expected no candidates, got %v", got)
	}
}

func TestFindPortableRuntime_PrefersFirstComplete(t *testing.T) {
	const node = "node.exe"
	base := t.TempDir()

	// First candidate exists but is incomplete, second is complete.
	incomplete := filepath.Join(base, "incomplete")
	if err := os.MkdirAll(incomplete, 0o755); err != nil {
		t.Fatal(err)
	}
	complete := makeRuntime(t, filepath.Join(base, "complete"), node, true, true)

	rt, ok := findPortableRuntime([]string{incomplete, complete}, node)
	if !ok {
		t.Fatalf("expected the complete runtime to be found")
	}
	if rt.Root != complete {
		t.Errorf("Root = %q, want %q", rt.Root, complete)
	}

	if _, ok := findPortableRuntime([]string{incomplete}, node); ok {
		t.Errorf("no complete runtime should be reported")
	}
	if _, ok := findPortableRuntime(nil, node); ok {
		t.Errorf("nil dirs should report nothing")
	}
}

func TestVersionFromPackageJSON(t *testing.T) {
	dir := t.TempDir()
	good := filepath.Join(dir, "package.json")
	if err := os.WriteFile(good, []byte(`{"name":"x","version":"1.2.3-rc.4"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := versionFromPackageJSON(good); got != "1.2.3-rc.4" {
		t.Errorf("version = %q", got)
	}
	if got := versionFromPackageJSON(filepath.Join(dir, "missing.json")); got != "" {
		t.Errorf("missing file should give empty string, got %q", got)
	}
	bad := filepath.Join(dir, "bad.json")
	if err := os.WriteFile(bad, []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := versionFromPackageJSON(bad); got != "" {
		t.Errorf("invalid json should give empty string, got %q", got)
	}
}

func TestExecutableDirIsSetInTests(t *testing.T) {
	if executableDir() == "" {
		t.Fatalf("executableDir() should resolve the test binary directory")
	}
}

func TestBundledRuntimeInUse_HonoursEnvOverride(t *testing.T) {
	const node = "node.exe"
	root := makeRuntime(t, filepath.Join(t.TempDir(), "rt"), node, true, true)
	t.Setenv(runtimeEnvOverride, root)

	rt, ok := bundledRuntimeInUse()
	if !ok {
		t.Fatalf("bundledRuntimeInUse should find the override runtime")
	}
	if rt.Root != root {
		t.Errorf("Root = %q, want %q", rt.Root, root)
	}
	if v := versionFromPackageJSON(rt.Package); v != "9.9.9" {
		t.Errorf("bundled manifest version = %q, want 9.9.9", v)
	}
}

func TestBundledRuntimeInUse_NoOverrideNoRuntime(t *testing.T) {
	t.Setenv(runtimeEnvOverride, "")
	if _, ok := bundledRuntimeInUse(); ok {
		t.Errorf("test binary has no runtime/ next to it, so nothing should be found")
	}
}
