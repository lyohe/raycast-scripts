#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Copy Finder Path
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 📋
# @raycast.packageName Finder
# @raycast.description Copy the current Finder window path to the clipboard.
# @raycast.output clipboard

set -euo pipefail

finder_path="$(osascript <<'APPLESCRIPT'
tell application "Finder"
  if (count of windows) is 0 then
    set currentPath to POSIX path of (desktop as alias)
  else
    set currentPath to POSIX path of ((target of front window) as alias)
  end if
end tell

return currentPath
APPLESCRIPT
)"

printf "%s" "$finder_path" | pbcopy
printf "%s\n" "$finder_path"
