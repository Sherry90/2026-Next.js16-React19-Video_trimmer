#!/bin/bash
# Generate a minimal test video for E2E tests
# Requirements: ffmpeg installed
# Output: ~50KB MP4 with H.264 video + AAC audio (5 seconds, 320x240)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/src/__tests__/e2e/fixtures"
OUTPUT_FILE="$OUTPUT_DIR/test-video.mp4"

mkdir -p "$OUTPUT_DIR"

if [ -f "$OUTPUT_FILE" ]; then
  echo "test-video.mp4 already exists, skipping generation"
  exit 0
fi

echo "Generating test video..."

ffmpeg -f lavfi -i testsrc2=duration=5:size=320x240:rate=15 \
       -f lavfi -i sine=frequency=440:duration=5 \
       -c:v libx264 -preset ultrafast -crf 28 \
       -c:a aac -b:a 64k \
       -movflags +faststart -y \
       "$OUTPUT_FILE"

echo "Generated: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"
