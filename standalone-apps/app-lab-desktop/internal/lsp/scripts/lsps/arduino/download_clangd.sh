#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../../common.sh"

CLANGD_VERSION="$(get_version clangd)" || exit 1

download_clangd() {
    BASE_URL="https://github.com/arduino/clang-static-binaries/releases/download/${CLANGD_VERSION}"

    do_download() {
        local folder=$1
        local os=$2
        local arch=$3

        local filename="clangd_${CLANGD_VERSION}_${os}_${arch}.tar.bz2"
        local url="${BASE_URL}/${filename}"
        local arduino_dir="${BIN_DIR}/${folder}/arduino"
        local clangd_dir="${arduino_dir}/clangd"

        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "arduino/clangd" "$CLANGD_VERSION"; then
            warn "clangd ${CLANGD_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        info "Checking clangd ${CLANGD_VERSION} for ${folder}..."
        rm -rf "$clangd_dir"
        mkdir -p "$clangd_dir"

        if wget --spider --no-verbose "$url" 2>/dev/null; then
            info "Downloading clangd ${CLANGD_VERSION} for ${folder}..."
            local archive_path="${clangd_dir}/${filename}"
            if download_asset "$url" "$clangd_dir" "$filename"; then
                # Extract the whole archive, not just the executable: from clangd 21
                # on, the binary needs the resource headers shipped alongside it in
                # clang-resource/ (it resolves them relative to its own path). All
                # members live under clang_<os>_<arch>/, so --strip-components=1
                # lands clangd and clang-resource/ as siblings in $clangd_dir.
                info "Extracting ${filename}..."
                if ! tar -xjf "$archive_path" -C "$clangd_dir" --strip-components=1; then
                    error "Failed to extract ${filename}"
                    rm -f "$archive_path"
                    return 1
                fi

                rm -f "$archive_path"

                archive_asset "$clangd_dir" "clangd-bundle" "$folder"

                cleanup_asset "$clangd_dir" "clangd-bundle" "$folder"

                save_version "$folder" "arduino/clangd" "$CLANGD_VERSION"
            else
                return 1
            fi
        else
            warn "Skipping clangd ${CLANGD_VERSION} for ${folder} (not available upstream)"
        fi
    }

    do_download "linux_amd64" "Linux" "64bit" || return 1
    do_download "linux_arm64" "Linux" "ARM64" || return 1
    do_download "darwin_amd64" "macOS" "64bit" || return 1
    do_download "darwin_arm64" "macOS" "ARM64" || return 1
    do_download "windows_amd64" "Windows" "64bit" || return 1
    do_download "windows_arm64" "Windows" "ARM64" || return 1
}

download_clangd || exit 1
