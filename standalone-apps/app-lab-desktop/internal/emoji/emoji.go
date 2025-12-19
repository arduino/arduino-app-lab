package emoji

import (
	"errors"
	"fmt"
	"io"
	"strings"
)

const assetsDir = "assets/"

var ErrNotFound = errors.New("emoji asset not found")
var ErrFailedToRead = errors.New("failed to read emoji asset")

func getAssetPath(id string) string {
	return assetsDir + "emoji_u" + strings.ReplaceAll(id, "-", "_") + ".svg"
}

func getFile(path string) (io.ReadCloser, error) {
	f, err := emojiFS.Open(path)
	if err != nil {
		return nil, ErrNotFound
	}
	return f, nil
}

func pipeAsset(id string, w io.Writer) error {
	id = strings.ReplaceAll(id, "-fe0f", "")
	path := getAssetPath(id)
	f, err := getFile(path)
	if err != nil && strings.Contains(id, "-") {
		id = id[:strings.Index(id, "-")]
		path = getAssetPath(id)
		f, err = getFile(path)
	}
	if err != nil {
		return errors.Join(ErrNotFound, fmt.Errorf("open %s: %w", path, err))
	}
	defer f.Close()

	if _, err := io.Copy(w, f); err != nil {
		return errors.Join(ErrFailedToRead, fmt.Errorf("copy %s: %w", path, err))
	}
	return nil
}
