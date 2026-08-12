#!/bin/bash

# Fails if the licences we ship have drifted from the binaries we ship.
#
# Three ways that happens, all of them caught here:
#   1. a new LSP is added to versions.json with no licences.json entry;
#   2. a licences.json entry has no committed text in internal/notices/licenses/;
#   3. a version is bumped in versions.json without re-running
#      download_licenses.sh, leaving a licence that documents the old version.
#
# (3) is the realistic one, so it is checked against the `Component:` header
# download_licenses.sh writes rather than by re-downloading: this has to pass in
# every build job, offline, with no dependency on upstream being reachable.

# No `set -u`: common.sh reads $TARGET_ARCH and $CI unguarded.
set -o pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/common.sh"

LICENSES_FILE="${SCRIPT_DIR}/licenses.json"
# The texts live with the rest of the shipped attribution in internal/notices,
# where they are embedded into the binary.
LICENSES_DIR="${LSP_INTERNAL_DIR}/../notices/licenses"

check_tool jq || exit 1

problems=()

# 1. Everything pinned in versions.json is accounted for.
while IFS= read -r component; do
    if ! jq -e --arg c "$component" '.components[$c]' "$LICENSES_FILE" > /dev/null 2>&1; then
        problems+=("${component}: pinned in versions.json but missing from licenses.json")
    fi
done < <(jq -r 'keys[]' "$VERSIONS_FILE")

# 2 & 3. Every declared licence exists and documents the pinned version.
while IFS= read -r component; do
    text_file="$(jq -r --arg c "$component" '.components[$c].text_file' "$LICENSES_FILE")"
    path="${LICENSES_DIR}/${text_file}"

    if [ ! -s "$path" ]; then
        problems+=("${component}: ${text_file} is missing or empty — run download_licenses.sh")
        continue
    fi

    pinned="$(jq -r --arg k "$component" '.[$k] // ""' "$VERSIONS_FILE")"
    if [ -z "$pinned" ]; then
        problems+=("${component}: in licenses.json but not pinned in versions.json — stale entry?")
        continue
    fi

    # download_licenses.sh writes "Component:  <name> <version>".
    recorded="$(sed -n 's/^Component:[[:space:]]*'"${component}"'[[:space:]]\{1,\}\(.*\)$/\1/p' "$path" | head -1)"
    if [ -z "$recorded" ]; then
        problems+=("${component}: ${text_file} has no 'Component: ${component} <version>' header — regenerate it with download_licenses.sh")
    elif [ "$recorded" != "$pinned" ]; then
        problems+=("${component}: ships the licence for ${recorded} but versions.json pins ${pinned} — re-run download_licenses.sh and commit")
    fi
done < <(jq -r '.components | keys[]' "$LICENSES_FILE")

# 4. No licences left behind for something we no longer bundle. download_licenses.sh
# only ever writes, so a component removed from the manifest leaves its text
# embedded and shipping — a notice for software that is not there.
for path in "${LICENSES_DIR}"/*.txt; do
    [ -e "$path" ] || continue
    name="$(basename "$path")"
    if ! jq -e --arg f "$name" '[.components[].text_file] | index($f)' "$LICENSES_FILE" > /dev/null 2>&1; then
        problems+=("${name}: present in licenses/ but no licenses.json entry claims it — delete it if the binary is gone")
    fi
done

if [ ${#problems[@]} -ne 0 ]; then
    error "Bundled-binary licence check failed:"
    for problem in "${problems[@]}"; do
        error "  - ${problem}"
    done
    error "See standalone-apps/app-lab-desktop/THIRD-PARTY-NOTICES.md for what this guards."
    exit 1
fi

info "Bundled-binary licences are present and match versions.json"
