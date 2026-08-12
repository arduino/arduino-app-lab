//go:build linux && arm64

package artifacts

import "embed"

//go:embed all:resources/linux_arm64/*
var lspFS embed.FS
