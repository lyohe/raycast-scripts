#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Extract Google Sheets ID
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 📊
// @raycast.packageName Clipboard Utils
// @raycast.description Extract the spreadsheet ID from a Google Sheets URL in the clipboard.
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

func extractSpreadsheetID(from text: String) -> String? {
  guard let components = URLComponents(string: text),
    let scheme = components.scheme?.lowercased(),
    ["https", "http"].contains(scheme),
    components.host?.lowercased() == "docs.google.com"
  else {
    return nil
  }

  let path = components.percentEncodedPath
  let pattern = #"^/spreadsheets/(?:u/[0-9]+/)?d/([A-Za-z0-9_-]+)(?:/|$)"#
  guard let regex = try? NSRegularExpression(pattern: pattern),
    let match = regex.firstMatch(in: path, range: NSRange(path.startIndex..<path.endIndex, in: path)),
    let idRange = Range(match.range(at: 1), in: path)
  else {
    return nil
  }

  let spreadsheetID = String(path[idRange])
  // Published URLs use /d/e/<publication ID>, not a spreadsheet ID.
  return spreadsheetID == "e" ? nil : spreadsheetID
}

guard let text = getClipboardText()?.trimmingCharacters(in: .whitespacesAndNewlines),
  !text.isEmpty
else {
  fputs("No text found in clipboard.\n", stderr)
  exit(1)
}

guard let spreadsheetID = extractSpreadsheetID(from: text) else {
  fputs("No spreadsheet ID found in the clipboard Google Sheets URL.\n", stderr)
  exit(1)
}

setClipboardText(spreadsheetID)
print(spreadsheetID)
