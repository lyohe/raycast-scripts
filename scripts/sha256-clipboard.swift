#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title SHA-256 Clipboard
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🔒
// @raycast.packageName Clipboard Utils
// @raycast.description Hash clipboard text with SHA-256 and copy the digest to the clipboard.
// @raycast.output clipboard

import AppKit
import CryptoKit
import Foundation

func getClipboardText() -> String? {
  NSPasteboard.general.string(forType: .string)
}

func setClipboardText(_ text: String) {
  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(text, forType: .string)
}

func sha256HexDigest(_ text: String) -> String {
  let digest = SHA256.hash(data: Data(text.utf8))
  return digest.map { String(format: "%02x", $0) }.joined()
}

guard let text = getClipboardText(), !text.isEmpty else {
  fputs("No text found in clipboard.\n", stderr)
  exit(1)
}

let digest = sha256HexDigest(text)
setClipboardText(digest)
print(digest)
