#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Encode Base64
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🔐
// @raycast.packageName Clipboard Utils
// @raycast.description Base64-encode clipboard text as UTF-8 and copy it back to the clipboard.
// @raycast.output clipboard

import AppKit
import Foundation

func getClipboardText() -> String? {
  NSPasteboard.general.string(forType: .string)
}

func setClipboardText(_ text: String) {
  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(text, forType: .string)
}

guard let text = getClipboardText(), !text.isEmpty else {
  fputs("No text found in clipboard.\n", stderr)
  exit(1)
}

let encodedText = Data(text.utf8).base64EncodedString()
setClipboardText(encodedText)
print(encodedText)
