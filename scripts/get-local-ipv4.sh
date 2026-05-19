#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Get Local IPv4
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🖧
# @raycast.packageName Network Utilities
# @raycast.description Fetch the machine's local IPv4 address and copy it to the clipboard.
# @raycast.output clipboard

set -euo pipefail

interface="$(route get default 2>/dev/null | awk '/interface: / { print $2; exit }')"

if [[ -z "$interface" ]]; then
  echo "Could not determine the default network interface." >&2
  exit 1
fi

ip="$(ipconfig getifaddr "$interface" 2>/dev/null || true)"
ipv4_regex='^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$'

if [[ ! "$ip" =~ $ipv4_regex ]]; then
  echo "Could not determine a valid local IPv4 address for interface: $interface" >&2
  exit 1
fi

printf "%s" "$ip" | pbcopy
printf "%s\n" "$ip"
