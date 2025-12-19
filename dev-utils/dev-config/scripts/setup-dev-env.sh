#!/usr/bin/env bash

PROJECT_ROOT=$(git rev-parse --show-toplevel)
NODE_VERSION='v18.15.0'
YARN_VERSION='3.5.0'

ENGINES_DIR=$PROJECT_ROOT/__engines__

if [ ! -d "$ENGINES_DIR" ]; then
    mkdir -p $ENGINES_DIR
fi

set_PATH() {
    app_bin_path=$1
    case "${app_bin_path}" in
    *${PATH}*)
        echo PATH already includes ${app_bin_path}
        ;;
    *)
        PATH=${app_bin_path}:$PATH
        echo Updated PATH to include ${app_bin_path}
        ;;
    esac
}

prepare_node() {
    case $(uname -m) in
    arm*  | aarch64) architecture="arm64" ;;
    *) architecture="x64" ;;
    esac

    uname_out="$(uname -s)"
    case "${uname_out}" in
    Linux*) system=Linux ;;
    Darwin*) system=Mac ;;
    CYGWIN*) system=Windows ;;
    MINGW*) system=Windows ;;
    esac

    case "${system}" in
    Linux*)
        node_release="node-${NODE_VERSION}-linux-${architecture}"
        node_archive="${node_release}.tar.xz"
        ;;
    Mac*)
        node_release="node-${NODE_VERSION}-darwin-${architecture}"
        node_archive="${node_release}.tar.xz"
        ;;
    Windows*)
        node_release="node-${NODE_VERSION}-win-${architecture}"
        node_archive="${node_release}.zip"
        ;;
    *)
        echo "setup-dev-env not supported for ${uname_out}"
        exit 1
        ;;
    esac

    if [ ! -d "${ENGINES_DIR}/${node_release}" ]; then
        curl -L -o "${ENGINES_DIR}/${node_archive}" "https://nodejs.org/download/release/${NODE_VERSION}/${node_archive}"

        case $node_archive in
        *.tar.xz) tar -xJf "${ENGINES_DIR}/${node_archive}" -C $ENGINES_DIR/ ;;
        *.zip) unzip "${ENGINES_DIR}/${node_archive}" -d $ENGINES_DIR/ ;;
        esac

        rm "${ENGINES_DIR}/${node_archive}"

        case "${system}" in
        Linux*)
            ln -nsf ${ENGINES_DIR}/${node_release}/bin ${ENGINES_DIR}/node_bin
            ;;
        Mac*)
            ln -nsf ${ENGINES_DIR}/${node_release}/bin ${ENGINES_DIR}/node_bin
            ;;
        Windows*)
            ln -nsf ${ENGINES_DIR}/${node_release} ${ENGINES_DIR}/node_bin
            ;;
        esac
    fi

    set_PATH "${ENGINES_DIR}/node_bin"
}

prepare_yarn() {
    yarn_release="berry-yarnpkg-cli-${YARN_VERSION}"

    if [ ! -d "${ENGINES_DIR}/${yarn_release}" ]; then
        mkdir -p ${ENGINES_DIR}/${yarn_release}

        case "${system}" in
        Linux*)
            curl -L -o "${ENGINES_DIR}/${yarn_release}/yarn" "https://repo.yarnpkg.com/${YARN_VERSION}/packages/yarnpkg-cli/bin/yarn.js"
            chmod +x "${ENGINES_DIR}/${yarn_release}/yarn"

            ${ENGINES_DIR}/${yarn_release}/yarn set version berry
            ;;
        Mac*)
            curl -L -o "${ENGINES_DIR}/${yarn_release}/yarn" "https://repo.yarnpkg.com/${YARN_VERSION}/packages/yarnpkg-cli/bin/yarn.js"
            chmod +x "${ENGINES_DIR}/${yarn_release}/yarn"

            ${ENGINES_DIR}/${yarn_release}/yarn set version berry
            ;;
        Windows*)
            curl -L -o "${ENGINES_DIR}/${yarn_release}/yarn.CMD" "https://repo.yarnpkg.com/${YARN_VERSION}/packages/yarnpkg-cli/bin/yarn.js"

            ${ENGINES_DIR}/${yarn_release}/yarn.CMD set version berry
            ;;
        esac
    fi

    ln -nsf ${ENGINES_DIR}/${yarn_release} ${ENGINES_DIR}/yarn_bin

    set_PATH "${ENGINES_DIR}/yarn_bin"
}

add_project_binaries() {
    set_PATH "${PROJECT_ROOT}/node_modules/.bin"
}

add_env_file() {
    if [ ! -f "${PROJECT_ROOT}/.env" ]; then
        echo "NPM_TOKEN=your_github_access_token" >${PROJECT_ROOT}/.env
    fi
}

prepare_node
prepare_yarn
add_project_binaries
add_env_file

export PATH
