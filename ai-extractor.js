const OpenAI = require("openai");

let openaiClient = null;

function initAIExtractor() {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    console.warn("⚠️  OPENAI_API_KEY not set for AI extraction.");
    return false;
  }
  openaiClient = new OpenAI({ apiKey });
  console.log("✅ AI Extractor initialized with gpt-4o-mini");
  return true;
}

function buildFullContext(messageText, conversationHistory = []) {
  const recent = (conversationHistory || [])
    .slice(-20)
    .map(m => `${m.sender}: ${m.text}`)
    .join("\n");
  return recent
    ? `Conversation (recent messages):\n${recent}\n\nNew message:\nscammer: ${messageText}`
    : `scammer: ${messageText}`;
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

async function extractWithAI(messageText, conversationHistory = [], timeoutMs = 10000) {
  if (!openaiClient) {
    console.warn("⚠️ AI Extractor not available, skipping AI extraction");
    return null;
  }

  const fullContext = buildFullContext(messageText, conversationHistory);
  const prompt = buildExtractionPrompt(fullContext);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const completion = await openaiClient.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a precise intelligence extraction system. Return ONLY valid JSON with the exact schema requested; no markdown or commentary."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.0,
        max_completion_tokens: 800
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const responseText = completion?.choices?.[0]?.message?.content?.trim();
    if (!responseText) {
      console.warn("⚠️ AI Extractor returned empty response");
      return null;
    }

    const cleaned = responseText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("❌ AI Extractor returned non-JSON or malformed JSON:", err.message);
      return null;
    }

    const normalized = {
      phoneNumbers: Array.isArray(parsed.phoneNumbers) ? parsed.phoneNumbers : [],
      upiIds: Array.isArray(parsed.upiIds) ? parsed.upiIds : [],
      bankAccounts: Array.isArray(parsed.bankAccounts) ? parsed.bankAccounts : [],
      phishingLinks: Array.isArray(parsed.phishingLinks) ? parsed.phishingLinks : [],
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
      suspiciousKeywords: Array.isArray(parsed.suspiciousKeywords) ? parsed.suspiciousKeywords : []
    };

    const foundItems = Object.entries(normalized)
      .filter(([, arr]) => arr.length > 0)
      .map(([k, arr]) => `${k}:${arr.length}`)
      .join(", ");

    if (foundItems) {
      console.log(`✅ AI Extractor found: ${foundItems}`);
    } else {
      console.log("ℹ️ AI Extractor found no intelligence in this message");
    }

    return normalized;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("❌ AI Extractor timeout (aborted)");
    } else {
      console.error("❌ AI Extractor error:", error.message || error);
    }
    return null;
  }
}

function regexExtractor(messageText, conversationHistory = []) {
  const fullText = [...(conversationHistory || []).map(m => m.text), messageText].join("\n");

  const phonePatterns = [
    /\+?\d{1,3}[-\s.]?\d{2,4}[-\s.]?\d{3,4}[-\s.]?\d{3,4}/g,
    /\b\d{10,11}\b/g,
    /\b\d{5}[-\s]\d{5}\b/g
  ];

  const phoneNumbers = new Set();
  phonePatterns.forEach(rx => {
    const m = fullText.match(rx);
    if (m) m.forEach(s => phoneNumbers.add(s.trim()));
  });

  const emailRx = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emails = new Set((fullText.match(emailRx) || []).map(s => s.trim()));

  const upiRx = /\b[a-zA-Z0-9._%+-]{2,}@[a-zA-Z]{2,}\b/g;
  const upiCandidates = new Set((fullText.match(upiRx) || []).map(s => s.trim()));
  const upiIds = new Set([...upiCandidates].filter(c => !/\@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(c)));

  const bankRx = /\b\d{10,18}\b/g;
  const bankAccounts = new Set((fullText.match(bankRx) || []).map(s => s.trim()));

  const urlRx = /((https?:\/\/|www\.)[^\s"'<>]+)|\b[a-z0-9.-]+\.(com|net|org|in|io|co|info|biz|xyz)\b/ig;
  const phishingLinks = new Set();
  let urlMatch;
  while ((urlMatch = urlRx.exec(fullText)) !== null) {
    phishingLinks.add(urlMatch[0].trim());
  }

  const suspiciousList = [
    "urgent", "otp", "verify", "verification", "blocked", "block", "immediately",
    "download", "install", "suspended", "winner", "prize", "fee", "transfer",
    "account blocked", "call immediately", "pay", "deposit", "tax", "fine", "penalty"
  ];
  const suspiciousKeywords = new Set();
  const lowered = fullText.toLowerCase();
  suspiciousList.forEach(word => {
    if (lowered.includes(word)) {
      suspiciousKeywords.add(word);
    }
  });

  return {
    phoneNumbers: Array.from(phoneNumbers),
    upiIds: Array.from(upiIds),
    bankAccounts: Array.from(bankAccounts),
    phishingLinks: Array.from(phishingLinks),
    emails: Array.from(emails),
    suspiciousKeywords: Array.from(suspiciousKeywords)
  };
}

async function hybridExtraction(messageText, conversationHistory = [], options = {}) {
  const aiResult = await extractWithAI(messageText, conversationHistory, options.aiTimeoutMs ?? 10000);
  const regexResult = regexExtractor(messageText, conversationHistory);

  if (!aiResult) {
    console.log("⚠️ Using regex-only extraction (AI failed)");
    return regexResult;
  }

  const merged = {
    phoneNumbers: Array.from(new Set([...aiResult.phoneNumbers, ...regexResult.phoneNumbers])),
    upiIds: Array.from(new Set([...aiResult.upiIds, ...regexResult.upiIds])),
    bankAccounts: Array.from(new Set([...aiResult.bankAccounts, ...regexResult.bankAccounts])),
    phishingLinks: Array.from(new Set([...aiResult.phishingLinks, ...regexResult.phishingLinks])),
    emails: Array.from(new Set([...aiResult.emails, ...regexResult.emails])),
    suspiciousKeywords: Array.from(new Set([...aiResult.suspiciousKeywords, ...regexResult.suspiciousKeywords]))
  };

  const aiCount = Object.values(aiResult).flat().length;
  const regexCount = Object.values(regexResult).flat().length;
  const mergedCount = Object.values(merged).flat().length;
  console.log(`🔀 Merge stats: AI=${aiCount}, Regex=${regexCount}, Final=${mergedCount}`);

  return merged;
}

module.exports = {
  initAIExtractor,
  extractWithAI,
  regexExtractor,
  hybridExtraction
};
