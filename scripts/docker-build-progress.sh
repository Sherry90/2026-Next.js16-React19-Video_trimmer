#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-image}"
if [[ $# -gt 0 ]]; then
  shift
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
LOG_DIR=".logs"
mkdir -p "$LOG_DIR"

case "$MODE" in
  image)
    IMAGE_NAME="${IMAGE_NAME:-video-trimmer}"
    LOG_FILE="$LOG_DIR/docker-build-$TIMESTAMP.log"
    CMD=(docker build --progress=plain -t "$IMAGE_NAME" "$@" .)
    ;;
  compose)
    LOG_FILE="$LOG_DIR/docker-compose-build-$TIMESTAMP.log"
    CMD=(docker compose build --progress=plain "$@")
    ;;
  *)
    echo "Usage: $0 [image|compose] [extra docker args...]" >&2
    exit 1
    ;;
esac

echo "Starting: ${CMD[*]}"
echo "Log file: $LOG_FILE"

set +e
"${CMD[@]}" 2>&1 | tee "$LOG_FILE"
STATUS=${PIPESTATUS[0]}
set -e

if [[ $STATUS -eq 0 ]]; then
  echo "Build completed successfully"
else
  echo "Build failed with exit code $STATUS" >&2
fi

exit "$STATUS"
