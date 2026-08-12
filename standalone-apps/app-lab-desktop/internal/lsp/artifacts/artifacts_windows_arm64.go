//go:build windows && arm64

package artifacts

import "embed"

//go:embed all:resources/windows_arm64/*
var lspFS embed.FS
