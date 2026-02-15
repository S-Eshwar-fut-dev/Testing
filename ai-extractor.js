const OpenAI = require("openai");

let openaiClient = null;

function initAIExtractor() {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || apiKey === "your_openai_api_key_here") return false;
  openaiClient = new OpenAI({ apiKey });
  return true;
}

function buildFullContext(messageText, conversationHistory = []) {
  const recent = (conversationHistory || []).slice(-50).map(m => `${m.sender}: ${m.text}`).join("\n");
  return recent ? `Conversation (recent messages):\n${recent}\n\nNew message:\nscammer: ${messageText}` : `scammer: ${messageText}`;
}

function buildExtractionPrompt(fullContext) {
  return `You are a precision intelligence extraction system for scam detection. The input is a transcript provided by the user (defensive use only). DO NOT attempt to contact or engage with the sender.

TASK: Extract ALL scam-related data from this conversation.

${fullContext}

EXTRACT THESE 6 TYPES ONLY (exact keys & types):

1. phoneNumbers: array of exact phone strings found (any format)
2. upiIds: array of exact UPI IDs (format like name@bank)
3. bankAccounts: array of exact bank account numbers (10-18 digits)
4. phishingLinks: array of exact URLs / domains found
5. emails: array of exact email addresses
6. suspiciousKeywords: array of exact suspicious words as they appear (lowercase preferred)

CRITICAL RULES:
- Extract EXACT values found; do NOT invent or normalize beyond trimming.
- Look at EVERY message in the conversation.
- If an item appears multiple times, include it once.
- Return ONLY valid JSON corresponding exactly to the structure below (no markdown, no explanation).

OUTPUT JSON FORMAT:
{
  "phoneNumbers": [],
  "upiIds": [],
  "bankAccounts": [],
  "phishingLinks": [],
  "emails": [],
  "suspiciousKeywords": []
}

If a field is empty, return an empty array.`;
}

function tryParseJSONFromText(text) {
  if (!text || typeof text !== "string") return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    try {
      // fallback: attempt to fix single quotes and trailing commas
      const alt = candidate.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      return JSON.parse(alt);
    } catch (e2) {
      return null;
    }
  }
}

async function extractWithAI(messageText, conversationHistory = [], timeoutMs = 10000) {
  if (!openaiClient) return null;
  const fullContext = buildFullContext(messageText, conversationHistory);
  const prompt = buildExtractionPrompt(fullContext);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const completion = await openaiClient.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a precise intelligence extraction system. Return ONLY valid JSON with the exact schema requested; no markdown or commentary." },
          { role: "user", content: prompt }
        ],
        temperature: 0.0,
        max_completion_tokens: 900
      },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const raw = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = tryParseJSONFromText(raw);
    if (!parsed) return null;
    return {
      phoneNumbers: Array.isArray(parsed.phoneNumbers) ? parsed.phoneNumbers : [],
      upiIds: Array.isArray(parsed.upiIds) ? parsed.upiIds : [],
      bankAccounts: Array.isArray(parsed.bankAccounts) ? parsed.bankAccounts : [],
      phishingLinks: Array.isArray(parsed.phishingLinks) ? parsed.phishingLinks : [],
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
      suspiciousKeywords: Array.isArray(parsed.suspiciousKeywords) ? parsed.suspiciousKeywords : []
    };
  } catch (err) {
    return null;
  }
}

function normalizeToken(t) {
  if (!t || typeof t !== "string") return t;
  return t.replace(/^[^\w+]+|[^\w]+$/g, "").trim();
}

