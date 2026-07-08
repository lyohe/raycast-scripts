#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Copy UNIX Timestamp
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🕒
# @raycast.packageName Date & Time
# @raycast.description Copy the current UNIX timestamp to the clipboard.
# @raycast.output clipboard

set -euo pipefail

timestamp="$(date +%s)"

if [[ ! "$timestamp" =~ ^[0-9]+$ ]]; then
  echo "Invalid UNIX timestamp: $timestamp" >&2
  exit 1
fi

printf "%s" "$timestamp" | pbcopy
printf "%s\n" "$timestamp"
