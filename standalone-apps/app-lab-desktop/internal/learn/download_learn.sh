#!/bin/bash

set -e

REPO_URL=https://github.com/bcmi-labs/app-bricks-example
SUB_DIR=learn-docs
BRANCH=main
ROOT=$(git rev-parse --show-toplevel)
DEST=$ROOT/standalone-apps/app-lab-desktop/internal/learn/assets

if [[ -d "$DEST" ]]; then
    echo "Learn contents already downloaded"
    exit 0
else
    echo "Downloading learn contents"
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Cloning learn contents into $TMP_DIR"
git -C "$TMP_DIR" init -q
git -C "$TMP_DIR" remote add origin "$REPO_URL"
git -C "$TMP_DIR" sparse-checkout init --cone
git -C "$TMP_DIR" sparse-checkout set "$SUB_DIR"
git -C "$TMP_DIR" pull origin "$BRANCH" -q

echo "Adding lastmod files to learn contents"

add_lastmod() {
    BASEPATH="$1"
    if [ -z "$BASEPATH" ]; then
        echo "Usage: $0 <BASEPATH>"
        exit 1
    fi

    # Find all .md files inside BASEPATH (depth 0 = BASEPATH, depth 1 = its subfolders)
    find $BASEPATH -maxdepth 2 -type f -name "*.md" | while read -r FILE; do
    LASTMOD=$(git -C "$BASEPATH" log -1 --date=short --format="%cd" -- "$FILE" 2>/dev/null || true)
    if [ -z "$LASTMOD" ]; then
        echo "Skip (no git history): $FILE"
        continue
    fi

    echo "Adding $FILE.lastmod ($LASTMOD)"
    printf '%s\n' "$LASTMOD" > "$FILE.lastmod"
    done
}

add_lastmod $TMP_DIR/$SUB_DIR

echo "Copying learn contents to $DEST"
rm -rf $DEST
mkdir -p $DEST
mv $TMP_DIR/learn-docs/* $DEST

echo "Learn contents fetched and copied to $DEST"
