#!/bin/bash
set -e

# 1. Check if 'licensed' is installed
if ! command -v licensed &> /dev/null; then
  echo "❌ Error: 'licensed' is not installed."
  exit 1
fi

# 2. Create output directory
OUTPUT_DIR="standalone-apps/app-lab-desktop/build/debian/arduino-app-lab/usr/share/doc/arduino-app-lab"
mkdir -p "$OUTPUT_DIR"

# 3. Run licensed commands
licensed cache || echo "Platform packages have been skipped"
licensed notices

# 4. Combine LICENSE + NOTICE into copyright
if [ -f LICENSE ]; then
  cat ".licenses/NOTICE" >> "$OUTPUT_DIR/copyright"
  echo "✅ copyright file created at $OUTPUT_DIR/copyright"
else
  echo "❌ LICENSE file not found. Cannot create copyright file."
  exit 1
fi
