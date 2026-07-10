#!/bin/bash
# Append the vendored seti-ui MIT notice to a NOTICE file.
#
# The seti-ui icon pack lives under ui-packages/images/assets/file-icons/seti/
# and has no package manifest, so `licensed notices` doesn't know about it.
# This script appends a one-block attribution (header + pinned SHA + MIT text)
# to any NOTICE file passed as $1. Idempotent — re-runs are no-ops.
#
# Usage: append-seti-notice.sh <path-to-NOTICE>

set -e

NOTICE_FILE="${1:?Usage: $0 <path-to-NOTICE>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SETI_DIR="$SCRIPT_DIR/../assets/file-icons/seti"
SETI_LICENSE="$SETI_DIR/LICENSE"
SETI_VERSION_FILE="$SETI_DIR/VERSION"

if [ ! -f "$NOTICE_FILE" ]; then
  echo "❌ NOTICE file not found: $NOTICE_FILE"
  exit 1
fi
if [ ! -f "$SETI_LICENSE" ]; then
  echo "❌ seti-ui LICENSE not found: $SETI_LICENSE"
  exit 1
fi

if grep -q '^\* seti-ui ' "$NOTICE_FILE"; then
  echo "ℹ️  seti-ui notice already present in $NOTICE_FILE; skipping"
  exit 0
fi

SETI_SHA="$(cat "$SETI_VERSION_FILE" 2>/dev/null || echo unknown)"
{
  echo ""
  echo "--------------------------------------------------------------------------------"
  echo "* seti-ui ($SETI_SHA) — https://github.com/jesseweed/seti-ui"
  echo ""
  cat "$SETI_LICENSE"
} >> "$NOTICE_FILE"
echo "✅ seti-ui notice appended to $NOTICE_FILE"
