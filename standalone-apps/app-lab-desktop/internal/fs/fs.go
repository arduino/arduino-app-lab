package fs

import (
	"context"
	"errors"
	"path/filepath"

	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"mime"
	"os"
	"path"
	"strings"
	"syscall"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"

	"app-lab-desktop/internal/hostread"
	"app-lab-desktop/internal/lsp"
)

func ReadFileContent(fss fs.FS, path string) (string, error) {
	f, err := fss.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func WriteFileContent(conn remote.RemoteConn, path string, content string) error {
	reader := strings.NewReader(content)
	err := conn.WriteFile(reader, path)
	if err != nil {
		if errors.Is(err, syscall.ENOSPC) {
			return fmt.Errorf("BOARD_STORAGE_FULL")
		}
		return err
	}

	// lsp
	if lsp.ShouldSyncRemoteFileToLspWorkspace(path) {
		lsp.SyncRemoteFileToLspWorkspace(path, strings.NewReader(content))
	}

	return nil
}

func GetFileContent(p string, conn remote.RemoteConn, hostReads *hostread.AllowSet) (string, error) {
	if strings.HasPrefix(p, lsp.FileScheme) {
		return getLocalFileContent(p, hostReads)
	}

	dir, file := path.Dir(p), path.Base(p)

	data, err := ReadFileContent(getFS(dir, conn), file)
	if err != nil {
		return "", err
	}

	// lsp
	if lsp.ShouldSyncRemoteFileToLspWorkspace(p) {
		lsp.SyncRemoteFileToLspWorkspace(p, strings.NewReader(data))
	}

	mime := mime.TypeByExtension(path.Ext(p))

	if !strings.Contains(mime, "image") {
		return data, nil
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(data))

	return fmt.Sprintf("data:%s;base64,%s", mime, encoded), nil
}

// isAllowedHostRead reports whether this session has a reason to read fileURI
// from the host. Reads are gated on intent the backend saw itself, because the
// webview can name any path it likes. Paths under the LSP workspace roots are
// let through unconditionally: they are already readable through
// GetLspWorkspaceFile, so gating them here would add no confinement.
func isAllowedHostRead(fileURI string, localPath string, hostReads *hostread.AllowSet) bool {
	return hostReads.Allows(fileURI) || lsp.IsAllowedLspFilePath(localPath)
}

func getLocalFileContent(fileURI string, hostReads *hostread.AllowSet) (string, error) {
	localPath, err := lsp.FileURIToLocalPath(fileURI)
	if err != nil {
		return "", err
	}

	if !isAllowedHostRead(fileURI, localPath, hostReads) {
		slog.Error("host read denied: file was not opened in this session", "path", localPath)
		return "", fmt.Errorf("access denied: %s was not opened in this session", localPath)
	}

	data, err := os.ReadFile(localPath)
	if err != nil {
		return "", err
	}

	mimeType := mime.TypeByExtension(path.Ext(localPath))

	if !strings.Contains(mimeType, "image") {
		return string(data), nil
	}

	encoded := base64.StdEncoding.EncodeToString(data)

	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded), nil
}

func RenameFolder(conn remote.RemoteConn, oldPath string, newPath string) error {
	if path.Clean(oldPath) == path.Clean(newPath) {
		return nil
	}

	// 1. Create new directory
	err := conn.MkDirAll(newPath)
	if err != nil {
		fmt.Printf("DEBUG: Failed to create new directory with remote conn: %v\n", err)
		return fmt.Errorf("failed to create new directory: %w", err)
	}

	// 2. Copy all contents from old to new directory
	err = copyDirectory(conn, oldPath, newPath)
	if err != nil {
		fmt.Printf("DEBUG: Failed to copy directory contents: %v\n", err)
		// Clean up the created directory if copy failed
		conn.Remove(newPath)
		os.RemoveAll(newPath) // Also clean up local fallback
		return fmt.Errorf("failed to copy directory contents: %w", err)
	}

	// 3. Remove old directory
	err = conn.Remove(oldPath)
	if err != nil {
		fmt.Printf("DEBUG: Failed to remove old directory with remote conn: %v\n", err)

		// Fallback: try local filesystem
		fmt.Printf("DEBUG: Trying fallback to local filesystem for removal\n")
		err = os.RemoveAll(oldPath)
		if err != nil {
			fmt.Printf("DEBUG: Failed to remove old directory locally: %v\n", err)
			return fmt.Errorf("failed to remove old directory: %w", err)
		}
	}

	fmt.Printf("DEBUG: RenameFolder completed successfully\n")
	return nil
}

