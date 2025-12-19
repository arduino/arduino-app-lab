#!/bin/bash

ROOT=$(git rev-parse --show-toplevel)
cd $ROOT/standalone-apps/app-lab-desktop

./internal/board/download_resources.sh &
./internal/emoji/download_emojis.sh &
./internal/learn/download_learn.sh &
wait
