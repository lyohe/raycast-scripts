#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Decode URL
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🔓
// @raycast.packageName Clipboard Utils
// @raycast.description Percent-decode clipboard text from a URL-encoded string.
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

guard let decodedText = text.removingPercentEncoding else {
  fputs("Invalid percent-encoded text in clipboard.\n", stderr)
  exit(1)
}

setClipboardText(decodedText)
print(decodedText)
