#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title New UUID v7
// @raycast.mode compact
//
// Optional parameters:
// @raycast.icon 🆔
// @raycast.packageName UUID Utilities
// @raycast.description Generate a draft-spec UUID version 7 and copy it to the clipboard.
// @raycast.output clipboard

import AppKit
import Foundation
import Security

/// Generate a UUID version 7 (RFC 9562: https://datatracker.ietf.org/doc/html/rfc9562).
/// Layout (big-endian):
/// • bits 0-47   : Unix epoch millis
/// • bits 48-51  : version (0b0111)
/// • bits 52-63  : 12 random bits
/// • bits 64-65  : variant (0b10)
/// • bits 66-127 : 62 random bits
func uuidV7() -> String {
  let ts = UInt64(Date().timeIntervalSince1970 * 1000)

  var bytes = [UInt8](repeating: 0, count: 16)
  // timestamp (48 bits, big-endian)
  for i in 0..<6 { bytes[i] = UInt8((ts >> (8 * (5 - i))) & 0xFF) }

  // 10 bytes of CSPRNG
  let status = SecRandomCopyBytes(kSecRandomDefault, 10, &bytes[6])
  precondition(status == errSecSuccess)

  // set version (0b0111)
  bytes[6] = (bytes[6] & 0x0F) | 0x70

  // set variant (RFC 4122, 0b10xxxxxx)
  bytes[8] = (bytes[8] & 0x3F) | 0x80

  // convert to canonical UUID string (8-4-4-4-12 hex digits)
  let hex = bytes.map { String(format: "%02x", $0) }.joined()
  return
    "\(hex.prefix(8))-\(hex.dropFirst(8).prefix(4))-"
    + "\(hex.dropFirst(12).prefix(4))-\(hex.dropFirst(16).prefix(4))-" + "\(hex.dropFirst(20))"
}

let uuid = uuidV7()

NSPasteboard.general.clearContents()
NSPasteboard.general.setString(uuid, forType: .string)

print(uuid)
