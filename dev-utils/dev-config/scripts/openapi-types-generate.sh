#!/usr/bin/env bash

CONVERTER_URL=https://converter.swagger.io/api/convert
# Required: uncomment the definition url you want to use, or add your own
# DEFINITION_URL=<YOUR_DEFINITION_URL>
# e.g.
DEFINITION_URL=https://raw.githubusercontent.com/arduino/arduino-app-cli/refs/heads/rename-to-builtin/internal/api/docs/openapi.yaml

# Required: Add your desidered service name
SERVICE_NAME=orchestrator-api # e.g. iot-api, users-api, etc.
OUTPUT_FILE_NAME=$SERVICE_NAME.d.ts
PROJECT_ROOT=$(git rev-parse --show-toplevel)

mkdir ./temp

# Convert specification to openapi latest 3.x version
$PROJECT_ROOT/node_modules/.bin/openapi-typescript "$CONVERTER_URL?url=$DEFINITION_URL" --path-params-as-types --output ./temp/$OUTPUT_FILE_NAME

# Run prettier on them
$PROJECT_ROOT/node_modules/.bin/prettier --write ./temp/$OUTPUT_FILE_NAME

# Replace generic "{}" with appropriate "never"
sed -i -e 's/{}/never/g' ./temp/$OUTPUT_FILE_NAME

# Move to infrastructure
mv ./temp/$OUTPUT_FILE_NAME ../../app/infrastructure/src/$SERVICE_NAME/$OUTPUT_FILE_NAME

rm -rf ./temp