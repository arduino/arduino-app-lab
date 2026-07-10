#!/bin/bash

# SPDX-FileCopyrightText: Copyright (C) Arduino s.r.l. and/or its affiliated companies
# SPDX-License-Identifier: MPL-2.0
#
# Downloads the minified Socket.IO browser UMD bundle from jsDelivr at build
# time and places it under `app/core-ui/src/app-lab/assets/socket.io.min.js`,
# where the WebUI brick generator imports it via Vite's `?raw` query.
#
# The bundle is pinned by exact version + SHA-256 for reproducibility and
# supply-chain integrity (the bytes end up embedded into user-generated WebUI
# projects). The script is idempotent: if the destination already exists with
# a matching checksum, it exits early with no network activity.
#
# Wired into:
#   - `standalone-apps/app-lab-desktop/frontend/scripts/download.sh` (parallel,
#     for Wails dev/build)
#   - `dev-utils/dev-config/package.json` `download:socket-io` script (for
#     manual/CI invocation)

set -e

SOCKET_IO_VERSION="4.8.1"
SOCKET_IO_SHA256="b0e735814f8dcfecd6cdb8a7ce95a297a7e1e5f2727a29e6f5901801d52fa0c5"
SOCKET_IO_URL="https://cdn.jsdelivr.net/npm/socket.io-client@${SOCKET_IO_VERSION}/dist/socket.io.min.js"

ROOT=$(git rev-parse --show-toplevel)
DEST_DIR="$ROOT/app/core-ui/src/app-lab/assets"
DEST="$DEST_DIR/socket.io.min.js"

# Idempotency: skip the download when the file already exists with the
# expected checksum. Any mismatch (missing file, tampering, version bump where
# someone forgot to refresh the asset) falls through to a fresh download.
if [[ -f "$DEST" ]]; then
    if echo "$SOCKET_IO_SHA256  $DEST" | shasum -a 256 -c --status -; then
        echo "Socket.IO ${SOCKET_IO_VERSION} bundle already downloaded"
        exit 0
    else
        echo "Socket.IO bundle checksum mismatch; redownloading"
    fi
fi

mkdir -p "$DEST_DIR"

echo "Downloading Socket.IO ${SOCKET_IO_VERSION} from ${SOCKET_IO_URL}"
wget --no-verbose -O "$DEST.tmp" "$SOCKET_IO_URL"

if ! echo "$SOCKET_IO_SHA256  $DEST.tmp" | shasum -a 256 -c --status -; then
    rm -f "$DEST.tmp"
    echo "Error: downloaded Socket.IO bundle did not match expected SHA-256" >&2
    echo "Expected: $SOCKET_IO_SHA256" >&2
    exit 1
fi

mv "$DEST.tmp" "$DEST"
echo "Socket.IO ${SOCKET_IO_VERSION} bundle written to $DEST"
