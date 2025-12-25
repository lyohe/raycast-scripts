#!/usr/bin/swift
// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title URL Purifier
// @raycast.mode compact
// @raycast.packageName Clipboard Utils
//
// Optional parameters:
// @raycast.icon 🧼
// @raycast.description Remove tracking parameters and canonicalize Amazon links
// @raycast.argument1 { "type": "text", "placeholder": "URL (optional)", "optional": true }
//
// Documentation:
// @raycast.author lyohe
// @raycast.authorURL https://github.com/lyohe

import AppKit
import Foundation

let trackingParams: Set<String> = [
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "igsh",
  "mkt_tok",
  "vero_id",
  "vero_conv",
  "ttclid",
  "twclid",
  "yclid",
  "scid",
  "s_cid",
  "cmpid",
  "icid",
  "ocid",
  "si",
  "spm",
  "spm_id_from",
  "share",
  "share_id",
  "shareid",
  "ref",
  "ref_",
  "ref_src",
  "ref_url",
  "referrer",
  "referrer_id",
  "referral",
  "fb_action_ids",
  "fb_action_types",
  "fb_ref",
  "fb_source",
  "ga_campaign",
  "ga_source",
  "ga_medium",
  "ga_term",
  "ga_content",
  "mibextid",
  "at_campaign",
  "at_medium",
  "at_custom1",
  "at_custom2",
  "at_custom3",
  "at_custom4",
  "soc_src",
  "soc_trk",
  "tag",
]

let trackingPrefixes = ["utm_", "pk_"]

let amazonAsinPatterns = [
  "/dp/([A-Z0-9]{10})",
  "/gp/product/([A-Z0-9]{10})",
  "/gp/aw/d/([A-Z0-9]{10})",
  "/product/([A-Z0-9]{10})",
  "/exec/obidos/ASIN/([A-Z0-9]{10})",
  "/ASIN/([A-Z0-9]{10})",
]

let amazonAsinRegexes: [NSRegularExpression] = amazonAsinPatterns.compactMap {
  do {
    return try NSRegularExpression(pattern: $0, options: [.caseInsensitive])
  } catch {
    fputs("Warning: Failed to compile Amazon ASIN regex pattern \(String(reflecting: $0)): \(error)\n", stderr)
    return nil
  }
}

func getClipboardContent() -> String? {
  NSPasteboard.general.string(forType: .string)?.trimmingCharacters(in: .whitespacesAndNewlines)
}

func setClipboardContent(_ content: String) {
  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(content, forType: .string)
}

func normalizeInput(_ input: String) -> String? {
  let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else {
    return nil
  }

  if trimmed.contains("://") {
    return trimmed
  }

  let range = trimmed.range(of: #"^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}"#, options: .regularExpression)
  if range != nil {
    return "https://\(trimmed)"
  }

  return trimmed
}

func isValidURL(_ components: URLComponents?) -> Bool {
  guard let components, let scheme = components.scheme, let host = components.host else {
    return false
  }
  return !scheme.isEmpty && !host.isEmpty
}

func isTrackingParam(_ key: String) -> Bool {
  let lower = key.lowercased()
  if trackingParams.contains(lower) {
    return true
  }
  if lower.hasSuffix("clid") || lower.hasSuffix("clkid") {
    return true
  }
  if lower.hasPrefix("ref_") {
    return true
  }
  for prefix in trackingPrefixes where lower.hasPrefix(prefix) {
    return true
  }
  return false
}

func filteredQueryItems(_ queryItems: [URLQueryItem]) -> [URLQueryItem] {
  queryItems.filter { !isTrackingParam($0.name) }
}

func normalizedAmazonHost(_ host: String) -> String {
  var result = host.lowercased()
  for prefix in ["www.", "m.", "smile."] {
    if result.hasPrefix(prefix) {
      result.removeFirst(prefix.count)
      break
    }
  }
  return result
}

func isAmazonDomain(_ host: String) -> Bool {
  let lower = host.lowercased()
  return lower.contains("amazon.") && !lower.hasSuffix("amazonaws.com")
}

func extractAmazonASIN(from path: String) -> String? {
  for regex in amazonAsinRegexes {
    let range = NSRange(path.startIndex..<path.endIndex, in: path)
    if let match = regex.firstMatch(in: path, options: [], range: range),
       let matchRange = Range(match.range(at: 1), in: path) {
      return path[matchRange].uppercased()
    }
  }
  return nil
}

func extractAmazonASIN(from items: [URLQueryItem]?) -> String? {
  guard let items else {
    return nil
  }
  for item in items {
    if item.name.lowercased() == "asin", let value = item.value, !value.isEmpty {
      return value.uppercased()
    }
  }
  return nil
}

func canonicalAmazonURL(from components: URLComponents) -> String? {
  guard let host = components.host else {
    return nil
  }
  let asin = extractAmazonASIN(from: components.path) ?? extractAmazonASIN(from: components.queryItems)
  guard let asin else {
    return nil
  }

  var canonical = URLComponents()
  canonical.scheme = "https"
  canonical.host = normalizedAmazonHost(host)
  canonical.path = "/dp/\(asin)"
  return canonical.url?.absoluteString
}

func filterQueryString(_ query: String) -> String {
  var components = URLComponents()
  components.query = query
  guard let items = components.queryItems else {
    return ""
  }
  let cleaned = filteredQueryItems(items)
  if cleaned.isEmpty {
    return ""
  }
  components.queryItems = cleaned
  return components.percentEncodedQuery ?? ""
}

func cleanFragment(_ fragment: String) -> String {
  guard let markerIndex = fragment.firstIndex(of: "?") else {
    return fragment
  }

  let head = String(fragment[..<markerIndex])
  let tail = String(fragment[fragment.index(after: markerIndex)...])
  let cleanedQuery = filterQueryString(tail)
  if cleanedQuery.isEmpty {
    return head
  }
  return "\(head)?\(cleanedQuery)"
}

func cleanURL(_ input: String) -> String? {
  guard var components = URLComponents(string: input) else {
    return nil
  }

  if let host = components.host, isAmazonDomain(host),
     let canonical = canonicalAmazonURL(from: components) {
    return canonical
  }

  if let items = components.queryItems {
    let cleaned = filteredQueryItems(items)
    components.queryItems = cleaned.isEmpty ? nil : cleaned
  }

  if let fragment = components.fragment {
    let cleaned = cleanFragment(fragment)
    components.fragment = cleaned.isEmpty ? nil : cleaned
  }

  return components.url?.absoluteString ?? input
}

let argumentInput = CommandLine.arguments.dropFirst().joined(separator: " ")
let rawInput = argumentInput.isEmpty ? (getClipboardContent() ?? "") : argumentInput

guard let normalized = normalizeInput(rawInput),
      isValidURL(URLComponents(string: normalized)) else {
  fputs("Error: Invalid URL input: \(String(reflecting: rawInput))\n", stderr)
  exit(1)
}

guard let cleanedURL = cleanURL(normalized) else {
  fputs("Error: Failed to clean URL\n", stderr)
  exit(1)
}

setClipboardContent(cleanedURL)
print(cleanedURL)