// Helper function to copy directory contents using only remote connection methods
func copyDirectory(conn remote.RemoteConn, srcPath string, dstPath string) error {
	// Try to use the base connection's List method
	entries, err := conn.List(srcPath)
	if err != nil {
		return fmt.Errorf("failed to list directory: %w", err)
	}

	// Copy each entry
	for _, entry := range entries {
		srcEntryPath := path.Join(srcPath, entry.Name)
		dstEntryPath := path.Join(dstPath, entry.Name)

		// Try to determine if it's a directory by listing its contents
		// If conn.List() succeeds and returns entries, it's a directory
		subEntries, err := conn.List(srcEntryPath)
		if err == nil && len(subEntries) > 0 {
			// It's a directory (we can list its contents)

			// Create directory
			err = conn.MkDirAll(dstEntryPath)
			if err != nil {
				return fmt.Errorf("failed to create subdirectory %s: %w", dstEntryPath, err)
			}

			// Recursively copy directory contents
			err = copyDirectory(conn, srcEntryPath, dstEntryPath)
			if err != nil {
				return fmt.Errorf("failed to copy subdirectory %s: %w", entry.Name, err)
			}
		} else {
			// It's likely a file (either List failed or returned no entries)

			// Verify file actually exists before copying
			_, err := conn.Stats(srcEntryPath)
			if err != nil {
				// File doesn't exist, skip it (phantom file)
				continue
			}

			sourceFile, err := conn.ReadFile(srcEntryPath)
			if err != nil {
				return fmt.Errorf("failed to read file %s: %w", entry.Name, err)
			}
			defer sourceFile.Close()

			err = conn.WriteFile(sourceFile, dstEntryPath)
			if err != nil {
				return fmt.Errorf("failed to write file %s: %w", dstEntryPath, err)
			}
		}
	}

	return nil
}

func RenameFile(conn remote.RemoteConn, prevPath string, newPath string) error {
	if path.Clean(prevPath) == path.Clean(newPath) {
		return nil
	}

	sourceFile, err := conn.ReadFile(prevPath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	err = conn.WriteFile(sourceFile, newPath)
	if err != nil {
		return err
	}

	err = conn.Remove(prevPath)
	if err != nil {
		return err
	}

	// lsp
	if lsp.ShouldSyncRemoteFileToLspWorkspace(prevPath) {
		lsp.RenameWorkspaceFile(prevPath, newPath)
	}

	return nil
}

func RemoveFile(conn remote.RemoteConn, path string) error {
	if err := conn.Remove(path); err != nil {
		return err
	}

	// lsp
	if lsp.ShouldSyncRemoteFileToLspWorkspace(path) {
		lsp.RemoveWorkspaceFile(path)
	}

	return nil
}

func CreateFolder(conn remote.RemoteConn, path string) error {
	err := conn.MkDirAll(path)
	if err != nil {
		if errors.Is(err, syscall.ENOSPC) {
			return fmt.Errorf("BOARD_STORAGE_FULL")
		}
		return err
	}
	return nil
}

func IsDirectory(conn remote.RemoteConn, path string) (bool, error) {
	info, err := conn.Stats(path)
	if err != nil {
		return false, err
	}
	return info.IsDir, nil
}

func IsLocalDirectory(path string) (bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		return false, err
	}
	return info.IsDir(), nil
}

func SelectFilesDialog(ctx context.Context, conn remote.RemoteConn, remoteDir string, hostReads *hostread.AllowSet) ([]string, error) {
	filePaths, err := runtime.OpenMultipleFilesDialog(ctx, runtime.OpenDialogOptions{
		Title: "Select Files to Import",
	})

	if err != nil {
		return nil, err
	}

	if len(filePaths) == 0 {
		return nil, nil
	}

	// The user picked these in an OS dialog, so reading them back is intended.
	hostReads.Allow(filePaths...)

	return filePaths, nil
}

