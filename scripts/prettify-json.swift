#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Prettify JSON
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🧾
// @raycast.packageName Clipboard Utils
// @raycast.description Format JSON text from the clipboard and copy it back to the clipboard.
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

func prettifyJSON(_ text: String) throws -> String {
  let data = Data(text.utf8)
  let jsonObject = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
  let prettyData = try JSONSerialization.data(
    withJSONObject: jsonObject,
    options: [.prettyPrinted, .withoutEscapingSlashes, .fragmentsAllowed]
  )

  guard let prettyText = String(data: prettyData, encoding: .utf8) else {
    throw CocoaError(.fileReadInapplicableStringEncoding)
  }

  return prettyText + "\n"
}

guard let text = getClipboardText(), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
  fputs("No JSON text found in clipboard.\n", stderr)
  exit(1)
}

do {
  let prettyText = try prettifyJSON(text)
  setClipboardText(prettyText)
  print(prettyText)
} catch {
  fputs("Invalid JSON in clipboard: \(error.localizedDescription)\n", stderr)
  exit(1)
}
