package main

import (
	"io"
	"os"
	"strings"
)

// Log maintenance helpers shared by the shell's own debug log and the captured
// dsh web log. Both files are appended for the whole lifetime of the launcher,
// so without rotation they grow without bound; and surfacing a startup failure
// must not read a multi-hundred-MB file just to show its last 20 lines.

// rotateIfTooBig renames path to "<path>.1" (replacing any previous rotation)
// once it grows past maxBytes. Best effort by design: callers ignore the error,
// because a log file briefly held open by another process must never block
// starting the harness.
func rotateIfTooBig(path string, maxBytes int64) error {
	info, err := os.Stat(path)
	if err != nil {
		return nil // nothing to rotate (missing file)
	}
	if info.Size() <= maxBytes {
		return nil
	}
	rotated := path + ".1"
	_ = os.Remove(rotated)
	return os.Rename(path, rotated)
}

// tailFile returns the last maxBytes of path. When the read starts mid-file it
// drops the first (necessarily partial) line, so the result always begins at a
// line boundary and never contains a torn multi-byte character at the front.
func tailFile(path string, maxBytes int64) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return "", err
	}
	var offset int64
	if size := info.Size(); size > maxBytes {
		offset = size - maxBytes
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return "", err
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return "", err
	}
	text := string(data)
	if offset > 0 {
		if i := strings.IndexByte(text, '\n'); i >= 0 {
			text = text[i+1:]
		}
	}
	return text, nil
}

// lastLines returns at most the final n lines of text (trailing newlines are
// ignored, so a file ending in "\n" does not yield a trailing empty line).
func lastLines(text string, n int) string {
	if n <= 0 {
		return ""
	}
	trimmed := strings.TrimRight(text, "\r\n")
	if trimmed == "" {
		return ""
	}
	lines := strings.Split(trimmed, "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
}
