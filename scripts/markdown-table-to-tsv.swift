#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Markdown Table to TSV
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 📊
// @raycast.packageName Data Converters
// @raycast.description Convert a Markdown table from the clipboard to TSV and copy it back.
// @raycast.output clipboard

import AppKit
import Foundation

enum MarkdownTableError: LocalizedError {
  case invalidTable
  case columnCountMismatch(Int)

  var errorDescription: String? {
    switch self {
    case .invalidTable:
      return "Expected a Markdown table with a header and separator row."
    case .columnCountMismatch(let line):
      return "Column count does not match the header on line \(line)."
    }
  }
}

func parseMarkdownRow(_ line: String) -> (cells: [String], hasPipe: Bool) {
  let row = line.trimmingCharacters(in: .whitespaces)
  var cells: [String] = []
  var cell = ""
  var backslashes = 0
  var hasPipe = false
  var endsWithPipe = false

  for character in row {
    endsWithPipe = character == "|" && backslashes % 2 == 0
    if endsWithPipe {
      cells.append(cell)
      cell = ""
      hasPipe = true
    } else {
      if character == "|" {
        // Only consume the backslash escaping a pipe; preserve other Markdown.
        cell.removeLast()
      }
      cell.append(character)
    }
    backslashes = character == "\\" ? backslashes + 1 : 0
  }
  cells.append(cell)

  if row.hasPrefix("|") {
    cells.removeFirst()
  }
  if endsWithPipe {
    cells.removeLast()
  }

  return (cells.map { $0.trimmingCharacters(in: .whitespaces) }, hasPipe)
}

func tsvField(_ cell: String) -> String {
  if cell.contains("\t") || cell.contains("\"") {
    return "\"" + cell.replacingOccurrences(of: "\"", with: "\"\"") + "\""
  }
  return cell
}

func markdownTableToTSV(_ text: String) throws -> String {
  let lines = text
    .replacingOccurrences(of: "\r\n", with: "\n")
    .replacingOccurrences(of: "\r", with: "\n")
    .trimmingCharacters(in: .whitespacesAndNewlines)
    .components(separatedBy: "\n")

  guard lines.count >= 2 else {
    throw MarkdownTableError.invalidTable
  }

  let header = parseMarkdownRow(lines[0])
  let separator = parseMarkdownRow(lines[1]).cells
  guard header.hasPipe, !header.cells.isEmpty,
    separator.count == header.cells.count,
    separator.allSatisfy({ $0.range(of: #"^:?-+:?$"#, options: .regularExpression) != nil })
  else {
    throw MarkdownTableError.invalidTable
  }

  var rows = [header.cells]
  for (index, line) in lines.enumerated().dropFirst(2) {
    let row = parseMarkdownRow(line).cells
    guard !line.trimmingCharacters(in: .whitespaces).isEmpty,
      row.count == header.cells.count
    else {
      throw MarkdownTableError.columnCountMismatch(index + 1)
    }
    rows.append(row)
  }

  return rows.map { $0.map(tsvField).joined(separator: "\t") }.joined(separator: "\n") + "\n"
}

// Validate and convert before replacing the clipboard contents.
guard let text = NSPasteboard.general.string(forType: .string),
  !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
else {
  fputs("No Markdown table found in clipboard.\n", stderr)
  exit(1)
}

do {
  let tsv = try markdownTableToTSV(text)
  NSPasteboard.general.clearContents()
  guard NSPasteboard.general.setString(tsv, forType: .string) else {
    fputs("Failed to write TSV to clipboard.\n", stderr)
    exit(1)
  }
  print("✅ TSV copied to clipboard")
} catch {
  fputs("Invalid Markdown table in clipboard: \(error.localizedDescription)\n", stderr)
  exit(1)
}
