package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func writeFileN(t *testing.T, path string, lines int) {
	t.Helper()
	var b strings.Builder
	for i := 1; i <= lines; i++ {
		b.WriteString("line-")
		b.WriteString(itoa(i))
		b.WriteString("-")
		b.WriteString(strings.Repeat("x", 40))
		b.WriteString("\n")
	}
	if err := os.WriteFile(path, []byte(b.String()), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var digits []byte
	for i > 0 {
		digits = append([]byte{byte('0' + i%10)}, digits...)
		i /= 10
	}
	return string(digits)
}

func TestRotateIfTooBig_RotatesAndReplacesPrevious(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dsh.log")

	// Missing file: no-op, no error.
	if err := rotateIfTooBig(path, 10); err != nil {
		t.Fatalf("missing file should be a no-op, got %v", err)
	}

	// Under the limit: no-op.
	writeFileN(t, path, 2)
	if err := rotateIfTooBig(path, 1<<20); err != nil {
		t.Fatalf("small file should not rotate: %v", err)
	}
	if _, err := os.Stat(path + ".1"); !os.IsNotExist(err) {
		t.Fatalf("small file must not create a rotation")
	}

	// Over the limit: renamed to .1 and the original disappears.
	writeFileN(t, path, 50)
	if err := rotateIfTooBig(path, 100); err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("original should be gone after rotation")
	}
	first, err := os.ReadFile(path + ".1")
	if err != nil {
		t.Fatalf("rotation missing: %v", err)
	}
	if !strings.Contains(string(first), "line-50-") {
		t.Fatalf("rotation lost content")
	}

	// A second rotation replaces the previous .1 instead of failing.
	writeFileN(t, path, 60)
	if err := rotateIfTooBig(path, 100); err != nil {
		t.Fatalf("second rotate: %v", err)
	}
	second, err := os.ReadFile(path + ".1")
	if err != nil {
		t.Fatalf("second rotation missing: %v", err)
	}
	if !strings.Contains(string(second), "line-60-") {
		t.Fatalf("second rotation should replace the first")
	}
}

func TestTailFile_ReturnsTailAtLineBoundary(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dsh.log")
	writeFileN(t, path, 200)

	const maxBytes = 300
	text, err := tailFile(path, maxBytes)
	if err != nil {
		t.Fatalf("tailFile: %v", err)
	}
	if len(text) == 0 {
		t.Fatalf("tailFile returned nothing")
	}
	if !strings.Contains(text, "line-200-") {
		t.Fatalf("tail must include the last line")
	}
	if strings.Contains(text, "line-1-") {
		t.Fatalf("tail must not include the head of the file")
	}
	// Every returned line must be a complete line (no torn fragment at the front).
	for _, line := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
		if !strings.HasPrefix(line, "line-") {
			t.Fatalf("torn line returned: %q", line)
		}
		if !strings.HasSuffix(line, strings.Repeat("x", 40)) {
			t.Fatalf("truncated line returned: %q", line)
		}
	}
}

func TestTailFile_SmallFileIsReturnedWhole(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "dsh.log")
	writeFileN(t, path, 3)

	text, err := tailFile(path, 1<<20)
	if err != nil {
		t.Fatalf("tailFile: %v", err)
	}
	if got := len(strings.Split(strings.TrimRight(text, "\n"), "\n")); got != 3 {
		t.Fatalf("expected 3 lines, got %d", got)
	}
}

func TestTailFile_MissingFileErrors(t *testing.T) {
	if _, err := tailFile(filepath.Join(t.TempDir(), "nope.log"), 100); err == nil {
		t.Fatalf("missing file must return an error")
	}
}

func TestLastLines(t *testing.T) {
	cases := []struct {
		name string
		in   string
		n    int
		want string
	}{
		{"fewer than n", "a\nb\n", 5, "a\nb"},
		{"exactly n", "a\nb\nc", 3, "a\nb\nc"},
		{"more than n", "a\nb\nc\nd", 2, "c\nd"},
		{"empty", "", 3, ""},
		{"only newlines", "\n\n", 3, ""},
		{"crlf", "a\r\nb\r\n", 1, "b"},
		{"zero n", "a\nb", 0, ""},
	}
	for _, tc := range cases {
		if got := lastLines(tc.in, tc.n); got != tc.want {
			t.Errorf("%s: lastLines(%q, %d) = %q, want %q", tc.name, tc.in, tc.n, got, tc.want)
		}
	}
}

func TestRestartBackoff_SequenceIsExponentialAndCapped(t *testing.T) {
	cases := []struct {
		n    int
		want time.Duration
	}{
		{0, restartBackoffBase}, // defensive: treated as first attempt
		{1, 15 * time.Second},
		{2, 45 * time.Second},
		{3, restartBackoffMax}, // 135s → capped at 2m
		{4, restartBackoffMax},
		{99, restartBackoffMax},
	}
	for _, tc := range cases {
		if got := restartBackoff(tc.n); got != tc.want {
			t.Errorf("restartBackoff(%d) = %s, want %s", tc.n, got, tc.want)
		}
	}
	// Monotonic non-decreasing.
	prev := time.Duration(0)
	for n := 1; n <= 10; n++ {
		got := restartBackoff(n)
		if got < prev {
			t.Fatalf("backoff decreased at n=%d: %s < %s", n, got, prev)
		}
		prev = got
	}
}
