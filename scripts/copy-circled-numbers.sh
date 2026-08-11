#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Copy Circled Numbers
# @raycast.mode compact
#
# Optional parameters:
# @raycast.icon 🔢
# @raycast.packageName Clipboard Utils
# @raycast.description Copy circled numbers from 1 through the specified end number.
# @raycast.argument1 { "type": "text", "placeholder": "End number (1-50)" }
# @raycast.output clipboard

set -euo pipefail

end_number="${1:-}"

if [[ ! "$end_number" =~ ^([1-9]|[1-4][0-9]|50)$ ]]; then
  echo "End number must be an integer from 1 to 50." >&2
  exit 1
fi

circled_numbers=(
  "①" "②" "③" "④" "⑤" "⑥" "⑦" "⑧" "⑨" "⑩"
  "⑪" "⑫" "⑬" "⑭" "⑮" "⑯" "⑰" "⑱" "⑲" "⑳"
  "㉑" "㉒" "㉓" "㉔" "㉕" "㉖" "㉗" "㉘" "㉙" "㉚"
  "㉛" "㉜" "㉝" "㉞" "㉟" "㊱" "㊲" "㊳" "㊴" "㊵"
  "㊶" "㊷" "㊸" "㊹" "㊺" "㊻" "㊼" "㊽" "㊾" "㊿"
)

output=""
for ((index = 0; index < end_number; index++)); do
  if ((index > 0)); then
    output+=$'\n'
  fi
  output+="${circled_numbers[index]}"
done

printf "%s" "$output" | pbcopy
printf "%s\n" "$output"
