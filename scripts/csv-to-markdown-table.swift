#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title CSV/TSV to Markdown Table
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 📊
// @raycast.packageName Data Converters
// @raycast.description Convert CSV or TSV data from clipboard to markdown table format
// @raycast.output clipboard

import AppKit
import Foundation

func parseCSVLine(_ line: String) -> [String] {
  var fields: [String] = []
  var currentField = ""
  var inQuotes = false
  var previousChar: Character?
  
  for char in line {
    if char == "\"" {
      if inQuotes && previousChar == "\"" {
        // Escaped quote
        currentField.append(char)
        previousChar = nil
        continue
      } else if inQuotes {
        // Potentially ending quotes
        previousChar = char
        continue
      } else if currentField.isEmpty {
        // Starting quotes
        inQuotes = true
        previousChar = char
        continue
      } else {
        // Quote in middle of unquoted field
        currentField.append(char)
      }
    } else if char == "," && !inQuotes {
      // Field separator
      fields.append(currentField.trimmingCharacters(in: .whitespaces))
      currentField = ""
      previousChar = char
    } else {
      if previousChar == "\"" && inQuotes {
        // Close quotes
        inQuotes = false
      }
      currentField.append(char)
      previousChar = char
    }
  }
  
  // Don't forget the last field
  if previousChar == "\"" && inQuotes {
    inQuotes = false
  }
  fields.append(currentField.trimmingCharacters(in: .whitespaces))
  
  return fields
}

func parseCSVTSV(_ input: String) -> [[String]] {
  let lines = input.components(separatedBy: .newlines).filter { !$0.isEmpty }
  
  if lines.isEmpty {
    return []
  }
  
  // Detect delimiter (tab or comma)
  let firstLine = lines[0]
  let delimiter: Character = firstLine.contains("\t") ? "\t" : ","
  
  var rows: [[String]] = []
  
  for line in lines {
    if delimiter == "\t" {
      rows.append(line.components(separatedBy: "\t"))
    } else {
      // Proper CSV parsing that handles quoted fields with commas
      rows.append(parseCSVLine(line))
    }
  }
  
  return rows
}

func generateMarkdownTable(_ data: [[String]]) -> String {
  guard !data.isEmpty else {
    return ""
  }
  
  // Calculate column widths
  var columnWidths: [Int] = []
  let columnCount = data[0].count
  
  for colIndex in 0..<columnCount {
    var maxWidth = 0
    for row in data {
      if colIndex < row.count {
        maxWidth = max(maxWidth, row[colIndex].count)
      }
    }
    columnWidths.append(max(maxWidth, 3)) // Minimum width of 3 for "---"
  }
  
  var markdownTable = ""
  
  // Generate header row
  if data.count > 0 {
    var headerRow = "|"
    for (index, cell) in data[0].enumerated() {
      if index < columnWidths.count {
        headerRow += " " + cell.padding(toLength: columnWidths[index], withPad: " ", startingAt: 0) + " |"
      }
    }
    markdownTable += headerRow + "\n"
    
    // Generate separator row
    var separatorRow = "|"
    for width in columnWidths {
      separatorRow += " " + String(repeating: "-", count: width) + " |"
    }
    markdownTable += separatorRow + "\n"
    
    // Generate data rows
    for rowIndex in 1..<data.count {
      var dataRow = "|"
      for (colIndex, cell) in data[rowIndex].enumerated() {
        if colIndex < columnWidths.count {
          dataRow += " " + cell.padding(toLength: columnWidths[colIndex], withPad: " ", startingAt: 0) + " |"
        }
      }
      markdownTable += dataRow + "\n"
    }
  }
  
  return markdownTable
}

// Read from clipboard
guard let clipboardString = NSPasteboard.general.string(forType: .string) else {
  print("❌ No text found in clipboard")
  exit(1)
}

let data = parseCSVTSV(clipboardString)

if data.isEmpty {
  print("❌ No CSV/TSV data found in clipboard")
  exit(1)
}

let markdownTable = generateMarkdownTable(data)

// Copy to clipboard
NSPasteboard.general.clearContents()
NSPasteboard.general.setString(markdownTable, forType: .string)

print("✅ Markdown table copied to clipboard")