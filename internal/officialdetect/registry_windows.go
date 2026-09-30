//go:build windows

// Windows registry reader for the detection package.
//
// It is a read-only walk over the three uninstall roots: the per-user hive (which
// is where the official installer writes - measured 2026-09-30, InstallLocation
// D:\dshdesktopnew under HKCU), the machine hive, and the 32-bit view of the
// machine hive. Values are read with DoNotExpandEnvironmentNames for Path-like
// values where that matters; for InstallLocation the usual string read is enough
// because the installer writes it expanded (measured).
package officialdetect

import (
	"errors"
	"strings"

	"golang.org/x/sys/windows/registry"
)

// WinRegistry reads uninstall entries from the real registry.
type WinRegistry struct{}

// NewRegistry returns the production registry source.
func NewRegistry() RegistrySource { return WinRegistry{} }

type uninstallRoot struct {
	key         registry.Key
	path        string
	userInstall bool
}

// UninstallEntries implements RegistrySource.
func (WinRegistry) UninstallEntries() ([]RegistryEntry, error) {
	roots := []uninstallRoot{
		{registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall`, true},
		{registry.LOCAL_MACHINE, `Software\Microsoft\Windows\CurrentVersion\Uninstall`, false},
		{registry.LOCAL_MACHINE, `Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`, false},
	}
	var entries []RegistryEntry
	var problems []string
	for _, root := range roots {
		found, err := readRoot(root)
		if err != nil {
			// A missing or unreadable hive is not fatal: the assistant only needs
			// one hit, and the caller renders the note.
			problems = append(problems, err.Error())
			continue
		}
		entries = append(entries, found...)
	}
	if len(entries) == 0 && len(problems) > 0 {
		return nil, errors.New(strings.Join(problems, "; "))
	}
	return entries, nil
}

func readRoot(root uninstallRoot) ([]RegistryEntry, error) {
	key, err := registry.OpenKey(root.key, root.path, registry.READ)
	if err != nil {
		return nil, err
	}
	defer key.Close()
	names, err := key.ReadSubKeyNames(-1)
	if err != nil {
		return nil, err
	}
	var entries []RegistryEntry
	for _, name := range names {
		sub, err := registry.OpenKey(key, name, registry.READ)
		if err != nil {
			continue
		}
		entry := readEntry(sub, root, name)
		sub.Close()
		if entry.DisplayName != "" {
			entries = append(entries, entry)
		}
	}
	return entries, nil
}

func readEntry(key registry.Key, root uninstallRoot, name string) RegistryEntry {
	return RegistryEntry{
		DisplayName:     readString(key, "DisplayName"),
		DisplayVersion:  readString(key, "DisplayVersion"),
		Publisher:       readString(key, "Publisher"),
		InstallLocation: readString(key, "InstallLocation"),
		UninstallString: readString(key, "UninstallString"),
		KeyPath:         root.path + `\` + name,
		UserInstall:     root.userInstall,
	}
}

func readString(key registry.Key, name string) string {
	value, _, err := key.GetStringValue(name)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}
