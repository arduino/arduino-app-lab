//go:build darwin && amd64

package artifacts

import "embed"

//go:embed all:resources/darwin_amd64/*
var lspFS embed.FS
