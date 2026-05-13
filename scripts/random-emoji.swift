#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Random Emoji
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 😀
// @raycast.packageName Emoji Utilities
// @raycast.description Pick a random emoji and copy it to the clipboard.
// @raycast.output clipboard

import AppKit
import Foundation
import Security

func emojiFilePath() -> String {
  let scriptURL = URL(fileURLWithPath: #file)
  let repoRoot =
    scriptURL
    .deletingLastPathComponent()
    .deletingLastPathComponent()
  return repoRoot.appendingPathComponent("data/emoji.txt").path
}

func loadEmojis() throws -> [String] {
  let source = try String(contentsOfFile: emojiFilePath(), encoding: .utf8)
  return
    source
    .components(separatedBy: .newlines)
    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    .filter { !$0.isEmpty && !$0.hasPrefix("#") && isSingleDisplayEmoji($0) }
}

func isSingleDisplayEmoji(_ emoji: String) -> Bool {
  !emoji.unicodeScalars.contains { scalar in
    scalar.value == 0x200D || (0xE0020...0xE007F).contains(scalar.value)
  }
}

func secureRandomUInt32() -> UInt32 {
  var value: UInt32 = 0
  let status = withUnsafeMutableBytes(of: &value) { buffer in
    SecRandomCopyBytes(kSecRandomDefault, buffer.count, buffer.baseAddress!)
  }
  precondition(status == errSecSuccess)
  return value
}

func secureRandomIndex(upperBound: Int) -> Int {
  precondition(upperBound > 0)

  let bound = UInt64(upperBound)
  let randomSpaceSize = UInt64(UInt32.max) + 1
  let unbiasedZoneSize = (randomSpaceSize / bound) * bound

  while true {
    let randomValue = UInt64(secureRandomUInt32())
    if randomValue < unbiasedZoneSize {
      return Int(randomValue % bound)
    }
  }
}

do {
  let emojis = try loadEmojis()

  guard !emojis.isEmpty else {
    fputs("emoji.txt is empty.\n", stderr)
    exit(1)
  }

  let emoji = emojis[secureRandomIndex(upperBound: emojis.count)]

  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(emoji, forType: .string)

  print(emoji)
} catch {
  fputs("Failed to read emoji list: \(error.localizedDescription)\n", stderr)
  exit(1)
}
