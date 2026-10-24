#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Decode Base64
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🔓
// @raycast.packageName Clipboard Utils
// @raycast.description Decode Base64 clipboard text as UTF-8 and copy it back to the clipboard.
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

let base64Text = text.components(separatedBy: .whitespacesAndNewlines).joined()

guard !base64Text.isEmpty,
  let decodedData = Data(base64Encoded: base64Text),
  decodedData.base64EncodedString() == base64Text
else {
  fputs("Invalid Base64 text in clipboard.\n", stderr)
  exit(1)
}

guard let decodedText = String(data: decodedData, encoding: .utf8) else {
  fputs("Decoded Base64 is not valid UTF-8 text.\n", stderr)
  exit(1)
}

setClipboardText(decodedText)
print(decodedText)
