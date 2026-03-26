package fs

import (
	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"os"
	"path"
	"strings"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// ExtendedRemoteConn extends the base interface with directory operations
type ExtendedRemoteConn struct {
	remote.RemoteConn
}

// ReadDir reads the contents of a directory
func (c *ExtendedRemoteConn) ReadDir(path string) ([]remote.FileInfo, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var fileInfos []remote.FileInfo
	for _, entry := range entries {
		fileInfos = append(fileInfos, remote.FileInfo{
			Name: entry.Name(),
		})
	}

	return fileInfos, nil
}

// MoveDir moves a directory from oldPath to newPath
func (c *ExtendedRemoteConn) MoveDir(oldPath string, newPath string) error {
	return os.Rename(oldPath, newPath)
}

// NewExtendedRemoteConn creates an extended connection
func NewExtendedRemoteConn(baseConn remote.RemoteConn) *ExtendedRemoteConn {
	return &ExtendedRemoteConn{RemoteConn: baseConn}
}

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
		return err
	}
	return nil
}

func GetFileContent(p string, conn remote.RemoteConn) (string, error) {
	dir, file := path.Dir(p), path.Base(p)

	data, err := ReadFileContent(getFS(dir, conn), file)
	if err != nil {
		return "", err
	}

	mime := mime.TypeByExtension(path.Ext(p))

	if !strings.Contains(mime, "image") {
		return data, nil
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(data))

	return fmt.Sprintf("data:%s;base64,%s", mime, encoded), nil
}


func RenameFolder(conn remote.RemoteConn, oldPath string, newPath string) error {
	if path.Clean(oldPath) == path.Clean(newPath) {
		return nil
	}

	fmt.Printf("DEBUG: RenameFolder %s -> %s\n", oldPath, newPath)

	// Create extended connection for directory operations
	extConn := NewExtendedRemoteConn(conn)

	// Try to use MoveDir first (simpler approach)
	fmt.Printf("DEBUG: Trying MoveDir approach\n")
	err := extConn.MoveDir(oldPath, newPath)
	if err == nil {
		fmt.Printf("DEBUG: MoveDir succeeded\n")
		return nil
	}
	
	fmt.Printf("DEBUG: MoveDir failed: %v, falling back to copy/delete approach\n", err)

	// Fallback to create/copy/delete approach
	// 1. Create new directory
	err = extConn.MkDirAll(newPath)
	if err != nil {
		fmt.Printf("DEBUG: Failed to create new directory with remote conn: %v\n", err)

		// Fallback: try local filesystem if remote fails
		fmt.Printf("DEBUG: Trying fallback to local filesystem\n")
		err = os.MkdirAll(newPath, 0755)
		if err != nil {
			fmt.Printf("DEBUG: Failed to create new directory locally: %v\n", err)
			return fmt.Errorf("failed to create new directory: %w", err)
		}
	}

	// 2. Copy all contents from old to new directory
	err = copyDirectory(extConn, oldPath, newPath)
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

	return nil
}

func RemoveFile(conn remote.RemoteConn, path string) error {
	return conn.Remove(path)
}

func CreateFolder(conn remote.RemoteConn, path string) error {
	return conn.MkDirAll(path)
}
