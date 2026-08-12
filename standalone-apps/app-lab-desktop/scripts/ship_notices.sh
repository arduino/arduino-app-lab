#!/bin/bash

# Puts the third-party attribution in internal/notices into something we ship.
#
# That is the whole job. The texts are useless sitting in the repo; this is the
# step that puts them inside what a user downloads. It covers all of it:
#
#   internal/notices/licenses/*.txt   licences of the bundled executables
#   internal/notices/*.txt            generated Go / npm / vendored-asset notices
#   THIRD-PARTY-NOTICES.md            the human overview of both
#
# Two flags, because the things we ship want them in different shapes:
#
#   --to-folder <dir>    Drop everything into <dir>, as files. For the Linux
#                        tarball and the macOS dmg, which are folders of stuff.
#
#   --into-file <file>   Paste everything onto the end of <file>, as one long
#                        document. For the Debian package, where the convention
#                        is a single file (usr/share/doc/.../copyright). The
#                        caller owns the target's lifecycle: licensed.sh
#                        recreates it from copyright.base before every append,
#                        which is what keeps repeated runs from doubling up.
#
# Same content either way. Folder vs one big file is the only difference.
#
# No validation happens here beyond "the generated files exist": whether the
# licence set matches versions.json is check_licenses.sh's job, and it already
# gated the pipeline at the end of download_lsps.sh. Windows gets nothing from
# this script by design — see THIRD-PARTY-NOTICES.md.

set -o pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; }

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
APP_DIR="$( cd "${SCRIPT_DIR}/.." &> /dev/null && pwd )"
NOTICES_DIR="${APP_DIR}/internal/notices"
LICENSES_DIR="${NOTICES_DIR}/licenses"
NOTICES_FILE="${APP_DIR}/THIRD-PARTY-NOTICES.md"

usage() {
    echo "Usage: $0 --to-folder <dir> | --into-file <file>" >&2
    exit 2
}

# Everything below is generated, never hand-written. Missing means someone
# changed dependencies without regenerating, and shipping silently without the
# attribution is exactly what this script exists to prevent.
for required in "${NOTICES_DIR}/go-dependencies.txt" "${NOTICES_DIR}/npm-dependencies.txt" "${NOTICES_DIR}/vendored-assets.txt"; do
    if [ ! -s "$required" ]; then
        error "Missing $(basename "$required") - regenerate with: task general:cache-dep-licenses"
        exit 1
    fi
done
if ! ls "${LICENSES_DIR}"/*.txt > /dev/null 2>&1; then
    error "No licence texts in ${LICENSES_DIR} - run internal/lsp/scripts/download_licenses.sh"
    exit 1
fi
# The copy and append below ship every *.txt they find, including notices added
# after the fixed list above was written — so guard the whole glob, not just
# the named floor. An empty file here is a truncated generation, and shipping
# it would look like discharged attribution.
for shipped in "${NOTICES_DIR}"/*.txt "${LICENSES_DIR}"/*.txt; do
    if [ ! -s "$shipped" ]; then
        error "Refusing to ship empty notice file: ${shipped}"
        exit 1
    fi
done

copy_to_folder() {
    local dest="$1"

    mkdir -p "$dest" || return 1
    cp "$NOTICES_FILE" "${dest}/THIRD-PARTY-NOTICES.md" || return 1
    cp "${LICENSES_DIR}"/*.txt "$dest" || return 1
    cp "${NOTICES_DIR}"/*.txt "$dest" || return 1

    # Nothing here may be executable: the Linux updater takes the first file in
    # the release archive with any of 0111 set as the new binary, and this
    # directory ships inside that archive.
    chmod 0644 "$dest"/*.txt "${dest}/THIRD-PARTY-NOTICES.md" || return 1

    info "Wrote $(find "$dest" -name '*.txt' | wc -l | tr -d ' ') licence and notice files to ${dest}"
}

append_into_file() {
    local target="$1"

    if [ ! -f "$target" ]; then
        error "${target} does not exist"
        return 1
    fi

    {
        echo
        echo "$(printf '%.0s=' {1..78})"
        echo "=== Licences of third-party software in Arduino App Lab ==="
        echo "$(printf '%.0s=' {1..78})"
        echo
        echo "Part 1 of 2 - executables bundled with App Lab and run as separate"
        echo "processes. None is linked into App Lab. Each licence follows in full."
        echo

        for text in "${LICENSES_DIR}"/*.txt; do
            echo
            echo "$(printf '%.0s-' {1..78})"
            echo
            cat "$text" || return 1
        done

        echo
        echo "$(printf '%.0s=' {1..78})"
        echo "Part 2 of 2 - Go modules, npm packages and vendored assets built into"
        echo "App Lab."
        echo "$(printf '%.0s=' {1..78})"
        for notice in "${NOTICES_DIR}"/*.txt; do
            echo
            cat "$notice" || return 1
        done
    } >> "$target"

    info "Appended the third-party notices to ${target}"
}

[ $# -eq 2 ] || usage

case "$1" in
    --to-folder)  copy_to_folder "$2" || exit 1 ;;
    --into-file)  append_into_file "$2" || exit 1 ;;
    *)            usage ;;
esac