// ImportTargetPath returns the remote path an import will create for the given
// source and optional new name. Exposed so callers (e.g. watcher suppression)
// can reference the created path without repeating the naming rule.
func ImportTargetPath(remoteDir, localPath, newName string) string {
	name := filepath.Base(localPath)
	if newName != "" {
		name = newName
	}
	return path.Join(remoteDir, name)
}

// An import copies a host path onto the board, where it can then be read back
// through the ordinary board-file APIs - so it is a host read by another route
// and needs the same intent check as getLocalFileContent.
func checkHostImport(localPath string, hostReads *hostread.AllowSet) error {
	if hostReads.Allows(localPath) {
		return nil
	}
	slog.Error("host import denied: path was not selected in this session", "path", localPath)
	return fmt.Errorf("access denied: %s was not selected in this session", localPath)
}

func ImportFileToAppFromPath(ctx context.Context, conn remote.RemoteConn, remoteDir string, localPath string, newFileName string, hostReads *hostread.AllowSet) (string, error) {
	if err := checkHostImport(localPath, hostReads); err != nil {
		return "", err
	}

	ctx, cancelCtx := context.WithCancel(ctx)
	defer cancelCtx()
	cancelEvents := runtime.EventsOnce(ctx, "import-cancel", func(_ ...any) { cancelCtx() })
	defer cancelEvents()

	remotePath := ImportTargetPath(remoteDir, localPath, newFileName)
	if err := conn.Push(ctx, localPath, remotePath); err != nil {
		if errors.Is(err, context.Canceled) {
			_ = conn.Remove(remotePath)
			return "", fmt.Errorf("import-cancelled: %w", err)
		}
		if errors.Is(err, syscall.ENOSPC) {
			return "", fmt.Errorf("BOARD_STORAGE_FULL")
		}
		return "", fmt.Errorf("failed to import file: %w", err)
	}
	return remotePath, nil
}

func SelectFolderDialog(ctx context.Context, conn remote.RemoteConn, remoteDir string, hostReads *hostread.AllowSet) (string, error) {
	folderPath, err := runtime.OpenDirectoryDialog(ctx, runtime.OpenDialogOptions{
		Title: "Select Folder to Import",
	})

	if err != nil {
		return "", err
	}

	if folderPath == "" {
		return "", nil
	}

	// Only the folder itself is recorded, not its contents: importing it is the
	// user's intent, but that should not turn a pick of ~ into read access to
	// everything underneath.
	hostReads.Allow(folderPath)

	return folderPath, nil
}

func ImportFolderToAppFromPath(ctx context.Context, conn remote.RemoteConn, remoteDir string, localPath string, newFolderName string, hostReads *hostread.AllowSet) (string, error) {
	if err := checkHostImport(localPath, hostReads); err != nil {
		return "", err
	}

	ctx, cancelCtx := context.WithCancel(ctx)
	defer cancelCtx()

	cancelEvents := runtime.EventsOnce(ctx, "import-cancel", func(_ ...any) { cancelCtx() })
	defer cancelEvents()

	fileInfo, err := os.Stat(localPath)
	if err != nil {
		return "", err
	}
	if !fileInfo.IsDir() {
		return "", fmt.Errorf("cannot import file as a folder: %s", localPath)
	}

	targetBaseDir := ImportTargetPath(remoteDir, localPath, newFolderName)
	if err := conn.Push(ctx, localPath, targetBaseDir); err != nil {
		if errors.Is(err, context.Canceled) {
			_ = conn.Remove(targetBaseDir)
			return "", fmt.Errorf("import-cancelled: %w", err)
		}
		if errors.Is(err, syscall.ENOSPC) {
			return "", fmt.Errorf("BOARD_STORAGE_FULL")
		}
		return "", fmt.Errorf("failed to import folder: %w", err)
	}
	return targetBaseDir, nil
}
