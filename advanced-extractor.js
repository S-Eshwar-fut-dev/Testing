/*
 * ELITE Intelligence Extractor — COMMENTED OUT
 * Currently using extractor.js for GUVI compatibility (6 basic fields).
 * Uncomment this file and switch server.js imports to enable 25+ data points.
 */

/*
// ═══ CONTACT & PAYMENT INFORMATION ═══
const UPI_REGEX = /[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}/g;
const UPI_REGEX_2 = /[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+@[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+91[\s\-]?)?[6-9]\d{9}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;

// ═══ FINANCIAL IDENTIFIERS ═══
const BANK_ACCOUNT_REGEX = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?:[\s\-]?\d{0,6})?\b/g;
const IFSC_REGEX = /[A-Z]{4}0[A-Z0-9]{6}/g;
const CRYPTO_WALLET_REGEX = /\b(bc1|0x|3)[a-zA-Z0-9]{25,42}\b/g;

// ═══ REFERENCE & TRACKING IDs ═══
const TRANSACTION_ID_REGEX = /(?:txn|transaction|ref|reference|id|ticket|case)[\s:]*([A-Z0-9]{6,20})/gi;
const ORDER_ID_REGEX = /(?:order|invoice|bill)[\s#:]*([A-Z0-9]{6,15})/gi;

// ═══ MONEY AMOUNT DETECTION ═══
const MONEY_REGEX = /(?:rs\.?|₹|inr)?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\s*(?:lakh|crore|thousand|hundred|rupee|rs\.?))?/gi;

// ═══ APP & SOFTWARE MENTIONS ═══
const APPS = [
  'teamviewer', 'anydesk', 'quicksupport', 'remotely', 'supremo',
  'chrome remote', 'ammyy', 'ultraviewer', 'rustdesk',
  'paytm', 'phonepe', 'gpay', 'google pay', 'bhim', 'whatsapp pay'
];

// ═══ AUTHORITY IMPERSONATION ═══
const FAKE_AUTHORITIES = [
  'police', 'cyber cell', 'cyber crime', 'cbi', 'ed', 'income tax',
  'rbi', 'sebi', 'customs', 'narcotics', 'enforcement directorate',
  'supreme court', 'high court', 'magistrate', 'judge', 'microsoft'
];

// ═══ BANK NAMES ═══
const BANKS = [
  'sbi', 'hdfc', 'icici', 'axis', 'kotak', 'pnb', 'canara', 'bob',
  'union bank', 'indian bank', 'idbi', 'yes bank', 'indusind'
];

// ═══ URGENCY KEYWORDS ═══
const URGENCY_KEYWORDS = [
  'urgent', 'immediately', 'right now', 'within 24 hours', 'today only',
  'last chance', 'final warning', 'expire', 'block', 'suspend', 'freeze',
  'arrest warrant', 'legal action', 'court case', 'fine', 'penalty'
];

// ═══ SOCIAL ENGINEERING TACTICS ═══
const TACTICS = {
  FEAR: ['arrest', 'warrant', 'police', 'jail', 'court', 'illegal', 'fraud case'],
  GREED: ['won', 'prize', 'lottery', 'reward', 'cashback', 'bonus', 'offer'],
  URGENCY: ['immediately', 'urgent', 'expire', 'last chance', 'within'],
  AUTHORITY: ['officer', 'government', 'official', 'department', 'ministry'],
  TRUST: ['verify', 'confirm', 'update', 'kyc', 'secure', 'protect']
};

function extractAdvancedIntelligence(text) {
  if (!text || typeof text !== "string") {
    return getEmptyIntelligence();
  }

  const lowerText = text.toLowerCase();

  return {
    emails: extractEmails(text),
    upiIds: extractUPIs(text),
    phoneNumbers: extractUnique(text, PHONE_REGEX),
    phishingLinks: extractUnique(text, URL_REGEX),
    bankAccounts: extractUnique(text, BANK_ACCOUNT_REGEX),
    ifscCodes: extractUnique(text, IFSC_REGEX),
    cryptoWallets: extractUnique(text, CRYPTO_WALLET_REGEX),
    moneyAmounts: extractMoneyAmounts(text),
    transactionIds: extractGroups(text, TRANSACTION_ID_REGEX, 1),
    orderIds: extractGroups(text, ORDER_ID_REGEX, 1),
    banksImpersonated: findMatches(lowerText, BANKS),
    authoritiesImpersonated: findMatches(lowerText, FAKE_AUTHORITIES),
    appsRequested: findMatches(lowerText, APPS),
    urgencyLevel: calculateUrgency(lowerText),
    tacticUsed: identifyTactic(lowerText),
    threatType: classifyThreat(lowerText),
    suspiciousKeywords: findSuspiciousKeywords(lowerText),
    messageLength: text.length,
    hasNumbers: /\d/.test(text),
    hasLinks: /https?:\/\//.test(text),
    scamType: classifyScamType(lowerText),
    sophisticationLevel: assessSophistication(text),
    credibilityMarkers: findCredibilityMarkers(text),
  };
}

function extractEmails(text) { ... }
function extractUPIs(text) { ... }
function extractUnique(text, regex) { ... }
function extractGroups(text, regex, group) { ... }
function extractMoneyAmounts(text) { ... }
function findMatches(text, keywords) { ... }
function findSuspiciousKeywords(text) { ... }
function calculateUrgency(text) { ... }
function identifyTactic(text) { ... }
function classifyThreat(text) { ... }
function classifyScamType(text) { ... }
function assessSophistication(text) { ... }
function findCredibilityMarkers(text) { ... }
function getEmptyIntelligence() { ... }
function mergeAdvancedIntelligence(existing, newData) { ... }

module.exports = {
  extractAdvancedIntelligence,
  mergeAdvancedIntelligence,
  getEmptyIntelligence,
};
*/
