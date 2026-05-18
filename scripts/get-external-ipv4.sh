#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Get External IPv4
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🌐
# @raycast.packageName Network Utilities
# @raycast.description Fetch the machine's external IPv4 address and copy it to the clipboard.
# @raycast.output clipboard

set -euo pipefail

ip="$(curl -4fsS --max-time 10 https://api.ipify.org)"
ipv4_regex='^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$'

if [[ ! "$ip" =~ $ipv4_regex ]]; then
  echo "Invalid IPv4 response: $ip" >&2
  exit 1
fi

printf "%s" "$ip" | pbcopy
printf "%s\n" "$ip"
