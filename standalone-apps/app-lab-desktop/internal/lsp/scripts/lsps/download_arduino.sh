#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../common.sh"

# This script orchestrates the download of all Arduino LS-related components:
# - arduino-language-server
# - arduino-cli
# - clangd
# - ctags (built, not downloaded — no arm64 macOS build is published upstream)

scripts=(
    "download_arduino_ls.sh"
    "download_arduino_cli.sh"
    "download_clangd.sh"
    "build_ctags.sh"
)

info "Starting parallel Arduino component downloads..."

declare -A pids
for script in "${scripts[@]}"; do
    info "Launching ${script}..."
    bash "${SCRIPT_DIR}/arduino/${script}" &
    pids[$!]="$script"
done

failed=()
for pid in "${!pids[@]}"; do
    script="${pids[$pid]}"
    if wait "$pid"; then
        info "SUCCESS: ${script}"
    else
        error "FAILED: ${script}"
        failed+=("$script")
    fi
done

if [ ${#failed[@]} -ne 0 ]; then
    error "The following Arduino scripts failed: ${failed[*]}"
    exit 1
fi
