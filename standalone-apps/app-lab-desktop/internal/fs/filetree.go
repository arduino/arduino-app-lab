package fs

import (
	"io/fs"
	"mime"
	"path"
	"slices"
	"sort"
	"sync"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/arduino/arduino-app-cli/pkg/board/remotefs"
)

var defaultIgnorePatterns = []string{".DS_Store", "Thumbs.db", ".cache"}

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

// WalkFilePaths returns the path of every file under the root of fss, relative
// to it, directories traversed but never returned. Order matches the listings:
// directories first, then alphabetical.
//
// A directory that cannot be listed even after listDirEntries' retries is named
// in an *UnreadableDirsError, returned alongside the paths that were found. It
// used to be skipped, which made a short list indistinguishable from a complete
// one — and this list becomes the set of files known to exist on the board, so
// callers that cannot tolerate a gap must treat that error as fatal. Only the
// root failing yields no paths at all.
func WalkFilePaths(fss fs.FS, ignorePatterns []string) ([]string, error) {
	ignored := func(name string) bool { return slices.Contains(ignorePatterns, name) }

	var walk func(dir string) ([]string, []string, error)
	walk = func(dir string) ([]string, []string, error) {
		entries, err := listDirEntries(fss, dir)
		if err != nil {
			return nil, nil, err
		}

		sortDirEntries(entries)

		// Both keyed by sorted index, so the paths and the unreadable ones come
		// back in listing order despite the fan-out.
		found := make([][]string, len(entries))
		unlisted := make([][]string, len(entries))
		var wg sync.WaitGroup

		for i, e := range entries {
			if ignored(e.Name()) {
				continue
			}
			// path.Join drops the leading "./", so the root's own children come
			// back as plain names.
			child := path.Join(dir, e.Name())
			if !e.IsDir() {
				found[i] = []string{child}
				continue
			}
			wg.Add(1)
			go func(idx int, cp string) {
				defer wg.Done()
				paths, unreadable, err := walk(cp)
				if err != nil {
					// The parent's listing already proved this folder exists, so
					// its contents are files we know nothing about rather than
					// files that are not there.
					unreadable = []string{cp}
				}
				found[idx], unlisted[idx] = paths, unreadable
			}(i, child)
		}
		wg.Wait()

		var paths, unreadable []string
		for i := range entries {
			paths = append(paths, found[i]...)
			unreadable = append(unreadable, unlisted[i]...)
		}
		return paths, unreadable, nil
	}

	// The root's own failure comes back from the walk, so it needs no separate
	// Open to tell it apart from a subtree's.
	paths, unreadable, err := walk(".")
	if err != nil {
		return nil, err
	}
	if len(unreadable) > 0 {
		return paths, &UnreadableDirsError{Paths: unreadable}
	}
	return paths, nil
}

// ListFilePaths is WalkFilePaths over a board connection.
func ListFilePaths(rootPath string, conn remote.RemoteConn) ([]string, error) {
	return WalkFilePaths(getFS(rootPath, dirsByListing{RemoteConn: conn, root: path.Clean(rootPath)}), defaultIgnorePatterns)
}

// dirsByListing lets the listings say what is a folder: remotefs asks file -L first, which calls a folder named like "v1:2", or a sticky one, a file.
type dirsByListing struct {
	remote.RemoteConn
	root string
}

// Stats answers "folder" for every path but the root: WalkFilePaths opens only the root and what a listing showed as a folder.
func (c dirsByListing) Stats(p string) (remote.FileInfo, error) {
	if path.Clean(p) == c.root {
		return c.RemoteConn.Stats(p)
	}
	return remote.FileInfo{Name: path.Base(p), IsDir: true}, nil
}

// ListDirectory returns the immediate children of rootPath, directories first
// then alphabetical.
func ListDirectory(rootPath string, conn remote.RemoteConn) ([]FSNode, error) {
	entries, err := ListConnEntries(conn, rootPath)
	if err != nil {
		return nil, err
	}

	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return entries[i].Name < entries[j].Name
	})

	nodes := make([]FSNode, 0, len(entries))
	for _, e := range entries {
		if slices.Contains(defaultIgnorePatterns, e.Name) {
			continue
		}
		nodes = append(nodes, newRemoteFSNode(rootPath, e))
	}

	return nodes, nil
}

// newRemoteFSNode names a child by its full board path, as StatPath does: a bare
// name means nothing to a caller holding a node from a directory it no longer
// knows.
func newRemoteFSNode(dir string, info remote.FileInfo) FSNode {
	node := FSNode{Name: info.Name, Path: path.Join(dir, info.Name), IsDir: info.IsDir}

	if !info.IsDir {
		ext := path.Ext(info.Name)
		mimeType := mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		node.Extension = &ext
		node.MimeType = &mimeType
	}

	return node
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
