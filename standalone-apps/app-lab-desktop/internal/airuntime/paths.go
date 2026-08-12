// Path resolution for the per-agent runtime directory and Node archive names.

package airuntime

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// appDirName is the on-disk app-data folder (hyphenated, per the app's "arduino-app-lab" convention).
const appDirName = "arduino-app-lab"

// RuntimeDir returns the per-agent install directory under the OS app-data root.
func RuntimeDir(agent AgentID) (string, error) {
	root, err := appDataRoot()
	if err != nil {
		return "", err
	}
	return runtimeDirForRoot(root, agent), nil
}

// AppDataDir returns the app's data root (<os-app-data>/arduino-app-lab), parent of the runtime, workspace and settings.
func AppDataDir() (string, error) {
	root, err := appDataRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, appDirName), nil
}

// WorkspaceDir returns the shared AI workspace under the app-data root (sibling of ai-runtime).
func WorkspaceDir() (string, error) {
	root, err := appDataRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, appDirName, "ai-workspace"), nil
}

// MirrorRootDir returns the root holding all agent working-copy mirrors (used as the session cwd so every checkout is a subdir).
func MirrorRootDir() (string, error) {
	root, err := appDataRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, appDirName, "ai-mirror"), nil
}

// MirrorDir returns the local mirror dir for an agent working copy, keyed (e.g. by app id), under the mirror root.
func MirrorDir(key string) (string, error) {
	root, err := MirrorRootDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, key), nil
}

// NodeBinDir returns the directory holding node/npm after install.
func NodeBinDir(agent AgentID) (string, error) {
	rt, err := RuntimeDir(agent)
	if err != nil {
		return "", err
	}
	return nodeBinDirOf(rt), nil
}

// AgentBinDir returns <runtime>/bin, where the agent CLI shims are exposed.
func AgentBinDir(agent AgentID) (string, error) {
	rt, err := RuntimeDir(agent)
	if err != nil {
		return "", err
	}
	return agentBinDirOf(rt), nil
}

// AgentConfigDir returns <runtime>/config, the isolated per-agent config/credentials dir.
func AgentConfigDir(agent AgentID) (string, error) {
	rt, err := RuntimeDir(agent)
	if err != nil {
		return "", err
	}
	return agentConfigDirOf(rt), nil
}

// runtimeDirForRoot joins the runtime dir for a given app-data root.
func runtimeDirForRoot(root string, agent AgentID) string {
	return filepath.Join(root, appDirName, "ai-runtime", string(agent))
}

// nodeDirOf returns <runtime>/node.
func nodeDirOf(runtimeDir string) string { return filepath.Join(runtimeDir, "node") }

// nodeBinDirOf returns the node/npm bin dir (top level on Windows, bin/ elsewhere).
func nodeBinDirOf(runtimeDir string) string {
	if runtime.GOOS == "windows" {
		return nodeDirOf(runtimeDir)
	}
	return filepath.Join(runtimeDir, "node", "bin")
}

// agentBinDirOf returns <runtime>/bin.
func agentBinDirOf(runtimeDir string) string { return filepath.Join(runtimeDir, "bin") }

// agentConfigDirOf returns <runtime>/config.
func agentConfigDirOf(runtimeDir string) string { return filepath.Join(runtimeDir, "config") }

// npmCacheDirOf returns <runtime>/npm-cache, the private npm cache used by `npm ci`.
func npmCacheDirOf(runtimeDir string) string { return filepath.Join(runtimeDir, "npm-cache") }

// manifestPathOf returns <runtime>/version.json.
func manifestPathOf(runtimeDir string) string { return filepath.Join(runtimeDir, "version.json") }

// nodeBinExe returns the absolute path to the node executable.
func nodeBinExe(runtimeDir string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(nodeDirOf(runtimeDir), "node.exe")
	}
	return filepath.Join(nodeDirOf(runtimeDir), "bin", "node")
}

// appDataRoot returns the OS-appropriate app-data base directory.
func appDataRoot() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support"), nil
	case "windows":
		// Local (not Roaming): the runtime is large + machine-specific, matching arduino-cli.
		if v := os.Getenv("LOCALAPPDATA"); v != "" {
			return v, nil
		}
		return filepath.Join(home, "AppData", "Local"), nil
	default:
		if v := os.Getenv("XDG_DATA_HOME"); v != "" {
			return v, nil
		}
		return filepath.Join(home, ".local", "share"), nil
	}
}

// NodeArchive returns the Node archive filename, "<os>-<arch>" tag, and extension.
func NodeArchive(nodeVersion string) (filename, tag, ext string, err error) {
	arch := goarchToNodeArch(runtime.GOARCH)
	if arch == "" {
		return "", "", "", fmt.Errorf("unsupported architecture %q", runtime.GOARCH)
	}
	osTag := goosToNodeOS(runtime.GOOS)
	if osTag == "" {
		return "", "", "", fmt.Errorf("unsupported OS %q", runtime.GOOS)
	}
	tag = osTag + "-" + arch
	if runtime.GOOS == "windows" {
		ext = "zip"
	} else {
		ext = "tar.xz"
	}
	filename = fmt.Sprintf("node-%s-%s.%s", nodeVersion, tag, ext)
	return filename, tag, ext, nil
}

// goosToNodeOS maps GOOS to Node's OS token.
func goosToNodeOS(goos string) string {
	switch goos {
	case "darwin":
		return "darwin"
	case "linux":
		return "linux"
	case "windows":
		return "win"
	}
	return ""
}

// goarchToNodeArch maps GOARCH to Node's arch token.
func goarchToNodeArch(goarch string) string {
	switch goarch {
	case "amd64":
		return "x64"
	case "arm64":
		return "arm64"
	case "386":
		return "x86"
	}
	return ""
}
