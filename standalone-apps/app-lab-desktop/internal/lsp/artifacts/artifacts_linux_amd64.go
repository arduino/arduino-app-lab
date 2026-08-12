//go:build linux && amd64

package artifacts

import "embed"

//go:embed all:resources/linux_amd64/*
var lspFS embed.FS
