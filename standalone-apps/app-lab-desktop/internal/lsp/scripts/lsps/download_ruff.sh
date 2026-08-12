#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../common.sh"

RUFF_VERSION="$(get_version ruff)" || exit 1

download_ruff() {
    BASE_URL="https://github.com/astral-sh/ruff/releases/download/${RUFF_VERSION}"
    
    do_download() {
        local folder=$1
        local platform=$2
        local ext=$(get_extension "$folder")

        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "python/ruff" "$RUFF_VERSION"; then
            warn "ruff ${RUFF_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        local filename="ruff-${platform}.${ext}"
        local url="${BASE_URL}/${filename}"
        local ruff_dir="${BIN_DIR}/${folder}/python/ruff"

        rm -rf "$ruff_dir"

        info "Downloading ruff ${RUFF_VERSION} for ${folder}..."
        if download_asset "$url" "$ruff_dir" "$filename"; then
            save_version "$folder" "python/ruff" "$RUFF_VERSION"
        else
            return 1
        fi
    }

    do_download "linux_amd64" "x86_64-unknown-linux-gnu" || return 1
    do_download "linux_arm64" "aarch64-unknown-linux-gnu" || return 1
    do_download "darwin_amd64" "x86_64-apple-darwin" || return 1
    do_download "darwin_arm64" "aarch64-apple-darwin" || return 1
    do_download "windows_amd64" "x86_64-pc-windows-msvc" || return 1
    do_download "windows_arm64" "aarch64-pc-windows-msvc" || return 1
}

download_ruff || exit 1
