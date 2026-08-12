#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../../common.sh"

ARDUINO_LS_VERSION="$(get_version arduino-language-server)" || exit 1

download_arduino_ls() {
    BASE_URL="https://github.com/arduino/arduino-language-server/releases/download/${ARDUINO_LS_VERSION}"
    
    do_download() {
        local folder=$1
        local platform=$2
        local ext=$(get_extension "$folder")

        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "arduino/arduino-language-server" "$ARDUINO_LS_VERSION"; then
            warn "arduino-language-server ${ARDUINO_LS_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        local filename="arduino-language-server_${ARDUINO_LS_VERSION}_${platform}.${ext}"
        local url="${BASE_URL}/${filename}"
        local arduino_ls_dir="${BIN_DIR}/${folder}/arduino/arduino-language-server"
        
        rm -rf "$arduino_ls_dir"

        info "Downloading arduino-language-server ${ARDUINO_LS_VERSION} for ${folder}..."
        if download_asset "$url" "$arduino_ls_dir" "$filename"; then
            save_version "$folder" "arduino/arduino-language-server" "$ARDUINO_LS_VERSION"
        else
            return 1
        fi
    }

    do_download "linux_amd64" "Linux_64bit" || return 1
    do_download "linux_arm64" "Linux_ARM64" || return 1
    do_download "darwin_amd64" "macOS_64bit" || return 1
    do_download "darwin_arm64" "macOS_ARM64" || return 1
    do_download "windows_amd64" "Windows_64bit" || return 1
    do_download "windows_arm64" "Windows_ARM64" || return 1
}

download_arduino_ls || exit 1
