#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../common.sh"

NODE_VERSION="$(get_version node)" || exit 1

download_node() {
    do_download() {
        local folder=$1
        local platform=$2
        local ext=$(get_extension "$folder")

        if ! should_download_platform "$folder"; then
            return
        fi

        if check_version "$folder" "node" "$NODE_VERSION"; then
            warn "node ${NODE_VERSION} already exists for ${folder}, skipping..."
            return
        fi

        local filename="node-${NODE_VERSION}-${platform}.${ext}"
        local url="https://nodejs.org/dist/${NODE_VERSION}/${filename}"
        local node_dir="${BIN_DIR}/${folder}/node"
        
        rm -rf "$node_dir"

        info "Downloading Node.js ${NODE_VERSION} for ${folder}..."
        local archive_path="${node_dir}/${filename}"
        if download_asset "$url" "$node_dir" "$filename"; then
            info "Extracting binary from ${filename}..."
            if [[ "$platform" == win-* ]]; then
                unzip -q -j "$archive_path" "node-${NODE_VERSION}-${platform}/node.exe" -d "$node_dir"
            else
                tar -xzf "$archive_path" -C "$node_dir" --strip-components=2 "node-${NODE_VERSION}-${platform}/bin/node"
            fi
            
            rm "$archive_path"
            
            archive_asset "$node_dir" "node-bundle" "$folder"

            cleanup_asset "$node_dir" "node-bundle" "$folder"

            save_version "$folder" "node" "$NODE_VERSION"
        else
            return 1
        fi
    }

    do_download "linux_amd64" "linux-x64" || return 1
    do_download "linux_arm64" "linux-arm64" || return 1
    do_download "darwin_amd64" "darwin-x64" || return 1
    do_download "darwin_arm64" "darwin-arm64" || return 1
    do_download "windows_amd64" "win-x64" || return 1
    do_download "windows_arm64" "win-arm64" || return 1
}

download_node || exit 1
