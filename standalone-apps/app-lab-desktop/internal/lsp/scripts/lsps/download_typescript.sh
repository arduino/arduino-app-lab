#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../common.sh"

TYPESCRIPT_LS_VERSION="$(get_version typescript-language-server)" || exit 1
TYPESCRIPT_VERSION="$(get_version typescript)" || exit 1

download_typescript_ls() {

    do_download() {
        local folder=$1
        local version="${TYPESCRIPT_LS_VERSION}_${TYPESCRIPT_VERSION}"
        
        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "typescript" "$version"; then
            warn "typescript-language-server ${TYPESCRIPT_LS_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        info "Installing typescript-language-server ${TYPESCRIPT_LS_VERSION} and typescript ${TYPESCRIPT_VERSION} for ${folder}..."
        local INSTALL_DIR="${BIN_DIR}/${folder}/typescript"
        
        rm -rf "$INSTALL_DIR"

        install_node_package "$folder" "$INSTALL_DIR" "typescript-language-server@${TYPESCRIPT_LS_VERSION}" "typescript@${TYPESCRIPT_VERSION}" || return 1
        
        create_node_wrapper "$INSTALL_DIR" "typescript-language-server" "node_modules/typescript-language-server/lib/cli.mjs" "../node/node" "$folder"

        archive_asset "$INSTALL_DIR" "typescript-bundle" "$folder"

        cleanup_asset "$INSTALL_DIR" "typescript-bundle" "$folder"
        
        save_version "$folder" "typescript" "$version"
    }

    do_download "linux_amd64" || return 1
    do_download "linux_arm64" || return 1
    do_download "darwin_amd64" || return 1
    do_download "darwin_arm64" || return 1
    do_download "windows_amd64" || return 1
    do_download "windows_arm64" || return 1
}

download_typescript_ls || exit 1
