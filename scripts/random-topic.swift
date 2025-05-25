#!/usr/bin/swift
// --------------------------------------------
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Random Chitchat Topic
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 💬
//
// Documentation:
// @raycast.description Read ../data/random-topic.txt and display one random line.
// --------------------------------------------

import AppKit
import Foundation

// Resolve absolute path to the topic file
func topicFilePath() -> String {
  let scriptURL = URL(fileURLWithPath: #file)  // …/scripts/random-topic.swift
  let repoRoot =
    scriptURL
    .deletingLastPathComponent()  // …/scripts
    .deletingLastPathComponent()  // …/        ← repository root
  let dataURL = repoRoot.appendingPathComponent("data/random-topic.txt")
  return dataURL.path
}

// Load text and pick one line at random
do {
  let path = topicFilePath()
  let source = try String(contentsOfFile: path, encoding: .utf8)
  let topics =
    source
    .components(separatedBy: .newlines)
    .map { $0.trimmingCharacters(in: .whitespaces) }
    .filter { !$0.isEmpty }

  guard let topic = topics.randomElement() else {
    fputs("⚠️ \(path) is empty or contains only blank lines.\n", stderr)
    exit(1)
  }

  // Copy to clipboard
  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(topic, forType: .string)

  print(topic)
} catch {
  fputs("🚫 Failed to read file: \(error.localizedDescription)\n", stderr)
  exit(1)
}
