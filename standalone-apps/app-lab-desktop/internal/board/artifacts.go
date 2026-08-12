package board

import (
	"embed"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

//go:embed resources_index/package_index.tar.bz2
var packageIndex embed.FS

func GetFlasherCli() string {
	var name = "arduino-flasher-cli"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}

	srcDir := fmt.Sprintf("resources_%s_%s/%s", runtime.GOOS, runtime.GOARCH, name)

	tmpDir, err := os.MkdirTemp("", "")
	if err != nil {
		panic(err)
	}
	destDir := filepath.Join(tmpDir, name)

	bin, err := packagesFS.Open(srcDir)
	if err != nil {
		panic(err)
	}
	defer bin.Close()

	tmpFile, err := os.Create(destDir)
	if err != nil {
		panic(err)
	}
	defer tmpFile.Close()

	_, err = io.Copy(tmpFile, bin)
	if err != nil {
		panic(err)
	}

	tmpFile.Close() // close before chmod
	err = os.Chmod(destDir, 0755)
	if err != nil {
		panic(err)
	}

	// The flasher is GPL-3.0; its LICENSE ships in the embed (extracted from
	// the upstream archive by download_resources.sh) and travels with the
	// binary wherever it is unpacked. 0644: a document, not an executable.
	licenseSrc := fmt.Sprintf("resources_%s_%s/arduino-flasher-cli.LICENSE", runtime.GOOS, runtime.GOARCH)
	license, err := packagesFS.ReadFile(licenseSrc)
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "arduino-flasher-cli.LICENSE"), license, 0644); err != nil {
		panic(err)
	}

	return destDir
}
