//go:build !windows

// Non-Windows stub so the package still compiles (and its tests still run) on a
// developer machine that is not Windows. The assistant ships for Windows only.
package officialdetect

import "errors"

// WinRegistry is unavailable off Windows.
type WinRegistry struct{}

// NewRegistry returns a source that reports the platform limitation.
func NewRegistry() RegistrySource { return WinRegistry{} }

// UninstallEntries implements RegistrySource.
func (WinRegistry) UninstallEntries() ([]RegistryEntry, error) {
	return nil, errors.New("official desktop detection requires Windows")
}
