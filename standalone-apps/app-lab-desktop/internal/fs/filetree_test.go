package fs

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestBuildFileTree_DeepEqual(t *testing.T) {
	path := "./testdata/my_app"
	got, err := BuildFileTree(os.DirFS(path), []string{"fileToIgnore.txt"})
	if err != nil {
		t.Fatalf("BuildFileTree failed: %v", err)
	}

	expectedJSON, err := os.ReadFile("./testdata/expected_tree.json")
	if err != nil {
		t.Fatalf("Failed to read expected.json: %v", err)
	}

	var expected FSNode
	if err := json.Unmarshal(expectedJSON, &expected); err != nil {
		t.Fatalf("Failed to unmarshal expected JSON: %v", err)
	}

	deepCompareTree(t, got, &expected)
}

func deepCompareTree(t *testing.T, got, expected *FSNode) {
	t.Helper()

	if got == nil || expected == nil {
		if got != expected {
			t.Errorf("Node mismatch: one is nil\nGot: %v\nExpected: %v", got, expected)
		}
		return
	}

	if got.Name != expected.Name {
		t.Errorf("Name mismatch\nGot: %s\nExpected: %s", got.Name, expected.Name)
	}
	if got.Path != expected.Path {
		t.Errorf("Path mismatch\nGot: %s\nExpected: %s", got.Path, expected.Path)
	}
	if got.IsDir != expected.IsDir {
		t.Errorf("IsDir mismatch\nGot: %v\nExpected: %v", got.IsDir, expected.IsDir)
	}
	if (got.Extension == nil) != (expected.Extension == nil) ||
		(got.Extension != nil && *got.Extension != *expected.Extension) {
		t.Errorf("Extension mismatch\n\tGot: %v\n\tExpected: %v", got.Extension, expected.Extension)
	}
	if (got.MimeType == nil) != (expected.MimeType == nil) ||
		(got.MimeType != nil && *got.MimeType != *expected.MimeType) {
		t.Errorf("MimeType mismatch\n\tGot: %v\n\tExpected: %v", got.MimeType, expected.MimeType)
	}

	// Variable fields, only check is got is correct format
	if got.CreatedAt == "" {
		t.Errorf("CreatedAt is empty on node %s", got.Path)
	}
	_, errCreatedAt := time.Parse(time.RFC3339, got.CreatedAt)
	if errCreatedAt != nil {
		t.Errorf("CreatedAt is not in RFC3339 format on node %s: %v", got.Path, errCreatedAt)
	}

	if got.ModifiedAt == "" {
		t.Errorf("ModifiedAt is empty on node %s", got.Path)
	}
	_, errModifiedAt := time.Parse(time.RFC3339, got.ModifiedAt)
	if errModifiedAt != nil {
		t.Errorf("ModifiedAt is not in RFC3339 format on node %s: %v", got.Path, errModifiedAt)
	}

	if got.Size < 0 {
		t.Errorf("Invalid Size on node %s: %d", got.Path, got.Size)
	}

	// Children (deep recursion)
	if expected.Children == nil && got.Children != nil {
		t.Errorf("Unexpected children on node %s", got.Path)
	}
	if expected.Children != nil {
		if got.Children == nil {
			t.Errorf("Missing children on node %s", got.Path)
		} else if len(*got.Children) != len(*expected.Children) {
			t.Errorf("Children count mismatch on %s\nGot: %d\nExpected: %d", got.Path, len(*got.Children), len(*expected.Children))
		} else {
			for i := range *expected.Children {
				deepCompareTree(t, &(*got.Children)[i], &(*expected.Children)[i])
			}
		}
	}
}
