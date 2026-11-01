/**
 * Utility to sanitize company and customer phone numbers.
 * Strips invisible Unicode directional control characters (e.g. \u202D, \u202C, \u200E, \u200F),
 * removes accidental leading hyphens/dashes, trims extraneous commas/slashes,
 * and normalizes whitespace.
 */
export function sanitizePhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  let cleaned = phone
    // Remove Unicode bidi and control characters
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    // Normalize dashes and slashes surrounded by spaces
    .replace(/\s*[\/|]\s*/g, " / ")
    // Remove leading hyphens or dashes on numbers (e.g. "-0720" -> "0720")
    .replace(/(^|[\/\s])[-–—]+(\d)/g, "$1$2")
    // Remove duplicate spaces
    .replace(/\s{2,}/g, " ")
    .trim();

  // Strip trailing commas, hyphens, slashes or spaces
  cleaned = cleaned.replace(/[,\s\/-]+$/, "");
  // Strip leading commas or slashes
  cleaned = cleaned.replace(/^[,\s\/-]+/, "");

  return cleaned;
}

export default sanitizePhoneNumber;
