package board

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

func TestIsWithinDir(t *testing.T) {
	tests := []struct {
		name   string
		target string
		dir    string
		want   bool
	}{
		{name: "the dir itself", target: "/apps", dir: "/apps", want: true},
		{name: "direct child", target: "/apps/foo", dir: "/apps", want: true},
		{name: "nested child", target: "/apps/foo/bar/baz", dir: "/apps", want: true},
		{name: "trailing slash on dir", target: "/apps/foo", dir: "/apps/", want: true},
		{name: "unclean but inside", target: "/apps/foo/../bar", dir: "/apps", want: true},
		{name: "parent", target: "/", dir: "/apps", want: false},
		{name: "sibling sharing the prefix", target: "/appsevil/foo", dir: "/apps", want: false},
		{name: "escapes via traversal", target: "/apps/../etc/passwd", dir: "/apps", want: false},
		{name: "unrelated absolute path", target: "/etc/passwd", dir: "/apps", want: false},
		{name: "relative path", target: "../etc/passwd", dir: "/apps", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsWithinDir(tt.target, tt.dir); got != tt.want {
				t.Errorf("IsWithinDir(%q, %q) = %v, want %v", tt.target, tt.dir, got, tt.want)
			}
		})
	}
}

func TestIsWithinAnyDir(t *testing.T) {
	dirs := []string{"/apps", "/var/lib/data"}

	if !IsWithinAnyDir("/var/lib/data/examples/blink", dirs) {
		t.Error("expected a path under the second root to be allowed")
	}
	if IsWithinAnyDir("/var/lib/other", dirs) {
		t.Error("expected a path outside every root to be rejected")
	}
	if IsWithinAnyDir("/apps/foo", nil) {
		t.Error("expected no roots to allow nothing")
	}
}

func TestDefaultAppFileRoots(t *testing.T) {
	roots := defaultAppFileRoots()
	if !slices.Contains(roots, AppsRootDir) {
		t.Errorf("defaultAppFileRoots() = %v, want it to contain the apps root %q", roots, AppsRootDir)
	}
	if !slices.Contains(roots, dataRootDir) {
		t.Errorf("defaultAppFileRoots() = %v, want it to contain the data root %q", roots, dataRootDir)
	}
}

// The arduino-app-cli environment configures the orchestrator, so off-board it
// describes this machine's dirs and says nothing about the board's.
func TestDefaultAppFileRootsIgnoresTheEnvironmentOffBoard(t *testing.T) {
	if IsSBC() {
		t.Skip("running on the board, where our environment is the orchestrator's")
	}

	t.Setenv(appsDirEnv, "/custom/apps")
	t.Setenv(dataDirEnv, "/custom/data")

	if got := defaultAppFileRoots(); !slices.Equal(got, []string{AppsRootDir, dataRootDir}) {
		t.Errorf("defaultAppFileRoots() = %v, want the board defaults", got)
	}
}

func TestFetchOrchestratorConfig(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/config" {
			t.Errorf("requested %q, want /v1/config", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"directories": {
				"apps": "/custom/apps",
				"data": "/custom/data",
				"examples": "/custom/data/examples"
			},
			"python_runner": "1.2.3"
		}`))
	}))
	t.Cleanup(server.Close)

	config, err := fetchOrchestratorConfig(context.Background(), server.URL)
	if err != nil {
		t.Fatalf("fetchOrchestratorConfig() failed: %v", err)
	}
	if config.Directories.Apps != "/custom/apps" {
		t.Errorf("apps dir = %q, want %q", config.Directories.Apps, "/custom/apps")
	}
	if config.Directories.Examples != "/custom/data/examples" {
		t.Errorf("examples dir = %q, want %q", config.Directories.Examples, "/custom/data/examples")
	}
	if config.PythonRunner != "1.2.3" {
		t.Errorf("python runner = %q, want %q", config.PythonRunner, "1.2.3")
	}
}

// An orchestrator that is not up yet must not be read as "no app dirs", which
// would deny every asset. The caller falls back to the defaults on an error.
func TestFetchOrchestratorConfigRejectsANonOKResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)

	if _, err := fetchOrchestratorConfig(context.Background(), server.URL); err == nil {
		t.Error("expected a non-OK response to be an error")
	}
}

func TestReportedAppFileRoots(t *testing.T) {
	tests := []struct {
		name                 string
		apps, data, examples string
		want                 []string
	}{
		{
			name:     "all three dirs",
			apps:     "/custom/apps",
			data:     "/custom/data",
			examples: "/custom/examples",
			want:     []string{"/custom/apps", "/custom/data", "/custom/examples"},
		},
		{
			name: "examples nested in data is still listed once each",
			apps: "/custom/apps",
			data: "/custom/data",
			// what the orchestrator reports in practice
			examples: "/custom/data/examples",
			want:     []string{"/custom/apps", "/custom/data", "/custom/data/examples"},
		},
		{
			name: "missing fields are skipped",
			apps: "/custom/apps",
			want: []string{"/custom/apps"},
		},
		{
			name: "duplicates collapse",
			apps: "/custom/apps",
			data: "/custom/apps/",
			want: []string{"/custom/apps"},
		},
		{
			name: "a relative dir cannot bound an absolute request path",
			apps: "custom/apps",
			data: "/custom/data",
			want: []string{"/custom/data"},
		},
		{
			name: "the filesystem root would confine nothing",
			apps: "/",
			data: "/custom/data",
			want: []string{"/custom/data"},
		},
		{
			name: "nothing usable reported",
			apps: "/",
			want: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var cfg orchestratorConfig
			cfg.Directories.Apps = tt.apps
			cfg.Directories.Data = tt.data
			cfg.Directories.Examples = tt.examples

			if got := reportedAppFileRoots(&cfg); !slices.Equal(got, tt.want) {
				t.Errorf("reportedAppFileRoots() = %v, want %v", got, tt.want)
			}
		})
	}
}
