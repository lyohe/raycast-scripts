#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title New YouTube-like ID
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 📺
// @raycast.packageName ID Generators
// @raycast.description Generate a YouTube-like ID (11 characters) and copy it to the clipboard.
// @raycast.output clipboard

import AppKit
import Foundation
import Security

/// Generate a YouTube-like ID with 11 characters
/// Uses the character set: A-Z, a-z, 0-9, -, _
func generateYouTubeLikeID() -> String {
  let charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  let charsetArray = Array(charset)
  let charsetCount = charsetArray.count
  
  var id = ""
  var randomBytes = [UInt8](repeating: 0, count: 11)
  
  let status = SecRandomCopyBytes(kSecRandomDefault, 11, &randomBytes)
  precondition(status == errSecSuccess)
  
  for byte in randomBytes {
    let index = Int(byte) % charsetCount
    id.append(charsetArray[index])
  }
  
  return id
}

let youtubeLikeID = generateYouTubeLikeID()

NSPasteboard.general.clearContents()
NSPasteboard.general.setString(youtubeLikeID, forType: .string)

print(youtubeLikeID)
