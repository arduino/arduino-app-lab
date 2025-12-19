#!/usr/bin/env bash

set -e

PROJECT_ROOT=$(git rev-parse --show-toplevel)
ROOT_DIR="$PROJECT_ROOT/standalone-apps/app-lab-desktop/internal/emoji"
EMOJI_DIR="$ROOT_DIR/assets"
TEMP_DIR="$ROOT_DIR/noto-emoji-temp"
REPO_URL="https://github.com/googlefonts/noto-emoji.git"
REPO_TAG="v2.051"
API_URL="https://api.github.com/repos/googlefonts/noto-emoji/releases/latest"

# Remove emoji variant files containing skin tone modifiers (e.g. '_1f3').
# Logs errors if any occur but continues execution.
function removeVariants() {
  if [[ ! -d "$EMOJI_DIR" ]]; then
    return
  fi
  echo "Removing unnecessary variant files"
  find "$EMOJI_DIR" -name '*_1f3*.svg' -exec rm -f {} \; || true
}

# Recursively copy directory contents from srcDir to destDir.
# Logs errors if any occur but continues execution.
function copyDir() {
  local srcDir="$1"
  local destDir="$2"

  if [[ ! -d "$srcDir" ]]; then
    echo "Source directory does not exist: $srcDir"
    return
  fi

  mkdir -p "$destDir"
  find "$srcDir" -type f -name '*.svg' -exec cp {} "$destDir" \;
}

# Fetches the latest release tag from the GitHub API.
function getLatestReleaseTag() {
  wget -qO- "$API_URL" \
    | grep '"tag_name"' \
    | head -n 1 \
    | sed -E 's/.*"([^"]+)".*/\1/'
}

# Clones the Noto Emoji repository at the specified tag into a temporary directory.
function cloneRepo() {
  local tag="$1"
  echo "Cloning Noto Emoji repository at tag $tag"
  git clone --depth 1 --branch "$tag" "$REPO_URL" "$TEMP_DIR"
}

# Copies emoji SVG files from the cloned repo to the local emojis directory.
function copyEmojis() {
  local emojisSrc="$TEMP_DIR/svg"
  echo "Copying emoji SVG files"
  copyDir "$emojisSrc" "$EMOJI_DIR"
  echo "Emoji SVG files copied"
}

# Copies flag SVG files from the cloned repo to the local emojis directory.
function copyFlags() {
  local flagsSrc="$TEMP_DIR/third_party/region-flags/waved-svg"
  echo "Copying flag SVG files"
  copyDir "$flagsSrc" "$EMOJI_DIR"
  echo "Flag SVG files copied"
}

# Prepares the emoji assets by cloning the latest release, copying files,
# removing variants, and cleaning up.
function fetchEmojiAssets() {
  if [[ -d "$EMOJI_DIR" ]]; then
    echo "Emoji assets already downloaded"
    exit 0
  else
    echo "Downloading emoji assets"
  fi

  if [[ -d "$TEMP_DIR" ]]; then
    echo "Removing existing temp directory"
    rm -rf "$TEMP_DIR"
  fi

  # local latestTag
  # latestTag="$(getLatestReleaseTag)"

  # if [[ -z "$latestTag" ]]; then
  #   echo "Failed to retrieve latest release tag"
  #   exit 1
  # fi

  cloneRepo "$REPO_TAG"

  if [[ -d "$EMOJI_DIR" ]]; then
    echo "Removing existing emoji directory"
    rm -rf "$EMOJI_DIR"
  fi

  copyEmojis
  copyFlags

  echo "Cleaning up temporary directory"
  rm -rf "$TEMP_DIR"

  removeVariants
}

fetchEmojiAssets
