#!/bin/bash

# Refreshes internal/notices/licenses/ from licenses.json.
#
# The texts are committed rather than fetched at build time, for three reasons:
# the release workflow builds six targets and none of them should depend on
# raw.githubusercontent.com being up; a licence change is something a reviewer
# should see in a diff; and the dist packaging steps can then just copy a
# directory that is already in the checkout, with no ordering against the
# resource downloads.
#
# Run this whenever versions.json moves, then commit the result.
# check_licenses.sh fails the build if you forget.

# No `set -u`: common.sh reads $TARGET_ARCH and $CI unguarded.
set -o pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/common.sh"

LICENSES_FILE="${SCRIPT_DIR}/licenses.json"
LICENSES_DIR="${LSP_INTERNAL_DIR}/../notices/licenses"

check_tool jq || exit 1
check_tool curl || exit 1
check_tool tar || exit 1

# Substitutes the {version...} placeholders documented in licenses.json.
resolve_placeholders() {
    local template="$1" version="$2"
    local base="${version%%-*}" suffix="${version##*-}"

    template="${template//\{version\}/${version}}"
    template="${template//\{version_base\}/${base}}"
    template="${template//\{version_suffix\}/${suffix}}"
    printf '%s' "$template"
}

fetch_one() {
    local component="$1"
    local version spdx text_url text_member text_file

    version="$(get_version "$component")" || return 1

    spdx="$(jq -er --arg c "$component" '.components[$c].spdx' "$LICENSES_FILE")" || {
        error "No licenses.json entry for '${component}'"
        return 1
    }
    text_file="$(jq -er --arg c "$component" '.components[$c].text_file' "$LICENSES_FILE")" || return 1
    text_url="$(jq -er --arg c "$component" '.components[$c].text_url' "$LICENSES_FILE")" || return 1
    text_member="$(jq -r --arg c "$component" '.components[$c].text_member // ""' "$LICENSES_FILE")"

    text_url="$(resolve_placeholders "$text_url" "$version")"

    local dest="${LICENSES_DIR}/${text_file}"
    local tmp
    tmp="$(mktemp -d)" || return 1
    # shellcheck disable=SC2064
    trap "rm -rf '${tmp}'" RETURN

    info "${component} ${version} (${spdx})"

    if [ -n "$text_member" ]; then
        # An archive: fetch it and pull the one member out.
        if ! curl -sfL "$text_url" -o "${tmp}/archive"; then
            error "Failed to download ${text_url}"
            return 1
        fi
        if ! tar -xzf "${tmp}/archive" -C "$tmp" "$text_member" 2>/dev/null; then
            error "Failed to extract ${text_member} from ${text_url}"
            return 1
        fi
        mv "${tmp}/${text_member}" "${tmp}/text"
    else
        if ! curl -sfL "$text_url" -o "${tmp}/text"; then
            error "Failed to download ${text_url}"
            return 1
        fi
    fi

    # A 404 that still returns a body, or an empty file, would otherwise be
    # committed as a "licence".
    if [ ! -s "${tmp}/text" ]; then
        error "${component}: downloaded licence text is empty (${text_url})"
        return 1
    fi

    # Header records what the bare text cannot: which component and version this
    # covers, and where its corresponding source is. check_licenses.sh compares
    # the version recorded here against versions.json, so a version bump that
    # leaves the licence text unchanged still has to rewrite this header.
    {
        echo "Arduino App Lab bundles the executable below. This file is its licence,"
        echo "reproduced verbatim from upstream."
        echo
        echo "Component:  ${component} ${version}"
        echo "Licence:    ${spdx}"
        echo "Upstream:   $(resolve_placeholders "$(jq -r --arg c "$component" '.components[$c].origin' "$LICENSES_FILE")" "$version")"
        echo "Source:     $(resolve_placeholders "$(jq -r --arg c "$component" '.components[$c].source_url' "$LICENSES_FILE")" "$version")"
        echo "Retrieved:  ${text_url}"
        echo
        echo "$(printf '%.0s-' {1..78})"
        echo
        cat "${tmp}/text"
    } > "$dest"

    return 0
}

mkdir -p "$LICENSES_DIR"

# while-read rather than mapfile: /bin/bash on macOS is still 3.2.
components=()
while IFS= read -r component; do
    components+=("$component")
done < <(jq -r '.components | keys[]' "$LICENSES_FILE")

failed=()
for component in "${components[@]}"; do
    fetch_one "$component" || failed+=("$component")
done

if [ ${#failed[@]} -ne 0 ]; then
    error "Failed to fetch licences for: ${failed[*]}"
    exit 1
fi

info "Refreshed ${#components[@]} licences in ${LICENSES_DIR}"
