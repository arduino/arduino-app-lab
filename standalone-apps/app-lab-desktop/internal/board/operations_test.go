package board

import (
	"io/fs"
	"testing"
	"testing/fstest"

	"github.com/arduino/go-paths-helper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	semver "go.bug.st/relaxed-semver"
)

func embeddedEntries(t *testing.T, names ...string) []fs.DirEntry {
	fsys := fstest.MapFS{}
	for _, name := range names {
		fsys["resources_windows_amd64/"+name] = &fstest.MapFile{}
	}
	entries, err := fs.ReadDir(fsys, "resources_windows_amd64")
	require.NoError(t, err)
	return entries
}

func TestBundledToolVersion(t *testing.T) {
	entries := embeddedEntries(t,
		"adb_r32.0.0-windows.zip",
		"arduino-flasher-cli.exe",
		"mdns-discovery_v1.1.0_Windows_64bit.zip",
		"serial-discovery_v1.5.2_Windows_64bit.zip",
	)
	assert.Equal(t, "1.1.0", bundledToolVersion(entries, "mdns-discovery").String())
	assert.Equal(t, "1.5.2", bundledToolVersion(entries, "serial-discovery").String())
	assert.Nil(t, bundledToolVersion(entries, "ctags"))
}

func TestDiscoveriesUpToDate(t *testing.T) {
	entries := embeddedEntries(t,
		"mdns-discovery_v1.1.0_Windows_64bit.zip",
		"serial-discovery_v1.5.2_Windows_64bit.zip",
	)
	install := func(t *testing.T, dataDir *paths.Path, tool, version string) {
		require.NoError(t, dataDir.Join("packages", "builtin", "tools", tool, version).MkdirAll())
	}

	t.Run("fresh data dir", func(t *testing.T) {
		assert.False(t, discoveriesUpToDate(paths.New(t.TempDir()), entries))
	})

	t.Run("stale index and discoveries from old IDE", func(t *testing.T) {
		dataDir := paths.New(t.TempDir())
		require.NoError(t, dataDir.Join("package_index.json").WriteFile([]byte("{}")))
		install(t, dataDir, "mdns-discovery", "0.9.2")
		install(t, dataDir, "serial-discovery", "1.3.0-rc1")
		assert.False(t, discoveriesUpToDate(dataDir, entries))
	})

	t.Run("one discovery outdated", func(t *testing.T) {
		dataDir := paths.New(t.TempDir())
		install(t, dataDir, "mdns-discovery", "0.9.2")
		install(t, dataDir, "serial-discovery", "1.5.2")
		assert.False(t, discoveriesUpToDate(dataDir, entries))
	})

	t.Run("bundled versions installed alongside old ones", func(t *testing.T) {
		dataDir := paths.New(t.TempDir())
		install(t, dataDir, "mdns-discovery", "0.9.2")
		install(t, dataDir, "mdns-discovery", "1.1.0")
		install(t, dataDir, "serial-discovery", "1.5.2")
		assert.True(t, discoveriesUpToDate(dataDir, entries))
	})

	t.Run("newer than bundled", func(t *testing.T) {
		dataDir := paths.New(t.TempDir())
		install(t, dataDir, "mdns-discovery", "1.2.0")
		install(t, dataDir, "serial-discovery", "1.6.0")
		assert.True(t, discoveriesUpToDate(dataDir, entries))
	})
}

func TestToolInstalledAtLeast(t *testing.T) {
	toolDir := paths.New(t.TempDir())
	require.NoError(t, toolDir.Join("1.0.12").MkdirAll())
	require.NoError(t, toolDir.Join("1.1.0").WriteFile(nil))

	assert.True(t, toolInstalledAtLeast(toolDir, semver.MustParse("1.0.12")))
	assert.False(t, toolInstalledAtLeast(toolDir, semver.MustParse("1.1.0")))
	assert.False(t, toolInstalledAtLeast(toolDir.Join("missing"), semver.MustParse("1.0.0")))
}
