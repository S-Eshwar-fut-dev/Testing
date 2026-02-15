// FIXED INTELLIGENCE EXTRACTOR - Analyzes FULL conversation history

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

// Relaxed email regex to allow domains like "fakebank" (no dot required)
// Adjusted to ensure it doesn't end with a dot (trailing punctuation)
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.-]*[a-zA-Z0-9-]/g;
const URL_PATTERNS = [
    /https?:\/\/[^\s"'<>]+/gi,
    /(?:www\.)[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s]*/gi,
    /[a-zA-Z0-9\-]+\.(?:com|net|org|in|co\.in|info|xyz|online|site|click|link)[^\s]*/gi,
];

const BANK_ACCOUNT_PATTERNS = [
    /\b\d{11,18}\b/g, // 11-18 digits (definitely not phone)
    /\b[0-5]\d{9}\b/g, // 10 digits starting with 0-5 (not phone)
    /(?:account|acct|a\/c|acc|no|number)[\s.:-]*(\d{10,18})/gi // Labeled accounts
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

function extractPhoneNumbers(text, bankAccounts) {
    const phones = new Set();
    const bankAccountStrings = Array.from(bankAccounts).map(acc => acc.replace(/[\s\-]/g, ''));

    for (const pattern of PHONE_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (let match of matches) {
            let cleaned = match.replace(/[\s\-]/g, '');
            cleaned = cleaned.replace(/^(\+91|91|0)/, '');

            // CONFLICT RESOLUTION: Check if this phone number is part of a bank account
            const isPartOfBankAccount = bankAccountStrings.some(acc => acc.includes(cleaned));

            if (!isPartOfBankAccount && /^[6-9]\d{9}$/.test(cleaned)) {
                phones.add(match);
            }
        }
    }
    return Array.from(phones);
}

function extractUPIIds(text) {
    const upis = new Set();
    // Common email domains to exclude from UPI extraction
    const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'icloud.com'];

    // Extract all potential email-like strings
    const matches = text.match(EMAIL_REGEX) || [];

    for (const match of matches) {
        const lower = match.toLowerCase();
        const domain = lower.split('@')[1];

        if (!domain) continue;

        // If it's a known email domain, skip (it's an email, not UPI)
        if (emailDomains.some(d => domain.endsWith(d))) continue;

        // If it's a payment handle or generic domain, keep as UPI logic
        // Check for common UPI handles
        const upiHandles = ['paytm', 'ybl', 'oksbi', 'phonepe', 'axisbank', 'icici', 'freecharge', 'ibl', 'sbi', 'pnb', 'uboi', 'fakebank'];
        if (upiHandles.some(h => domain.includes(h))) {
            upis.add(match);
        } else {
            // If domain is unknown and doesn't look like a standard TLD, assume UPI/Payment handle in scambait context
            // But valid emails might slip in. Let's be aggressive for UPI.
            // If it DOESN'T have a dot, it's likely a UPI handle (e.g. name@paytm)
            if (!domain.includes('.')) {
                upis.add(match);
            } else {
                // Has dot, but not in excluded list. 
                // If it ends in .com/.in etc, it might be an email. 
                // But user wants "verify.fraud@paytm" -> upi.
                // So if domain is "paytm", it matches upiHandles check above.
            }
        }
    }
    return Array.from(upis);
}

function extractEmails(text) {
    const emails = new Set();
    const matches = text.match(EMAIL_REGEX) || [];
    const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com']; // Strict email list

    for (const match of matches) {
        const lower = match.toLowerCase();
        const domain = lower.split('@')[1];
        if (!domain) continue;

        // If known email domain, definitely email
        if (emailDomains.some(d => domain.endsWith(d))) {
            emails.add(match);
        } else {
            // If it's NOT a known UPI handle, treat as email? 
            // User said: "Email: scammer.fraud@fakebank" 
            // But also: "UPI Domains ... @fakebank"
            // So fakebank could be either. User said: "scammer.fraud@fakebank" -> Emails OR UPI.
            // Let's rely on the UPI extraction to grab payment handles.
            // If it's NOT caught by UPI extraction, valid email?
            // Actually, best strategy: Extract ALL as candidates, then partition.

            // For this specific logic:
            // If it allows "fakebank", we add it.
            // But verify it's not a generic UPI handle like "paytm" which typically isn't an email service.
            const upiHandles = ['paytm', 'ybl', 'oksbi', 'phonepe', 'axl', 'ibl', 'ybl'];
            if (!upiHandles.some(h => domain === h)) {
                emails.add(match);
            }
        }
    }
    return Array.from(emails);
}

function extractURLs(text) {
    const urls = new Set();
    for (const pattern of URL_PATTERNS) {
        const matches = text.match(pattern) || [];
        matches.forEach(url => {
            // Don't strip query params aggressively
            let cleaned = url.replace(/[.,;!?]+$/, '');
            urls.add(cleaned);
        });
    }
    return Array.from(urls);
}

function extractBankAccounts(text) {
    const accounts = new Set();
    for (const pattern of BANK_ACCOUNT_PATTERNS) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
            const cleaned = match.replace(/[\s\-]/g, '');
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

    // 1. URLs
    const phishingLinks = extractURLs(text);

    // 2. Bank Accounts (First priority)
    const bankAccounts = extractBankAccounts(text);

    // 3. Phone Numbers (Exclude substrings of bank accounts)
    const phoneNumbers = extractPhoneNumbers(text, bankAccounts);

    // 4. Emails & UPI (Separate logic)
    const emails = extractEmails(text);
    const upiIds = extractUPIIds(text);

    // 5. Keywords
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

    // We process the ENTIRE text block for bank/phone conflict resolution across messages
    // But for now, doing message-by-message is okay IF the bank account and phone are in same message.
    // If they are in different messages, the conflict isn't present in that message's text.

    for (const msg of conversationHistory || []) {
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
    extractFromConversation,
    mergeIntelligence
};
