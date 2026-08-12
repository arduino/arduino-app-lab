#!/bin/bash

# Shared logic and helpers for LSP downloads

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Base directory for resources - relative to the internal/lsp folder
LSP_INTERNAL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )"
BIN_DIR="${LSP_INTERNAL_DIR}/artifacts/resources"

SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
VERSIONS_FILE="${SCRIPTS_DIR}/versions.json"

# Ensure the resources directory exists
mkdir -p "${BIN_DIR}"

get_version() {
    local key="$1"
    jq -er --arg k "$key" '.[$k]' "$VERSIONS_FILE" || {
        error "No version pinned for '${key}' in ${VERSIONS_FILE}"
        return 1
    }
}

# Detect current platform folder name
get_current_platform_folder() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    
    case "$os" in
        linux)
            case "$arch" in
                x86_64) echo "linux_amd64" ;;
                aarch64|arm64) echo "linux_arm64" ;;
                *) echo "unknown_linux_$arch" ;;
            esac
            ;;
        darwin)
            case "$arch" in
                x86_64) echo "darwin_amd64" ;;
                arm64) echo "darwin_arm64" ;;
                *) echo "unknown_darwin_$arch" ;;
            esac
            ;;
        msys*|mingw*|cygwin*)
            case "$arch" in
                x86_64) echo "windows_amd64" ;;
                aarch64|arm64) echo "windows_arm64" ;;
                *) echo "unknown_windows_$arch" ;;
            esac
            ;;
        *)
            echo "unknown_$os"
            ;;
    esac
}

CURRENT_PLATFORM_FOLDER=$(get_current_platform_folder)

PLATFORM_FILTER=""

# - TARGET_ARCH set -> download just that arch.
#    (`pr-test-and-build.yml`, `build:arduino-app-lab:deb`)
# - TARGET_ARCH unset:
#   - running locally -> download only this dev machine's platform.
#   - running in CI -> download all arches.
#   (`release-app-lab-from-branch.yml`)
if [ -n "$TARGET_ARCH" ]; then
    PLATFORM_FILTER="${TARGET_ARCH}"
elif [ "$GITHUB_ACTIONS" != "true" ] && [ "$CI" != "true" ]; then
    PLATFORM_FILTER="${CURRENT_PLATFORM_FOLDER}"
fi

should_download_platform() {
    local folder=$1
    if [ -z "$PLATFORM_FILTER" ] || [ "$folder" == "$PLATFORM_FILTER" ]; then
        return 0
    fi
    return 1
}

# Logging helpers
info() { echo -e "${GREEN}[INFO] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; }

# Helper to check if binary/folder exists and has the correct version
check_version() {
    local folder=$1
    local name=$2
    local version=$3
    
    # Remove trailing slash for basename
    local base_name=$(basename "${name%/}")
    local version_file="${BIN_DIR}/${folder}/${name%/}/${base_name}.version"
    
    if [ -f "$version_file" ]; then
        local current_version=$(cat "$version_file")
        if [ "$current_version" == "$version" ]; then
            return 0
        fi
    fi
    return 1
}

# Helper to save the version
save_version() {
    local folder=$1
    local name=$2
    local version=$3
    
    # Remove trailing slash for basename
    local base_name=$(basename "${name%/}")
    local version_file="${BIN_DIR}/${folder}/${name%/}/${base_name}.version"
    mkdir -p "$(dirname "$version_file")"
    echo "$version" > "$version_file"
}

# Helper to determine the archive extension based on platform/folder name
get_extension() {
    local name="$1"
    if [[ "$name" == *"windows"* ]]; then
        echo "zip"
    else
        echo "tar.gz"
    fi
}

# Check for required tools
check_tool() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 is not installed."
        return 1
    fi
    return 0
}

# Helper to install npm package
install_node_package() {
    local folder="$1"
    local dest_dir="$2"
    shift 2 # The rest are packages
    
    info "Installing $@ for ${folder}..."
    mkdir -p "$dest_dir"
    if ! npm install "$@" --prefix "$dest_dir" --no-save --no-package-lock --omit=dev --no-audit --no-fund --quiet; then
        error "Failed to install $@ for ${folder}"
        return 1
    fi
    return 0
}

# Helper to create a wrapper script for Node.js-based LSPs
create_node_wrapper() {
    local install_dir="$1"
    local bin_name="$2"
    local js_path="$3"
    local relative_node_path="$4"
    local platform_folder="$5"

    if [[ "$platform_folder" == "windows"* ]]; then
        local win_node_path="${relative_node_path//\//\\}"
        local win_js_path="${js_path//\//\\}"
        
        cat > "${install_dir}/${bin_name}.bat" <<EOF
@echo off
set SCRIPT_DIR=%~dp0
"%SCRIPT_DIR%${win_node_path}.exe" "%SCRIPT_DIR%${win_js_path}" %*
EOF
    else
        cat > "${install_dir}/${bin_name}" <<EOF
#!/bin/bash
SCRIPT_DIR="\$( cd "\$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
"\$SCRIPT_DIR/${relative_node_path}" "\$SCRIPT_DIR/${js_path}" "\$@"
EOF
        chmod +x "${install_dir}/${bin_name}"
    fi
}

# Helper to download an asset
download_asset() {
    local url="$1"
    local dest_dir="$2"
    local archive_filename="$3"

    mkdir -p "$dest_dir"
    local archive_path="${dest_dir}/${archive_filename}"

    if ! wget --no-verbose "$url" -O "$archive_path"; then
        error "Failed to download $url"
        rm -f "$archive_path"
        return 1
    fi
    return 0
}

# Helper to archive a directory
archive_asset() {
    local dir="$1"
    local archive_name="$2"
    local platform_folder="$3"

    local ext
    ext=$(get_extension "$platform_folder")

    info "Archiving contents of ${dir} to ${archive_name}.${ext}..."

    (
        cd "$dir" || exit 1
        if [[ "$ext" == "zip" ]]; then
            zip -q -r "${archive_name}.zip" . -x "*.version" -x "${archive_name}.zip"
        else
            # COPYFILE_DISABLE stops macOS bsdtar from emitting AppleDouble ("._*")
            # companion entries for files carrying extended attributes. bsdtar hides
            # them when listing, but Go's archive/tar reader (codeclysm/extract, used
            # at runtime) materialises them as real files. Ignored by GNU tar.
            COPYFILE_DISABLE=1 tar -czf "${archive_name}.tar.gz" --exclude="*.version" --exclude="${archive_name}.tar.gz" .
        fi
    )
}

# Helper to remove original files after archiving
cleanup_asset() {
    local dir="$1"
    local archive_name="$2"
    local platform_folder="$3"

    local ext
    ext=$(get_extension "$platform_folder")

    (
        cd "$dir" || exit 1
        # Remove everything except the archive and version files.
        # -mindepth 1 avoids removing the directory itself; 
        # -depth processes children before parents to avoid races with rm -rf.
        find . -depth -mindepth 1 ! -name "${archive_name}.${ext}" ! -name "*.version" -exec rm -rf {} +
    )
}