function regexExtractor(messageText, conversationHistory = []) {
  const texts = [...(conversationHistory || []).map(m => m.text), messageText];
  const fullText = texts.join("\n");
  const links = new Set();
  const urlRx = /https?:\/\/[^\s"'<>]+/ig;
  let m;
  while ((m = urlRx.exec(fullText)) !== null) links.add(normalizeToken(m[0]));
  const domainRx = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|in|io|co|info|biz|xyz)\b/ig;
  while ((m = domainRx.exec(fullText)) !== null) {
    const v = normalizeToken(m[0]);
    if (![...links].some(x => x.includes(v))) links.add(v);
  }
  const emails = new Set();
  const emailRx = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  (fullText.match(emailRx) || []).forEach(e => emails.add(normalizeToken(e)));

  // remove links & emails from a temp copy before scanning for digits to avoid false positives
  let scrubbed = fullText;
  [...links].forEach(l => scrubbed = scrubbed.split(l).join(" "));
  [...emails].forEach(e => scrubbed = scrubbed.split(e).join(" "));

  // UPI candidates: tokens with @ but no dot after @
  const upiCandidates = new Set();
  const upiRx = /\b[a-zA-Z0-9._\-]{2,}@[a-zA-Z0-9._\-]{2,}\b/g;
  (scrubbed.match(upiRx) || []).forEach(u => {
    const afterAt = u.split("@")[1] || "";
    if (!/\./.test(afterAt)) upiCandidates.add(normalizeToken(u));
  });

  // BANK accounts: labeled patterns first
  const bankAccounts = new Set();
  const labeledBankRx = /(?:account(?: number| no| no\.)?|acct|a\/c|acc no|acc):?\s*([0-9][0-9\s\-]{8,20}[0-9])/ig;
  while ((m = labeledBankRx.exec(fullText)) !== null) {
    const digits = (m[1] || "").replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 18) bankAccounts.add(digits);
  }

  // DIGIT SEQUENCES (phones vs bank)
  const digitSeqRx = /\b\d{6,18}\b/g;
  const phones = new Set();
  let seq;
  while ((seq = digitSeqRx.exec(scrubbed)) !== null) {
    const s = seq[0];
    if (s.length >= 12) {
      if (![...bankAccounts].includes(s)) bankAccounts.add(s);
    } else if (s.length === 10 || s.length === 11) {
      phones.add(s);
    } else if (s.length >= 6 && s.length <= 9) {
      // short numbers often not useful; ignore
    } else {
      // ambiguous lengths 10-11 handled above; fallback to phones
      phones.add(s);
    }
  }

  // also capture phone patterns with separators and country codes
  const phonePattern2 = /(\+?\d{1,3}[-\s.]?)?(?:\d{5}[-\s.]?\d{5}|\d{4}[-\s.]?\d{3}[-\s.]?\d{3,4}|\d{3}[-\s.]?\d{3}[-\s.]?\d{4})/g;
  while ((m = phonePattern2.exec(fullText)) !== null) {
    const p = m[0].replace(/[^\d+]/g, "");
    if (p.length >= 10 && p.length <= 15) phones.add(p);
  }

  // remove phone-like items from bank if they collide and there is label context
  [...phones].forEach(ph => {
    if ([...bankAccounts].includes(ph)) {
      // if bankAccounts contains same digits but was explicitly labeled as account, keep both;
      // otherwise prefer phone for 10-digit sequences
      if (ph.length === 10) {
        bankAccounts.delete(ph);
      }
    }
  });

  // suspicious keywords
  const suspiciousList = [
    "urgent", "otp", "verify", "verification", "blocked", "block", "immediately",
    "download", "install", "suspended", "winner", "prize", "fee", "transfer",
    "account blocked", "call immediately", "pay", "deposit", "tax", "fine", "penalty", "identity", "compromised"
  ];
  const lowered = fullText.toLowerCase();
  const suspiciousKeywords = new Set();
  suspiciousList.forEach(w => { if (lowered.includes(w)) suspiciousKeywords.add(w); });

  return {
    phoneNumbers: Array.from(phones).map(normalizeToken),
    upiIds: Array.from(upiCandidates).map(normalizeToken),
    bankAccounts: Array.from(bankAccounts).map(normalizeToken),
    phishingLinks: Array.from(links).map(normalizeToken),
    emails: Array.from(emails).map(normalizeToken),
    suspiciousKeywords: Array.from(suspiciousKeywords)
  };
}

async function hybridExtraction(messageText, conversationHistory = [], options = {}) {
  const aiResult = await extractWithAI(messageText, conversationHistory, options.aiTimeoutMs ?? 10000);
  const regexResult = regexExtractor(messageText, conversationHistory);
  if (!aiResult) return regexResult;
  const merged = {
    phoneNumbers: Array.from(new Set([...(aiResult.phoneNumbers || []), ...(regexResult.phoneNumbers || [])])),
    upiIds: Array.from(new Set([...(aiResult.upiIds || []), ...(regexResult.upiIds || [])])),
    bankAccounts: Array.from(new Set([...(aiResult.bankAccounts || []), ...(regexResult.bankAccounts || [])])),
    phishingLinks: Array.from(new Set([...(aiResult.phishingLinks || []), ...(regexResult.phishingLinks || [])])),
    emails: Array.from(new Set([...(aiResult.emails || []), ...(regexResult.emails || [])])),
    suspiciousKeywords: Array.from(new Set([...(aiResult.suspiciousKeywords || []), ...(regexResult.suspiciousKeywords || [])]))
  };
  return merged;
}

module.exports = {
  initAIExtractor,
  extractWithAI,
  regexExtractor,
  hybridExtraction
};
