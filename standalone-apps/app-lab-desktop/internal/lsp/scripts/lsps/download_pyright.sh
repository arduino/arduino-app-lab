#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../common.sh"

BASEDPYRIGHT_VERSION="$(get_version basedpyright)" || exit 1

download_pyright() {

    do_download() {
        local folder=$1

        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "python/pyright/" "$BASEDPYRIGHT_VERSION"; then
            warn "basedpyright ${BASEDPYRIGHT_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        info "Installing basedpyright ${BASEDPYRIGHT_VERSION} for ${folder}..."
        local INSTALL_DIR="${BIN_DIR}/${folder}/python/pyright"

        rm -rf "$INSTALL_DIR"

        install_node_package "$folder" "$INSTALL_DIR" "basedpyright@${BASEDPYRIGHT_VERSION}" || return 1

        create_node_wrapper "$INSTALL_DIR" "basedpyright-langserver" "node_modules/basedpyright/langserver.index.js" "../../node/node" "$folder"

        archive_asset "$INSTALL_DIR" "pyright-bundle" "$folder"

        cleanup_asset "$INSTALL_DIR" "pyright-bundle" "$folder"

        save_version "$folder" "python/pyright" "$BASEDPYRIGHT_VERSION"
    }

    do_download "linux_amd64" || return 1
    do_download "linux_arm64" || return 1
    do_download "darwin_amd64" || return 1
    do_download "darwin_arm64" || return 1
    do_download "windows_amd64" || return 1
    do_download "windows_arm64" || return 1
}

download_pyright || exit 1
