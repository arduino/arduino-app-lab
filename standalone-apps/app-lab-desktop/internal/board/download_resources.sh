#!/bin/bash

set -e

# change dir to the folder of the script
cd "$(dirname "$0")"

# remove (possibly stale) unpacked jsons
rm -f resources_index/package_index.json resources_index/package_index.json.sig
# if the number of files equals 26, consider the download done and exit
# TODO: Make this more robust by checking file names and sizes
if [ `find . | grep resources_ | wc -l` -eq 30 ]; then
  echo "Board resources already downloaded"
  exit 0
else
  echo "Downloading board resources"
fi

rm -fr resources_*

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
