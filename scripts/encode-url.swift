#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Encode URL
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🔗
// @raycast.packageName Clipboard Utils
// @raycast.description Percent-encode clipboard text for use in URLs.
// @raycast.output clipboard

import AppKit
import Foundation

let unreservedURLCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

func getClipboardText() -> String? {
  NSPasteboard.general.string(forType: .string)
}

func setClipboardText(_ text: String) {
  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(text, forType: .string)
}

func percentEncode(_ text: String) -> String {
  var encoded = ""

  for scalar in text.unicodeScalars {
    if unreservedURLCharacters.contains(scalar) {
      encoded.unicodeScalars.append(scalar)
      continue
    }

    guard let data = String(scalar).data(using: .utf8) else {
      continue
    }

    for byte in data {
      encoded += String(format: "%%%02X", byte)
    }
  }

  return encoded
}

guard let text = getClipboardText(), !text.isEmpty else {
  fputs("No text found in clipboard.\n", stderr)
  exit(1)
}

let encodedText = percentEncode(text)
setClipboardText(encodedText)
print(encodedText)
