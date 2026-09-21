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

func TestUpdateStagingAndNpmHelpers(t *testing.T) {
	runtimeRoot := filepath.Join(t.TempDir(), "runtime")
	if err := os.MkdirAll(runtimeRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	staging := updateStagingDir(runtimeRoot)
	if staging != filepath.Join(filepath.Dir(runtimeRoot), ".update") {
		t.Errorf("staging dir = %q", staging)
	}

	// No npm bundled yet.
	if got := bundledNpmCLI(runtimeRoot); got != "" {
		t.Errorf("expected no npm CLI, got %q", got)
	}
	npmDir := filepath.Join(runtimeRoot, "node_modules", "npm", "bin")
	if err := os.MkdirAll(npmDir, 0o755); err != nil {
		t.Fatal(err)
	}
	npmCLI := filepath.Join(npmDir, "npm-cli.js")
	if err := os.WriteFile(npmCLI, []byte("// npm"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := bundledNpmCLI(runtimeRoot); got != npmCLI {
		t.Errorf("npm CLI = %q, want %q", got, npmCLI)
	}
}

func TestStagedRuntimeIn(t *testing.T) {
	staging := t.TempDir()
	if _, ok := stagedRuntimeIn(staging); ok {
		t.Errorf("empty staging dir must not count as a staged runtime")
	}
	if _, ok := stagedRuntimeIn(""); ok {
		t.Errorf("empty path must not count")
	}
	makeRuntime(t, staging, "node.exe", false, true) // manifest + entry, no node needed here
	rt, ok := stagedRuntimeIn(staging)
	if !ok {
		t.Fatalf("staged runtime with %s should be detected", runtimeEntryRel)
	}
	if rt.Entry != filepath.Join(staging, runtimeEntryRel) {
		t.Errorf("Entry = %q", rt.Entry)
	}
}

func TestSwapRuntimeModules_AndRollback(t *testing.T) {
	base := t.TempDir()
	runtimeRoot := filepath.Join(base, "runtime")
	staging := filepath.Join(base, ".update")

	// Current runtime: node.exe + a node_modules tree marked "old".
	live := filepath.Join(runtimeRoot, "node_modules", "@deepseek-ai", "dsh", "lib")
	if err := os.MkdirAll(live, 0o755); err != nil {
		t.Fatal(err)
	}
	oldMarker := filepath.Join(runtimeRoot, "node_modules", "marker.txt")
	if err := os.WriteFile(oldMarker, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(runtimeRoot, "node.exe"), []byte("node"), 0o644); err != nil {
		t.Fatal(err)
	}
	// Staged runtime: node_modules with a different marker.
	stagedNm := filepath.Join(staging, "node_modules")
	if err := os.MkdirAll(filepath.Join(stagedNm, "@deepseek-ai", "dsh", "lib"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stagedNm, "marker.txt"), []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Missing staged tree must fail without touching anything.
	if _, err := swapRuntimeModules(runtimeRoot, filepath.Join(base, "nope")); err == nil {
		t.Errorf("swap must fail when the staged node_modules is missing")
	}
	if data, err := os.ReadFile(oldMarker); err != nil || string(data) != "old" {
		t.Errorf("live tree must be untouched after a failed swap: %q %v", data, err)
	}

	rollback, err := swapRuntimeModules(runtimeRoot, staging)
	if err != nil {
		t.Fatalf("swap failed: %v", err)
	}
	if data, _ := os.ReadFile(filepath.Join(runtimeRoot, "node_modules", "marker.txt")); string(data) != "new" {
		t.Errorf("live tree should now be the staged one, got %q", data)
	}
	if _, err := os.Stat(filepath.Join(runtimeRoot, "node.exe")); err != nil {
		t.Errorf("node.exe must stay in place: %v", err)
	}
	if data, _ := os.ReadFile(filepath.Join(runtimeBackupDir(runtimeRoot), "marker.txt")); string(data) != "old" {
		t.Errorf("backup should hold the previous tree, got %q", data)
	}

	rollback()
	if data, _ := os.ReadFile(filepath.Join(runtimeRoot, "node_modules", "marker.txt")); string(data) != "old" {
		t.Errorf("rollback should restore the previous tree, got %q", data)
	}

	// Cleanup removes the backup only. The first swap consumed the staged tree
	// (it was moved into place), so stage it again before swapping a second time.
	if err := os.MkdirAll(filepath.Join(stagedNm, "@deepseek-ai", "dsh", "lib"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stagedNm, "marker.txt"), []byte("new2"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := swapRuntimeModules(runtimeRoot, staging); err != nil {
		t.Fatalf("second swap failed: %v", err)
	}
	if data, _ := os.ReadFile(filepath.Join(runtimeRoot, "node_modules", "marker.txt")); string(data) != "new2" {
		t.Errorf("live tree should be the re-staged one, got %q", data)
	}
	cleanupRuntimeBackup(runtimeRoot)
	if _, err := os.Stat(runtimeBackupDir(runtimeRoot)); !os.IsNotExist(err) {
		t.Errorf("backup should be gone after cleanup")
	}
	if _, err := os.Stat(filepath.Join(runtimeRoot, "node_modules", "marker.txt")); err != nil {
		t.Errorf("live tree must survive cleanup: %v", err)
	}
}

func TestCompareDshVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"0.1.5-rc.2", "0.1.5-rc.2", 0},
		{"0.1.5-rc.2", "0.1.5-rc.1", 1},
		{"0.1.5-rc.1", "0.1.5-rc.2", -1},
		{"0.1.5", "0.1.5-rc.2", 1},  // a release outranks its prerelease
		{"0.1.5-rc.2", "0.1.5", -1}, // and the reverse
		{"0.1.6-alpha.2", "0.1.5-rc.2", 1},
		{"0.1.6-alpha.2", "0.1.6-alpha.10", -1},
		{"0.2", "0.1.9", 1},
		{"v0.1.5-rc.2", "0.1.5-rc.2", 0}, // leading v is tolerated
		{"1.0.0+build.5", "1.0.0", 0},    // build metadata is ignored
	}
	for _, tc := range cases {
		if got := compareDshVersions(tc.a, tc.b); got != tc.want {
			t.Errorf("compareDshVersions(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
		if got := compareDshVersions(tc.b, tc.a); got != -tc.want {
			t.Errorf("compareDshVersions(%q, %q) = %d, want %d (symmetry)", tc.b, tc.a, got, -tc.want)
		}
	}
	// Unparseable input must not panic and must be deterministic.
	for _, bad := range []string{"", "dev", "main", "0.1.x"} {
		first := compareDshVersions(bad, "0.1.5-rc.2")
		if second := compareDshVersions(bad, "0.1.5-rc.2"); first != second {
			t.Errorf("compare of %q is not deterministic", bad)
		}
	}
}

func TestFirstLine(t *testing.T) {
	cases := []struct{ in, want string }{
		{"1.2.3\n", "1.2.3"},
		{"\n\n  x  \n y", "x"},
		{"", ""},
		{"   ", ""},
	}
	for _, tc := range cases {
		if got := firstLine(tc.in); got != tc.want {
			t.Errorf("firstLine(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
