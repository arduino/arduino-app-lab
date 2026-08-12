#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "${SCRIPT_DIR}/../../common.sh"

# Builds a native arm64 ctags for macOS.
#
# arduino-cli runs ctags to generate function prototypes whenever it preprocesses
# a .ino, with no way to opt out, and its builtin package index publishes ctags
# 5.8-arduino11 for x86_64-apple-darwin ONLY — there is no arm64-apple-darwin
# build. ctags is the single non-native executable in the whole toolchain, so on
# Apple Silicon arduino-cli needs Rosetta 2, which macOS does not preinstall.
# Without it every compile dies with "bad CPU type in executable" and the Arduino
# language server can never build a compilation database.
#
# We therefore build it ourselves and ship it; installNativeCtags (lsp_arduino.go)
# drops it over the binary arduino-cli installed. Remove this script once
# arm64-apple-darwin ships in the builtin index upstream.
#
# Built rather than downloaded because no arm64 build is published anywhere. The
# source is dormant (last commit 2016), so the pin is stable.
#
# ctags is GPL-2.0 and the patch below modifies it, so we redistribute a modified
# GPL-2.0 binary: this script plus the pinned commit are its corresponding source.
# Declared in standalone-apps/app-lab-desktop/THIRD-PARTY-NOTICES.md — keep that
# entry in step with any change here.

CTAGS_VERSION="$(get_version ctags)" || exit 1
CTAGS_COMMIT="${CTAGS_VERSION##*-}"
CTAGS_REPO="https://github.com/arduino/ctags.git"

# Only Apple Silicon macOS needs this; every other platform has a native build
# in the builtin index.
TARGET_FOLDER="darwin_arm64"

build_ctags() {
    if ! should_download_platform "$TARGET_FOLDER"; then
        return 0
    fi

    if check_version "$TARGET_FOLDER" "arduino/ctags" "$CTAGS_VERSION"; then
        warn "ctags ${CTAGS_VERSION} already exists for ${TARGET_FOLDER}, skipping..."
        return 0
    fi

    # Needs a macOS toolchain (clang + the SDK) to produce a Mach-O arm64 binary.
    # -arch arm64 cross-builds fine from an Intel Mac, but not from Linux.
    #
    # Skipped rather than failed off-Darwin, because the release workflow's
    # download-resources job runs on ubuntu-latest and downloads every platform's
    # artifacts there: failing would break the build for all six targets over a
    # tool only one of them needs. The macOS build job runs this script itself
    # after fetching the resources artifact (see release-app-lab-from-branch.yml),
    # which is the run that actually has to succeed.
    #
    # If it is skipped and never re-run, a macOS arm64 build ships without ctags;
    # installNativeCtags then fails at runtime and the editor reports the language
    # server as unavailable, rather than hanging at 0% the way it used to.
    if [ "$(uname -s)" != "Darwin" ]; then
        warn "Skipping ctags for ${TARGET_FOLDER}: needs a macOS host (this is $(uname -s))"
        return 0
    fi

    check_tool make || return 1
    check_tool git || return 1

    local ctags_dir="${BIN_DIR}/${TARGET_FOLDER}/arduino/ctags"
    local work_dir
    work_dir="$(mktemp -d)" || return 1
    # shellcheck disable=SC2064
    trap "rm -rf '${work_dir}'" RETURN

    info "Cloning arduino/ctags @ ${CTAGS_COMMIT}..."
    if ! git -C "$work_dir" clone --quiet "$CTAGS_REPO" src; then
        error "Failed to clone ${CTAGS_REPO}"
        return 1
    fi
    if ! git -C "${work_dir}/src" checkout --quiet "$CTAGS_COMMIT"; then
        error "Failed to check out ctags commit ${CTAGS_COMMIT}"
        return 1
    fi

    # ctags 5.8 defines __unused__ as __attribute__((unused)). The macOS SDK
    # defines __unused as __attribute__((__unused__)), so any SDK header using
    # __unused (dirent.h does) expands through ctags' macro into
    # __attribute__((__attribute__((unused)))) and the build dies with "use of
    # undeclared identifier 'unused'". Renaming ctags' macro out of the reserved
    # namespace is the whole fix; it is a private helper, never part of any API.
    # LC_ALL=C keeps sed and grep byte-oriented. Without it BSD sed dies with "RE
    # error: illegal byte sequence" on beta.c, which carries non-UTF-8 bytes, but
    # only when the host locale is UTF-8 — as it is on GitHub's macOS runners and
    # not in every local shell, which is exactly how this passed locally and broke
    # in CI.
    info "Patching the __unused__ macro clash with the macOS SDK..."
    if ! ( cd "${work_dir}/src" && LC_ALL=C find . -maxdepth 1 \( -name "*.c" -o -name "*.h" \) \
            -exec sed -i '' 's/__unused__/CTAGS_UNUSED/g' {} + ); then
        error "Failed to patch the __unused__ macro"
        return 1
    fi

    # find batches the files into one sed invocation, so a failure part-way through
    # leaves some patched and some not — which builds far enough to be confusing.
    # Assert the rename is complete instead of trusting the exit status.
    local leftover
    leftover=$(cd "${work_dir}/src" && LC_ALL=C grep -rl "__unused__" --include="*.c" --include="*.h" . | tr '\n' ' ')
    if [ -n "$leftover" ]; then
        error "__unused__ survived patching in: ${leftover}"
        return 1
    fi

    info "Building ctags ${CTAGS_VERSION} for ${TARGET_FOLDER}..."
    if ! ( cd "${work_dir}/src" \
            && ./configure --host=aarch64-apple-darwin CFLAGS="-arch arm64 -O2" > configure.log 2>&1 \
            && make -j"$(sysctl -n hw.ncpu)" > build.log 2>&1 ); then
        error "Failed to build ctags; see ${work_dir}/src/{configure,build}.log"
        return 1
    fi

    # Fail loudly rather than shipping a binary for the wrong architecture: an
    # x86_64 one here would reintroduce exactly the bug this script exists to fix.
    if ! file -b "${work_dir}/src/ctags" | grep -q "arm64"; then
        error "Built ctags is not arm64: $(file -b "${work_dir}/src/ctags")"
        return 1
    fi

    rm -rf "$ctags_dir"
    mkdir -p "$ctags_dir"
    # Stripped to keep it out of the embedded resources at full size (~255K -> ~235K).
    if ! strip -o "${ctags_dir}/ctags" "${work_dir}/src/ctags"; then
        error "Failed to strip ctags"
        return 1
    fi
    chmod 0755 "${ctags_dir}/ctags"

    save_version "$TARGET_FOLDER" "arduino/ctags" "$CTAGS_VERSION"
    info "Built ctags ${CTAGS_VERSION} for ${TARGET_FOLDER}"
}

build_ctags || exit 1
