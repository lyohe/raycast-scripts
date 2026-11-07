#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Decode JWT
// @raycast.mode fullOutput
//
// Optional parameters:
// @raycast.icon 🔎
// @raycast.packageName Clipboard Utils
// @raycast.description Display the header and payload of a JWT from the clipboard. The signature is not verified.

import AppKit
import Foundation

struct JWTDecodeError: LocalizedError {
  let errorDescription: String?

  init(_ message: String) {
    errorDescription = message
  }
}

func decodeBase64URL(_ text: String, name: String) throws -> Data {
  let allowedCharacters = CharacterSet(
    charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  )
  guard text.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) else {
    throw JWTDecodeError("Invalid Base64URL in JWT \(name).")
  }

  let base64 = text.replacingOccurrences(of: "-", with: "+")
    .replacingOccurrences(of: "_", with: "/")
  let padding = String(repeating: "=", count: (4 - base64.count % 4) % 4)
  guard let data = Data(base64Encoded: base64 + padding) else {
    throw JWTDecodeError("Invalid Base64URL in JWT \(name).")
  }

  let canonical = data.base64EncodedString()
    .replacingOccurrences(of: "+", with: "-")
    .replacingOccurrences(of: "/", with: "_")
    .replacingOccurrences(of: "=", with: "")
  guard canonical == text else {
    throw JWTDecodeError("Invalid Base64URL in JWT \(name).")
  }

  return data
}

func prettifyJWTPart(_ text: String, name: String) throws -> String {
  let data = try decodeBase64URL(text, name: name)
  guard String(data: data, encoding: .utf8) != nil,
    let object = try? JSONSerialization.jsonObject(with: data),
    object is [String: Any]
  else {
    throw JWTDecodeError("JWT \(name) must be a UTF-8 JSON object.")
  }

  let prettyData = try JSONSerialization.data(
    withJSONObject: object,
    options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
  )
  return String(decoding: prettyData, as: UTF8.self)
}

func decodeJWT(_ text: String) throws -> String {
  let token = text.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !token.isEmpty else {
    throw JWTDecodeError("No JWT text found in clipboard.")
  }

  let parts = token.components(separatedBy: ".")
  guard parts.count != 5 else {
    throw JWTDecodeError("Encrypted JWTs (JWE) are not supported.")
  }
  guard parts.count == 3 else {
    throw JWTDecodeError("Invalid JWT: expected header.payload.signature.")
  }

  let header = try prettifyJWTPart(parts[0], name: "header")
  let payload = try prettifyJWTPart(parts[1], name: "payload")
  _ = try decodeBase64URL(parts[2], name: "signature")

  return "Signature not verified.\n\nHeader\n\(header)\n\nPayload\n\(payload)"
}

guard let text = NSPasteboard.general.string(forType: .string) else {
  fputs("No JWT text found in clipboard.\n", stderr)
  exit(1)
}

do {
  print(try decodeJWT(text))
} catch {
  fputs("\(error.localizedDescription)\n", stderr)
  exit(1)
}
