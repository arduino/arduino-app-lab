#!/bin/bash

export TARGET_ARCH="${1:-$TARGET_ARCH}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

source "${SCRIPT_DIR}/common.sh"

# Required tools
TOOLS=("wget" "unzip" "zip" "tar" "npm" "jq")
for tool in "${TOOLS[@]}"; do
    if ! check_tool "$tool"; then
        exit 1
    fi
done

scripts=(
    "download_arduino.sh"
    "download_ruff.sh"
    "download_node.sh"
    "download_pyright.sh"
    "download_typescript.sh"
    "download_vscode_web.sh"
)

info "Starting parallel LSP downloads..."

declare -A pids
for script in "${scripts[@]}"; do
    info "Launching ${script}..."
    bash "${SCRIPT_DIR}/lsps/${script}" &
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
    error "The following scripts failed to complete: ${failed[*]}"
    exit 1
fi

# Every binary downloaded above is redistributed in our installers, so it needs
# its licence shipped alongside. Offline check against the committed texts in
# internal/notices/licenses — see check_licenses.sh.
if ! bash "${SCRIPT_DIR}/check_licenses.sh"; then
    error "Refusing to proceed: a bundled binary has no licence to ship with it."
    exit 1
fi

info "All LSP resources have been successfully processed."
