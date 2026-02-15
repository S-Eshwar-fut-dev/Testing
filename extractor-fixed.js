/**
 * FIXED INTELLIGENCE EXTRACTOR - Analyzes FULL conversation history
 */

// Same regex patterns as before
const PHONE_PATTERNS = [
    /(?:\+91[\s\-]?)?[6-9]\d{9}/g,
    /(?:\+91)?[\s\-]?[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/g,
    /(?:0)?[6-9]\d{9}/g,
];

const UPI_PATTERNS = [
    /[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}/g,
    /[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+@[a-zA-Z]{2,}/g,
    /\d{10}@[a-zA-Z]{3,}/g,
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const URL_PATTERNS = [
    /https?:\/\/[^\s"'<>]+/gi,
    /(?:www\.)[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s]*/gi,
    /[a-zA-Z0-9\-]+\.(?:com|net|org|in|co\.in|info|xyz|online|site|click|link)[^\s]*/gi,
];

const BANK_ACCOUNT_PATTERNS = [
    /\b\d{10,18}\b/g,
    /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?:[\s\-]?\d{2,6})?\b/g,
];

const SUSPICIOUS_KEYWORDS = [
    "urgent", "immediately", "verify now", "account blocked", "kyc expired",
    "click here", "suspended", "fine", "penalty", "last warning",
    "within 24 hours", "action required", "download", "install",
    "quick support", "anydesk", "team viewer", "teamviewer", "remote access",
    "otp", "share otp", "send otp", "one time password",
    "registration fee", "processing fee", "pay now", "transfer",
    "congratulations", "won", "prize", "lottery", "reward",
    "cashback", "refund", "claim", "activate",
    "police", "cyber cell", "arrest", "legal action", "court",
    "rbi", "reserve bank", "income tax", "government",
];

function extractPhoneNumbers(text) {
    const phones = new Set();
    for (const pattern of PHONE_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (let match of matches) {
            let cleaned = match.replace(/[\s\-]/g, '');
            cleaned = cleaned.replace(/^(\+91|91|0)/, '');
            if (/^[6-9]\d{9}$/.test(cleaned)) {
                phones.add(match);
            }
        }
    }
    return Array.from(phones);
}

function extractUPIIds(text) {
    const upis = new Set();
    const emails = new Set();

    const emailMatches = text.match(EMAIL_REGEX) || [];
    emailMatches.forEach(e => emails.add(e.toLowerCase()));

    const emailDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'mail', 'protonmail', 'rediffmail'];

    for (const pattern of UPI_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
            const lower = match.toLowerCase();
            if (emails.has(lower)) continue;

            const domain = match.split('@')[1]?.toLowerCase();
            if (!domain) continue;

            if (emailDomains.some(d => domain.startsWith(d))) continue;

            upis.add(match);
        }
    }

    return Array.from(upis);
}

function extractEmails(text) {
    const emails = text.match(EMAIL_REGEX) || [];
    return [...new Set(emails.map(e => e.toLowerCase()))];
}

function extractURLs(text) {
    const urls = new Set();
    for (const pattern of URL_PATTERNS) {
        const matches = text.match(pattern) || [];
        matches.forEach(url => {
            let cleaned = url.replace(/[.,;!?]+$/, '');
            urls.add(cleaned);
        });
    }
    return Array.from(urls);
}

function extractBankAccounts(text, phoneNumbers) {
    const accounts = new Set();
    const phoneSet = new Set(phoneNumbers.map(p => p.replace(/[\s\-+]/g, '')));

    for (const pattern of BANK_ACCOUNT_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
            const cleaned = match.replace(/[\s\-]/g, '');
            if (phoneSet.has(cleaned)) continue;
            if (/^\d{10,18}$/.test(cleaned)) {
                accounts.add(match);
            }
        }
    }

    return Array.from(accounts);
}

function findSuspiciousKeywords(text) {
    const lowerText = text.toLowerCase();
    const found = SUSPICIOUS_KEYWORDS.filter(kw => lowerText.includes(kw));
    return [...new Set(found)];
}

/**
 * Extract from a single message
 */
function extractIntelligence(text) {
    if (!text || typeof text !== "string") {
        return {
            emails: [],
            upiIds: [],
            phoneNumbers: [],
            phishingLinks: [],
            bankAccounts: [],
            suspiciousKeywords: [],
        };
    }

    const emails = extractEmails(text);
    const phoneNumbers = extractPhoneNumbers(text);
    const upiIds = extractUPIIds(text);
    const phishingLinks = extractURLs(text);
    const bankAccounts = extractBankAccounts(text, phoneNumbers);
    const suspiciousKeywords = findSuspiciousKeywords(text);

    return {
        emails: [...new Set(emails)],
        upiIds: [...new Set(upiIds)],
        phoneNumbers: [...new Set(phoneNumbers)],
        phishingLinks: [...new Set(phishingLinks)],
        bankAccounts: [...new Set(bankAccounts)],
        suspiciousKeywords: [...new Set(suspiciousKeywords)],
    };
}

/**
 * CRITICAL: Extract from FULL conversation history
 * This is what's missing in your current code!
 */
function extractFromConversation(conversationHistory) {
    console.log("🔍 Extracting from full conversation history...");

    const aggregated = {
        emails: new Set(),
        upiIds: new Set(),
        phoneNumbers: new Set(),
        phishingLinks: new Set(),
        bankAccounts: new Set(),
        suspiciousKeywords: new Set(),
    };

    // Extract from ALL messages (especially scammer messages)
    for (const msg of conversationHistory || []) {
        // ONLY extract from scammer messages (not user responses)
        if (msg.sender === "scammer") {
            const extracted = extractIntelligence(msg.text);

            extracted.emails.forEach(e => aggregated.emails.add(e));
            extracted.upiIds.forEach(u => aggregated.upiIds.add(u));
            extracted.phoneNumbers.forEach(p => aggregated.phoneNumbers.add(p));
            extracted.phishingLinks.forEach(l => aggregated.phishingLinks.add(l));
            extracted.bankAccounts.forEach(a => aggregated.bankAccounts.add(a));
            extracted.suspiciousKeywords.forEach(k => aggregated.suspiciousKeywords.add(k));
        }
    }

    const result = {
        emails: Array.from(aggregated.emails),
        upiIds: Array.from(aggregated.upiIds),
        phoneNumbers: Array.from(aggregated.phoneNumbers),
        phishingLinks: Array.from(aggregated.phishingLinks),
        bankAccounts: Array.from(aggregated.bankAccounts),
        suspiciousKeywords: Array.from(aggregated.suspiciousKeywords),
    };

    console.log(`✅ Extracted from conversation: ${Object.values(result).flat().length} items`);
    return result;
}

function mergeIntelligence(existing, newData) {
    return {
        emails: [...new Set([...existing.emails, ...newData.emails])],
        upiIds: [...new Set([...existing.upiIds, ...newData.upiIds])],
        phoneNumbers: [...new Set([...existing.phoneNumbers, ...newData.phoneNumbers])],
        phishingLinks: [...new Set([...existing.phishingLinks, ...newData.phishingLinks])],
        bankAccounts: [...new Set([...existing.bankAccounts, ...newData.bankAccounts])],
        suspiciousKeywords: [...new Set([...existing.suspiciousKeywords, ...newData.suspiciousKeywords])],
    };
}

module.exports = {
    extractIntelligence,
    extractFromConversation,  // NEW: Extract from full conversation
    mergeIntelligence
};
