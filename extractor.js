/**
 * Intelligence Extractor — regex-based extraction of
 * UPI IDs, phone numbers, URLs, bank accounts, and suspicious keywords
 * from scammer messages.
 */

// Regex patterns
const UPI_REGEX = /[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+91[\s\-]?)?[6-9]\d{9}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
const BANK_ACCOUNT_REGEX = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?:[\s\-]?\d{0,6})?\b/g;

const SUSPICIOUS_KEYWORDS = [
  "urgent",
  "verify now",
  "account blocked",
  "kyc expired",
  "click here",
  "immediately",
  "suspended",
  "fine",
  "penalty",
  "last warning",
  "within 24 hours",
  "action required",
  "download",
  "install",
  "quick support",
  "anydesk",
  "team viewer",
  "teamviewer",
  "remote access",
  "otp",
  "share otp",
  "send otp",
  "registration fee",
  "processing fee",
  "pay now",
  "transfer",
];

/**
 * Extract intelligence from a message text.
 * @param {string} text - The scammer's message
 * @returns {{ upiIds: string[], phoneNumbers: string[], phishingLinks: string[], bankAccounts: string[], suspiciousKeywords: string[] }}
 */
function extractIntelligence(text) {
  if (!text || typeof text !== "string") {
    return {
      upiIds: [],
      phoneNumbers: [],
      phishingLinks: [],
      bankAccounts: [],
      suspiciousKeywords: [],
    };
  }

  const lowerText = text.toLowerCase();

  // Extract UPI IDs (filter out emails - basic heuristic)
  const upiMatches = text.match(UPI_REGEX) || [];
  const upiIds = upiMatches.filter((match) => {
    const domain = match.split("@")[1].toLowerCase();
    // Common UPI handles vs email domains
    const emailDomains = ["gmail", "yahoo", "hotmail", "outlook", "mail", "protonmail"];
    return !emailDomains.some((d) => domain.startsWith(d));
  });

  // Extract phone numbers
  const phoneMatches = text.match(PHONE_REGEX) || [];
  const phoneNumbers = [...new Set(phoneMatches.map((p) => p.replace(/[\s\-]/g, "")))];

  // Extract URLs
  const phishingLinks = text.match(URL_REGEX) || [];

  // Extract bank account numbers
  const bankAccounts = text.match(BANK_ACCOUNT_REGEX) || [];

  // Find suspicious keywords
  const suspiciousKeywords = SUSPICIOUS_KEYWORDS.filter((kw) =>
    lowerText.includes(kw)
  );

  return {
    upiIds: [...new Set(upiIds)],
    phoneNumbers: [...new Set(phoneNumbers)],
    phishingLinks: [...new Set(phishingLinks)],
    bankAccounts: [...new Set(bankAccounts)],
    suspiciousKeywords: [...new Set(suspiciousKeywords)],
  };
}

/**
 * Merge new intelligence data into existing accumulated data.
 * Deduplicates across all fields.
 */
function mergeIntelligence(existing, newData) {
  return {
    upiIds: [...new Set([...existing.upiIds, ...newData.upiIds])],
    phoneNumbers: [...new Set([...existing.phoneNumbers, ...newData.phoneNumbers])],
    phishingLinks: [...new Set([...existing.phishingLinks, ...newData.phishingLinks])],
    bankAccounts: [...new Set([...existing.bankAccounts, ...newData.bankAccounts])],
    suspiciousKeywords: [...new Set([...existing.suspiciousKeywords, ...newData.suspiciousKeywords])],
  };
}

module.exports = { extractIntelligence, mergeIntelligence };
