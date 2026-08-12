package notices

import (
	"bytes"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// The notices are generated, so the failure mode is a stale or truncated file
// rather than a compile error. These read them off disk, which works on every
// platform — the embed itself is Windows-only and validated by cross-compiling.
func read(t *testing.T, name string) []byte {
	t.Helper()
	body, err := os.ReadFile(name)
	if err != nil {
		t.Fatalf("%s missing — regenerate with: task general:cache-dep-licenses (%v)", name, err)
	}
	return body
}

func TestGeneratedNoticesArePresentAndPlausible(t *testing.T) {
	for _, name := range []string{"go-dependencies.txt", "npm-dependencies.txt"} {
		body := read(t, name)

		if len(body) < 50_000 {
			t.Errorf("%s is only %d bytes — hundreds of packages cannot fit in that", name, len(body))
		}
		for _, want := range []string{"Packages:", "Distinct licences:", "Licence: ", "Covers:"} {
			if !bytes.Contains(body, []byte(want)) {
				t.Errorf("%s has no %q section — was it produced by generate_dependency_notices.sh?", name, want)
			}
		}
	}
}

// Attribution turns on the licence text being present, not just its name.
func TestNoticesCarryActualLicenceText(t *testing.T) {
	for _, name := range []string{"go-dependencies.txt", "npm-dependencies.txt"} {
		body := read(t, name)
		if !bytes.Contains(body, []byte("Permission is hereby granted, free of charge")) {
			t.Errorf("%s contains no MIT licence text", name)
		}
		if !bytes.Contains(body, []byte("Apache License")) {
			t.Errorf("%s contains no Apache-2.0 licence text", name)
		}
	}
}

// The vendored assets are the ones with no manifest, so nothing else would
// notice their absence — assert they are actually attributed.
func TestVendoredAssetsAreAttributed(t *testing.T) {
	body := read(t, "vendored-assets.txt")

	// seti-ui file icons, MIT.
	if !bytes.Contains(body, []byte("seti-ui")) {
		t.Error("seti-ui is vendored into the frontend but absent from vendored-assets.txt")
	}
	if !bytes.Contains(body, []byte("Permission is hereby granted, free of charge")) {
		t.Error("vendored-assets.txt carries no MIT licence text for seti-ui")
	}

	// noto-emoji SVGs (OFL 1.1) and the public-domain region flags.
	if !bytes.Contains(body, []byte("noto-emoji")) {
		t.Error("noto-emoji is embedded via internal/emoji but absent from vendored-assets.txt")
	}
	if !bytes.Contains(body, []byte("SIL OPEN FONT LICENSE")) {
		t.Error("vendored-assets.txt carries no OFL text for noto-emoji")
	}
	if !bytes.Contains(body, []byte("region-flags")) && !bytes.Contains(body, []byte("region flags")) {
		t.Error("the noto-emoji region flags are absent from vendored-assets.txt")
	}

	// The socket.io browser bundle (MIT), vendored from jsDelivr — a separate
	// copy from the npm-installed socket.io-client, so the npm notice does not
	// cover it.
	if !bytes.Contains(body, []byte("socket.io-client")) {
		t.Error("the vendored socket.io browser bundle is absent from vendored-assets.txt")
	}
}

// scripts/ship_notices.sh copies every *.txt in this directory into the
// distributions; the Windows embed writes exactly FileNames. The two sets must
// be identical or the packaged and embedded deliveries drift apart.
func TestFileNamesMatchWhatPackagingShips(t *testing.T) {
	found, err := filepath.Glob("*.txt")
	if err != nil {
		t.Fatalf("Glob: %v", err)
	}

	declared := append([]string(nil), FileNames...)
	sort.Strings(found)
	sort.Strings(declared)

	if len(found) != len(declared) {
		t.Fatalf("packaging would ship %v but FileNames declares %v", found, declared)
	}
	for i := range found {
		if found[i] != declared[i] {
			t.Errorf("packaging would ship %v but FileNames declares %v", found, declared)
			break
		}
	}
}
