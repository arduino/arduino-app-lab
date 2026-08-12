#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../common.sh"

VSCODE_WEB_VERSION="$(get_version vscode-langservers-extracted)" || exit 1

download_vscode_web() {
    do_download() {
        local folder=$1
        
        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "vscode-web" "$VSCODE_WEB_VERSION"; then
            warn "vscode web servers ${VSCODE_WEB_VERSION} already exist for ${folder}, skipping..."
            return
        fi

        info "Installing vscode-langservers-extracted ${VSCODE_WEB_VERSION} for ${folder}..."
        local INSTALL_DIR="${BIN_DIR}/${folder}/vscode-web"
        
        rm -rf "$INSTALL_DIR"

        install_node_package "$folder" "$INSTALL_DIR" "vscode-langservers-extracted@${VSCODE_WEB_VERSION}" || return 1
        
        for server in "html" "css"; do
            create_node_wrapper "$INSTALL_DIR" "vscode-${server}-language-server" "node_modules/vscode-langservers-extracted/bin/vscode-${server}-language-server" "../node/node" "$folder"
        done

        archive_asset "$INSTALL_DIR" "vscode-web-bundle" "$folder"

        cleanup_asset "$INSTALL_DIR" "vscode-web-bundle" "$folder"
        
        save_version "$folder" "vscode-web" "$VSCODE_WEB_VERSION"
    }

    do_download "linux_amd64" || return 1
    do_download "linux_arm64" || return 1
    do_download "darwin_amd64" || return 1
    do_download "darwin_arm64" || return 1
    do_download "windows_amd64" || return 1
    do_download "windows_arm64" || return 1
}

download_vscode_web || exit 1
