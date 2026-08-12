//go:build windows && amd64

package artifacts

import "embed"

//go:embed all:resources/windows_amd64/*
var lspFS embed.FS
