package notices

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// manifest mirrors the parts of internal/lsp/scripts/licenses.json this test needs.
type manifest struct {
	Components map[string]struct {
		SPDX     string `json:"spdx"`
		TextFile string `json:"text_file"`
	} `json:"components"`
}

func readManifest(t *testing.T) manifest {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("..", "lsp", "scripts", "licenses.json"))
	if err != nil {
		t.Fatalf("reading licenses.json: %v", err)
	}

	var m manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("parsing licenses.json: %v", err)
	}
	if len(m.Components) == 0 {
		t.Fatal("licenses.json declares no components")
	}
	return m
}

func embeddedLicenceNames(t *testing.T) []string {
	t.Helper()

	matches, err := fs.Glob(binaryLicensesFS, "licenses/*.txt")
	if err != nil {
		t.Fatalf("globbing embedded licences: %v", err)
	}

	var names []string
	for _, m := range matches {
		names = append(names, filepath.Base(m))
	}
	sort.Strings(names)
	return names
}

// The embedded set and the manifest must agree in both directions: a bundled
// binary with no licence is a redistribution problem, and an orphaned licence
// means we are shipping a notice for something we no longer bundle.
// download_licenses.sh only ever writes files, so orphans are the likelier slip.
func TestEmbeddedLicencesMatchManifest(t *testing.T) {
	m := readManifest(t)

	declared := map[string]string{} // text_file -> component
	for component, entry := range m.Components {
		if entry.TextFile == "" {
			t.Errorf("%s: licenses.json entry has no text_file", component)
			continue
		}
		if other, dup := declared[entry.TextFile]; dup {
			t.Errorf("%s and %s both claim text_file %q", other, component, entry.TextFile)
		}
		declared[entry.TextFile] = component
	}

	embedded := map[string]bool{}
	for _, name := range embeddedLicenceNames(t) {
		embedded[name] = true
	}

	for textFile, component := range declared {
		if !embedded[textFile] {
			t.Errorf("%s: %s is declared in licenses.json but not embedded — run internal/lsp/scripts/download_licenses.sh", component, textFile)
		}
	}
	for name := range embedded {
		if _, ok := declared[name]; !ok {
			t.Errorf("%s is embedded but no licenses.json entry claims it — stale file to delete?", name)
		}
	}
}

// A truncated or error-page "licence" is worse than none, because it looks
// discharged. Every text carries the header download_licenses.sh writes.
func TestEmbeddedLicencesLookLikeLicences(t *testing.T) {
	for _, name := range embeddedLicenceNames(t) {
		body, err := fs.ReadFile(binaryLicensesFS, "licenses/"+name)
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		if len(body) < 512 {
			t.Errorf("%s: only %d bytes — suspiciously short for a licence", name, len(body))
		}
		if !bytes.Contains(body, []byte("Component:")) {
			t.Errorf("%s: missing the 'Component:' provenance header", name)
		}
		if !bytes.Contains(body, []byte("Source:")) {
			t.Errorf("%s: missing the 'Source:' header that records corresponding source", name)
		}
	}
}

func TestWriteBinaryLicensesWritesEveryLicence(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "licenses")

	if err := WriteBinaryLicenses(dest); err != nil {
		t.Fatalf("WriteBinaryLicenses: %v", err)
	}

	for _, name := range embeddedLicenceNames(t) {
		want, err := fs.ReadFile(binaryLicensesFS, "licenses/"+name)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		got, err := os.ReadFile(filepath.Join(dest, name))
		if err != nil {
			t.Errorf("expected %s on disk: %v", name, err)
			continue
		}
		if string(got) != string(want) {
			t.Errorf("%s: written copy differs from the embedded original", name)
		}
	}
}

// WriteBinaryLicenses runs on every start, so it has to be safe over an
// existing directory.
func TestWriteBinaryLicensesIsRepeatable(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "licenses")

	if err := WriteBinaryLicenses(dest); err != nil {
		t.Fatalf("first WriteBinaryLicenses: %v", err)
	}
	if err := WriteBinaryLicenses(dest); err != nil {
		t.Fatalf("second WriteBinaryLicenses: %v", err)
	}

	// A stale text from a previous version must be replaced, not left as-is.
	name := embeddedLicenceNames(t)[0]
	if err := os.WriteFile(filepath.Join(dest, name), []byte("stale"), 0644); err != nil {
		t.Fatalf("seeding stale file: %v", err)
	}
	if err := WriteBinaryLicenses(dest); err != nil {
		t.Fatalf("third WriteBinaryLicenses: %v", err)
	}
	got, err := os.ReadFile(filepath.Join(dest, name))
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	if string(got) == "stale" {
		t.Errorf("%s: stale content survived WriteBinaryLicenses", name)
	}
}
