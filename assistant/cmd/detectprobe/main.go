// Command detectprobe prints what the assistant's detection package sees on THIS
// machine. It exists so the detection logic can be verified against the real
// installation before any UI is built, and so a support request can be answered
// with one paste-able block (handover §57 S1).
//
// Usage: go run ./assistant/cmd/detectprobe
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"dsh-desktop/internal/officialdetect"
)

func main() {
	ctx := context.Background()
	state, err := officialdetect.Detect(ctx, officialdetect.NewRegistry(), "")
	if err != nil {
		fmt.Fprintln(os.Stderr, "detect failed:", err)
		os.Exit(1)
	}
	// JSON on stdout: the UI binds the same struct, so this is also a fixture for
	// the shape the panel receives.
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(state); err != nil {
		fmt.Fprintln(os.Stderr, "encode failed:", err)
		os.Exit(1)
	}
}
