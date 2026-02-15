const PHONE_PATTERNS = [
    /(?:\+91[\s\-]?)?[6-9]\d{9}/g,                    // Standard Indian mobile
    /(?:\+91)?[\s\-]?[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/g, // With separators
    /(?:0)?[6-9]\d{9}/g,                              // With leading 0
];

// UPI IDs - multiple formats
const UPI_PATTERNS = [
    /[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}/g,              // Standard format
    /[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+@[a-zA-Z]{2,}/g, // Dot-separated
    /\d{10}@[a-zA-Z]{3,}/g,                           // Phone@bank format
];

// Email addresses
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// URLs and phishing links
const URL_PATTERNS = [
    /https?:\/\/[^\s"'<>]+/gi,                        // Standard URLs
    /(?:www\.)[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s]*/gi, // www. links
    /[a-zA-Z0-9\-]+\.(?:com|net|org|in|co\.in|info|xyz|online|site|click|link)[^\s]*/gi, // Domain-only
];

// Bank account numbers
const BANK_ACCOUNT_PATTERNS = [
    /\b\d{10,18}\b/g,                                 // 10-18 digits
    /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?:[\s\-]?\d{2,6})?\b/g, // Formatted
];

// IFSC codes
const IFSC_REGEX = /[A-Z]{4}0[A-Z0-9]{6}/g;

// Suspicious keywords for scam detection
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

/**
 * Extract phone numbers with conflict resolution
 */
function extractPhoneNumbers(text) {
    const phones = new Set();

    // Try all phone patterns
    for (const pattern of PHONE_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (let match of matches) {
            // Clean the match
            let cleaned = match.replace(/[\s\-]/g, '');
            // Remove leading +91 or 0 for normalization
            cleaned = cleaned.replace(/^(\+91|91|0)/, '');
            // Validate: should be 10 digits starting with 6-9
            if (/^[6-9]\d{9}$/.test(cleaned)) {
                phones.add(match); // Keep original format
            }
        }
    }

    return Array.from(phones);
}

/**
 * Extract UPI IDs with email filtering
 */
function extractUPIIds(text) {
    const upis = new Set();
    const emails = new Set();

    // First, extract all emails
    const emailMatches = text.match(EMAIL_REGEX) || [];
    emailMatches.forEach(e => emails.add(e.toLowerCase()));

    // Common email domains to filter out
    const emailDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'mail', 'protonmail', 'rediffmail'];

    // Try all UPI patterns
    for (const pattern of UPI_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
            const lower = match.toLowerCase();

            // Skip if it's an email
            if (emails.has(lower)) continue;

            // Check domain part
            const domain = match.split('@')[1]?.toLowerCase();
            if (!domain) continue;

            // Skip if domain starts with common email providers
            if (emailDomains.some(d => domain.startsWith(d))) continue;

            upis.add(match);
        }
    }

    return Array.from(upis);
}

/**
 * Extract emails
 */
function extractEmails(text) {
    const emails = text.match(EMAIL_REGEX) || [];
    return [...new Set(emails.map(e => e.toLowerCase()))];
}

/**
 * Extract URLs with deduplication
 */
function extractURLs(text) {
    const urls = new Set();

    for (const pattern of URL_PATTERNS) {
        const matches = text.match(pattern) || [];
        matches.forEach(url => {
            // Clean URL (remove trailing punctuation)
            let cleaned = url.replace(/[.,;!?]+$/, '');
            urls.add(cleaned);
        });
    }

    return Array.from(urls);
}

/**
 * Extract bank accounts with conflict resolution
 * Avoids false positives from phone numbers
 */
function extractBankAccounts(text, phoneNumbers) {
    const accounts = new Set();

    // Extract phone numbers as strings for comparison
    const phoneSet = new Set(phoneNumbers.map(p => p.replace(/[\s\-+]/g, '')));

    for (const pattern of BANK_ACCOUNT_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
            // Clean the match
            const cleaned = match.replace(/[\s\-]/g, '');

            // Skip if it's a phone number
            if (phoneSet.has(cleaned)) continue;

            // Validate: 10-18 digits
            if (/^\d{10,18}$/.test(cleaned)) {
                accounts.add(match); // Keep original format
            }
        }
    }

    return Array.from(accounts);
}

/**
 * Extract IFSC codes
 */
function extractIFSCCodes(text) {
    const codes = text.match(IFSC_REGEX) || [];
    return [...new Set(codes)];
}

/**
 * Find suspicious keywords
 */
function findSuspiciousKeywords(text) {
    const lowerText = text.toLowerCase();
    const found = SUSPICIOUS_KEYWORDS.filter(kw => lowerText.includes(kw));
    return [...new Set(found)];
}

/**
 * Main extraction function with conflict resolution
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

    // Step 1: Extract in order to handle conflicts
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
 * Merge intelligence data with deduplication
 */
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
    mergeIntelligence
};