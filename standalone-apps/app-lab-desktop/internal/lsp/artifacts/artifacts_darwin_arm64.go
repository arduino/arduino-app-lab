//go:build darwin && arm64

package artifacts

import "embed"

//go:embed all:resources/darwin_arm64/*
var lspFS embed.FS
