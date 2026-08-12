#!/bin/bash

TARGET_ARCH="${1:-}"

ROOT=$(git rev-parse --show-toplevel)
cd $ROOT/standalone-apps/app-lab-desktop

# Waited on individually below: a bare `wait` always returns 0, which would
# swallow a failing download — including the licence gate at the end of
# download_lsps.sh, which exists precisely to fail this step.
pids=()
./internal/board/download_resources.sh "$TARGET_ARCH" & pids+=($!)
./internal/emoji/download_emojis.sh & pids+=($!)
./internal/learn/download_learn.sh & pids+=($!)
./internal/lsp/scripts/download_lsps.sh "$TARGET_ARCH" & pids+=($!)
$ROOT/dev-utils/dev-config/scripts/download_socket_io.sh & pids+=($!)

failed=0
for pid in "${pids[@]}"; do
    wait "$pid" || failed=1
done

if [ "$failed" -ne 0 ]; then
    echo "One or more resource downloads failed — see the errors above." >&2
    exit 1
fi
