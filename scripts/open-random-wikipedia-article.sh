#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Random Wikipedia Article
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 📚
# @raycast.packageName Wikipedia
# @raycast.description Open a random English Wikipedia article in the default browser.

set -euo pipefail

open "https://en.wikipedia.org/wiki/Special:Random"
echo "Opened a random English Wikipedia article"
