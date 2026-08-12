#!/bin/bash
#
# `wails dev` hangs on shutdown when the frontend watcher is Vite >= 6 — 
# it's a wails+Vite integration issue. 
# Ctrl+C leaves the yarn/wails tree alive, holding wails' dev-bridge port (34115) and 
# — after any Go rebuild — the Vite port (8000). This wrapper force-reaps wails on Ctrl+C.
# Not covered: closing the wails window (no SIGINT reaches bash). If that
# happens, `pkill wails` manually.

set -u

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT/standalone-apps/app-lab-desktop"

set -a
# shellcheck source=/dev/null
source .env.development
set +a

./frontend/scripts/download.sh

wails dev -tags webkit2_41 \
  -ldflags "-X main.version=0.0.0-$(git rev-parse --short HEAD) -X app-lab-desktop/internal/httpclient.allowlist=${HTTPCLIENT_ALLOWLIST}" &
WAILS_PID=$!

readonly FRONTEND_DEV_PORT=8000
readonly WAILS_SHUTDOWN_GRACE_SECONDS=1

shutdown_wails() {
  kill -TERM "$WAILS_PID" 2>/dev/null
  ( sleep "$WAILS_SHUTDOWN_GRACE_SECONDS" \
      && kill -KILL "$WAILS_PID" 2>/dev/null ) &
  wait "$WAILS_PID" 2>/dev/null
  # Evict any Vite reparented to launchd so the next run isn't refused.
  lsof -ti:"$FRONTEND_DEV_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null
  exit 0
}

trap shutdown_wails INT TERM

wait "$WAILS_PID"
