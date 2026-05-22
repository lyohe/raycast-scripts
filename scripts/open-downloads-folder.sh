#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Downloads Folder
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 📁
# @raycast.packageName Finder
# @raycast.description Open the Downloads folder in Finder.

set -euo pipefail

downloads_dir="${HOME}/Downloads"

if [[ ! -d "$downloads_dir" ]]; then
  echo "Downloads folder not found: $downloads_dir" >&2
  exit 1
fi

open -a Finder "$downloads_dir"
echo "Opened Downloads folder"
