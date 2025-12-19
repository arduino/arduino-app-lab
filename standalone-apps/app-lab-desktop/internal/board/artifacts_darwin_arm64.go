package board

import (
	"embed"
)

//go:embed resources_darwin_arm64/*
var packagesFS embed.FS
