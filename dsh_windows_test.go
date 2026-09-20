//go:build windows

package main

import (
	"path/filepath"
	"testing"
)

// The portable release relies on resolveDshWeb preferring the runtime shipped
// next to the exe. Only the file layout is inspected here (nothing is spawned),
// so the test can point the override at a fake runtime.
func TestResolveDshWeb_PrefersBundledRuntime(t *testing.T) {
	root := makeRuntime(t, filepath.Join(t.TempDir(), "rt"), "node.exe", true, true)
	t.Setenv(runtimeEnvOverride, root)

	exe, args, ok := resolveDshWeb()
	if !ok {
		t.Fatalf("resolveDshWeb should succeed with a bundled runtime")
	}
	if exe != filepath.Join(root, "node.exe") {
		t.Errorf("node = %q, want the bundled one", exe)
	}
	if len(args) < 5 {
		t.Fatalf("args = %v, want [entry web --no-open --port <port>]", args)
	}
	if args[0] != filepath.Join(root, runtimeEntryRel) {
		t.Errorf("args[0] = %q, want the bundled dsh entry", args[0])
	}
	if args[1] != "web" || args[2] != "--no-open" || args[3] != "--port" || args[4] != dshPort {
		t.Errorf("args = %v, want web --no-open --port %s", args, dshPort)
	}
}
