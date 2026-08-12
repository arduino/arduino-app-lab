#!/bin/bash
set -e

# Assembles the .deb copyright file:
#
#   build/debian/copyright.base            App Lab's own licence statement
# + everything ship_notices.sh delivers    bundled binaries, Go, npm, vendored
# = build/debian/.../usr/share/doc/arduino-app-lab/copyright
#
# The assembled file is generated output (gitignored), rebuilt from scratch on
# every run so a local invocation can never leave a 3 MB artifact to commit.
# Only the small copyright.base is tracked; it lives outside the packaged
# arduino-app-lab/ tree so the .deb ships the assembled file, not the base.
#
# Note what this no longer does: run `licensed`. The licence metadata caches
# under .licenses/ are owned by `task general:cache-dep-licenses` and kept
# fresh by the check-cache CI job; the notices assembled here are generated
# from those committed caches ahead of time. This script only glues committed
# content together, so it needs no Ruby and no gems.

# Resolve paths from the repo root: yarn runs this script with the workspace
# (dev-utils/al-license) as cwd, but the .deb Docker build copies this tree
# from the repo root ("COPY ./standalone-apps/..." in build/debian/Dockerfile)
# — a cwd-relative output path here writes a copyright file the .deb never
# picks up.
REPO_ROOT="$(git rev-parse --show-toplevel)"
APP_DIR="${REPO_ROOT}/standalone-apps/app-lab-desktop"
COPYRIGHT_BASE="${APP_DIR}/build/debian/copyright.base"
OUTPUT_DIR="${APP_DIR}/build/debian/arduino-app-lab/usr/share/doc/arduino-app-lab"
mkdir -p "$OUTPUT_DIR"

# Assemble the copyright file: App Lab's own statement, then everything users
# are owed for the third-party software inside — the bundled executables
# (arduino-cli, clangd, node, ruff, the language servers), plus the Go, npm
# and vendored-asset attribution generated from the licensed caches. This is
# the same content the other three dists get as files.
cp "$COPYRIGHT_BASE" "$OUTPUT_DIR/copyright"
"${APP_DIR}/scripts/ship_notices.sh" --into-file "$OUTPUT_DIR/copyright"

echo "✅ copyright file assembled at $OUTPUT_DIR/copyright"
