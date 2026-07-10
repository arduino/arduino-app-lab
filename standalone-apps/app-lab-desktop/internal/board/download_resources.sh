#!/bin/bash

set -e

# change dir to the folder of the script
cd "$(dirname "$0")"

# remove (possibly stale) unpacked jsons
rm -f resources_index/package_index.json resources_index/package_index.json.sig
# TODO: Make this more robust by checking file names and sizes

if [ `find . | grep resources_ | wc -l` -eq 36 ]; then
  echo "Board resources already downloaded"
  exit 0
else
  echo "Downloading board resources"
fi

rm -fr resources_*

download_arduino_cli_artifacts(){
    mkdir resources_index
    wget --no-verbose https://downloads.arduino.cc/packages/package_index.tar.bz2 -O resources_index/package_index.tar.bz2

    # temporarily unpack json to extract URLs
    tar -xvf resources_index/package_index.tar.bz2 -C resources_index

    download_tool_for_arch() {
        local arch="$1"
        local host="$2"
        local tool="$3"

        # extract URLs for the given architecture
        url=$(cat resources_index/package_index.json | jq -r "
          [ .packages[].tools[] | select (.name == \"$tool\" and .version != \"v1.0.10\") ] |
          max_by(.version | [splits(\"[.]\")] | map(tonumber)) |
          .systems[] |
          select(.host == \"$host\").url")

        if [ -z "$url" ]; then
            echo "No URL found for $tool on $arch ($host)"
            exit 1
        fi

        mkdir -p resources_$arch
        wget --no-verbose "$url" -P resources_$arch/
    }

    download_tools_for_arch () {
        download_tool_for_arch "$1" "$2" "serial-discovery"
        download_tool_for_arch "$1" "$2" "mdns-discovery"
    }

    download_tools_for_arch "linux_amd64" "x86_64-pc-linux-gnu"
    download_tools_for_arch "linux_arm64" "arm64-linux-gnueabihf"
    # download_tools_for_arch "linux_386" "i686-pc-linux-gnu"
    download_tools_for_arch "windows_amd64" "x86_64-mingw32"
    download_tools_for_arch "windows_386" "i686-mingw32"
    download_tools_for_arch "windows_arm64" "arm64-mingw32"
    download_tools_for_arch "darwin_amd64" "x86_64-apple-darwin"
    download_tools_for_arch "darwin_arm64" "arm64-apple-darwin"

    # adb has a limited number of architectures
    download_tool_for_arch "linux_amd64" "x86_64-linux-gnu" "adb"
    download_tool_for_arch "linux_arm64" "aarch64-linux-gnu" "adb"
    # missing: download_tool_for_arch "linux_386" "i686-pc-linux-gnu" "adb"
    download_tool_for_arch "windows_amd64" "i686-mingw32" "adb"
    download_tool_for_arch "windows_386" "i686-mingw32" "adb"
    download_tool_for_arch "windows_arm64" "i686-mingw32" "adb"
    download_tool_for_arch "darwin_amd64" "i386-apple-darwin11" "adb"
    download_tool_for_arch "darwin_arm64" "i386-apple-darwin11" "adb"
    # filename is not always consistent... sigh...
    mv resources_darwin_amd64/platform-tools_r32.0.0-darwin.zip resources_darwin_amd64/adb_r32.0.0-darwin.zip
    mv resources_windows_386/platform-tools_r32.0.0-windows.zip resources_windows_386/adb_r32.0.0-windows.zip
    mv resources_darwin_arm64/platform-tools_r32.0.0-darwin.zip resources_darwin_arm64/adb_r32.0.0-darwin.zip
    mv resources_windows_amd64/platform-tools_r32.0.0-windows.zip resources_windows_amd64/adb_r32.0.0-windows.zip
    mv resources_windows_arm64/platform-tools_r32.0.0-windows.zip resources_windows_arm64/adb_r32.0.0-windows.zip

    # remove the unpacked jsons after extracting URLs
    rm resources_index/package_index.json resources_index/package_index.json.sig
}

download_arduino_flasher_cli_artifacts(){
    FLASHER_VERSION="0.5.1"
    FLASHER_BASE_URL="https://github.com/arduino/arduino-flasher-cli/releases/download/v${FLASHER_VERSION}"

    download_flasher_for_arch() {
        local arch="$1"
        local file="$2"
        local folder="resources_$arch"
        
        mkdir -p "$folder"
        wget --no-verbose "$FLASHER_BASE_URL/$file" -P "$folder/"
        if [[ "$file" == *.tar.gz ]]; then
            tar -xvf "$folder/$file" -C "$folder/" arduino-flasher-cli
        elif [[ "$file" == *.zip ]]; then
          # only windows artifacts are in zip format.
            unzip "$folder/$file" -d "$folder/" arduino-flasher-cli.exe
        else
            echo "Unknown file format: $file"
            exit 1
        fi
        rm -fr "$folder/$file"
    }

    download_flasher_for_arch "linux_amd64" "arduino-flasher-cli-${FLASHER_VERSION}-linux-amd64.tar.gz"
    download_flasher_for_arch "linux_arm64" "arduino-flasher-cli-${FLASHER_VERSION}-linux-arm64.tar.gz"
    download_flasher_for_arch "windows_amd64" "arduino-flasher-cli-${FLASHER_VERSION}-windows-amd64.zip"
    download_flasher_for_arch "windows_arm64" "arduino-flasher-cli-${FLASHER_VERSION}-windows-amd64.zip"
    download_flasher_for_arch "darwin_amd64" "arduino-flasher-cli-${FLASHER_VERSION}-darwin-amd64.tar.gz"
    download_flasher_for_arch "darwin_arm64" "arduino-flasher-cli-${FLASHER_VERSION}-darwin-arm64.tar.gz"
}

download_arduino_cli_artifacts
download_arduino_flasher_cli_artifacts
