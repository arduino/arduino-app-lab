#!/bin/bash

ROOT=$(git rev-parse --show-toplevel)
cd $ROOT/standalone-apps/app-lab-desktop

./frontend/scripts/download.sh
wails dev -tags webkit2_41 -ldflags "-X main.version=0.0.0-$(git rev-parse --short HEAD)" 2>&1
