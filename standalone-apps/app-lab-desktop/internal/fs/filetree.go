package fs

import (
	"io/fs"
	"mime"
	"path"
	"slices"
	"sort"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/arduino/arduino-app-cli/pkg/board/remotefs"
)

type FSNode struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Size       int64     `json:"size"`
	IsDir      bool      `json:"isDir"`
	CreatedAt  string    `json:"createdAt,omitempty"`
	ModifiedAt string    `json:"modifiedAt,omitempty"`
	Extension  *string   `json:"extension,omitempty"`
	MimeType   *string   `json:"mimeType,omitempty"`
	Children   *[]FSNode `json:"children,omitempty"`
}

func getFS(path string, conn remote.RemoteConn) fs.FS {
	return remotefs.New(path, conn)
}

func BuildFileTree(fs fs.FS, ignorePatterns []string) (*FSNode, error) {
	ignoreFn := func(p string) bool {
		return slices.ContainsFunc(ignorePatterns, func(pattern string) bool {
			return path.Base(p) == pattern
		})
	}

	return buildFileTreeRecursive(fs, ".", ignoreFn)
}

func GetFileTree(rootPath string, conn remote.RemoteConn) (*FSNode, error) {
	fs := getFS(rootPath, conn)
	return BuildFileTree(fs, []string{".DS_Store", "Thumbs.db", ".cache"})
}

func buildFileTreeRecursive(fss fs.FS, currentPath string, ignoreFn func(string) bool) (*FSNode, error) {
	if ignoreFn(currentPath) {
		return nil, nil
	}

	f, err := fss.Open(currentPath)
	if err != nil {
		return nil, err
	}

	info, err := f.Stat()
	if err != nil {
		return nil, err
	}

	node := FSNode{
		Name:       info.Name(),
		Path:       currentPath,
		Size:       info.Size(),
		IsDir:      info.IsDir(),
		CreatedAt:  info.ModTime().Format(time.RFC3339),
		ModifiedAt: info.ModTime().Format(time.RFC3339),
	}

	if !node.IsDir {
		ext := path.Ext(currentPath)
		mimeType := mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		node.Extension = &ext
		node.MimeType = &mimeType
		return &node, nil
	}

	entries, err := f.(fs.ReadDirFile).ReadDir(0)
	if err != nil {
		return nil, err
	}

	sortDirEntries(entries)

	var children []FSNode
	for _, entry := range entries {
		childPath := path.Join(currentPath, entry.Name())
		childNode, err := buildFileTreeRecursive(fss, childPath, ignoreFn)
		if err != nil || childNode == nil {
			continue
		}
		children = append(children, *childNode)
	}

	node.Children = &children
	return &node, nil
}

// Alphabetical order, directories first
func sortDirEntries(entries []fs.DirEntry) {
	sort.Slice(entries, func(i, j int) bool {
		di := entries[i].IsDir()
		dj := entries[j].IsDir()

		if di != dj {
			return di
		}
		return entries[i].Name() < entries[j].Name()
	})
}
