package fs

import (
	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"path"
	"strings"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
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
	err := conn.Remove(path)
	if err != nil {
		return err
	}
	return nil
}

func CreateFolder(conn remote.RemoteConn, path string) error {
	err := conn.MkDirAll(path)
	if err != nil {
		return err
	}
	return nil
}
