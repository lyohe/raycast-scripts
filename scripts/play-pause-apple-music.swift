#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Play/Pause Apple Music
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🎵
// @raycast.packageName Music
// @raycast.description Toggle Apple Music playback (playing -> pause, paused/stopped -> play).

import Foundation

let source = """
tell application "Music"
  if it is running then
    if player state is playing then
      pause
      return "Paused"
    else
      play
      return "Playing"
    end if
  else
    play
    return "Playing"
  end if
end tell
"""

let script = NSAppleScript(source: source)
var errorInfo: NSDictionary?
let result = script?.executeAndReturnError(&errorInfo)

if let errorInfo = errorInfo {
  let message = (errorInfo[NSAppleScript.errorMessage] as? String) ?? "Unknown error"
  fputs("🚫 \(message)\n", stderr)
  exit(1)
}

if let output = result?.stringValue, !output.isEmpty {
  print(output)
} else {
  print("OK")
}
