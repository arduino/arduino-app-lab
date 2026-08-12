#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../../common.sh"

ARDUINO_CLI_VERSION="$(get_version arduino-cli)" || exit 1

download_arduino_cli() {
    BASE_URL="https://downloads.arduino.cc/arduino-cli"
    
    do_download() {
        local folder=$1
        local platform=$2
        local ext=$(get_extension "$folder")

        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "arduino/arduino-cli" "$ARDUINO_CLI_VERSION"; then
            warn "arduino-cli ${ARDUINO_CLI_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        local filename="arduino-cli_${ARDUINO_CLI_VERSION}_${platform}.${ext}"
        local url="${BASE_URL}/${filename}"
        local arduino_cli_dir="${BIN_DIR}/${folder}/arduino/arduino-cli"
        
        rm -rf "$arduino_cli_dir"

        info "Downloading arduino-cli ${ARDUINO_CLI_VERSION} for ${folder}..."
        if download_asset "$url" "$arduino_cli_dir" "$filename"; then
            save_version "$folder" "arduino/arduino-cli" "$ARDUINO_CLI_VERSION"
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

download_arduino_cli || exit 1
