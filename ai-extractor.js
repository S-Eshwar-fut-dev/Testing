const OpenAI = require("openai");

let openaiClient = null;

/**
 * Initialize OpenAI client for AI extraction
 */
function initAIExtractor() {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    console.warn("⚠️  OPENAI_API_KEY not set for AI extraction.");
    return false;
  }
  openaiClient = new OpenAI({ apiKey });
  console.log("✅ AI Extractor initialized with GPT-4o-mini");
  return true;
}

/**
 * AI-powered intelligence extraction
 * Analyzes message and conversation history to extract scam intelligence
 */
async function extractWithAI(messageText, conversationHistory = []) {
  if (!openaiClient) {
    console.warn("⚠️ AI Extractor not available, skipping AI extraction");
    return null;
  }

  try {
    // Build context from conversation history
    const context = conversationHistory
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.sender}: ${msg.text}`)
      .join("\n");

    const fullContext = context
      ? `Previous conversation:\n${context}\n\nNew message:\nscammer: ${messageText}`
      : `scammer: ${messageText}`;

    const extractionPrompt = `You are an intelligence extraction system for a scam detection honeypot.

Analyze this conversation and extract ALL scam-related intelligence.

${fullContext}

Extract and return ONLY a JSON object with these fields (return empty arrays if nothing found):
{
  "phoneNumbers": [],      // Phone numbers in ANY format (with +91, spaces, dashes, etc.)
  "upiIds": [],           // UPI IDs (format: name@bank or similar)
  "bankAccounts": [],     // Bank account numbers (10-18 digits)
  "phishingLinks": [],    // Any URLs or website links
  "emails": [],           // Email addresses
  "suspiciousKeywords": [] // Scam indicators: "urgent", "otp", "verify", "blocked", etc.
}

CRITICAL RULES:
1. Extract EXACT values as they appear (don't modify phone numbers, UPIs, etc.)
2. Include items even if you're unsure - we'll validate later
3. For phone numbers: catch ALL formats (+91-9876543210, 9876543210, +91 98765 43210)
4. For UPI: anything with @ symbol that looks like payment ID
5. For bank accounts: sequences of 10-18 digits (could have spaces/dashes)
6. For links: any http://, https://, or domain-like patterns
7. Return ONLY the JSON object, no explanation

EXAMPLES:
Input: "Call me at +91-9876543210 or pay to scammer@paytm"
Output: {"phoneNumbers":["+91-9876543210"],"upiIds":["scammer@paytm"],"bankAccounts":[],"phishingLinks":[],"emails":[],"suspiciousKeywords":["call","pay"]}

Input: "Visit http://fake-bank.com and enter account 1234567890123456"
Output: {"phoneNumbers":[],"upiIds":[],"bankAccounts":["1234567890123456"],"phishingLinks":["http://fake-bank.com"],"emails":[],"suspiciousKeywords":["visit","enter","account"]}`;

    console.log("🤖 Calling AI Extractor...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a precise intelligence extraction system. Return ONLY valid JSON, no markdown, no explanation."
        },
        {
          role: "user",
          content: extractionPrompt
        }
      ],
      temperature: 0.1, // Low temperature for consistency
      max_completion_tokens: 300,
    }, { signal: controller.signal });

    clearTimeout(timeoutId);

    const responseText = completion.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      console.warn("⚠️ AI Extractor returned empty response");
      return null;
    }

    // Clean the response (remove markdown code blocks if present)
    let cleanedText = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // Parse JSON
    const extracted = JSON.parse(cleanedText);

    // Validate structure
    if (!extracted || typeof extracted !== 'object') {
      console.warn("⚠️ AI Extractor returned invalid structure");
      return null;
    }

    // Ensure all fields exist as arrays
    const result = {
      phoneNumbers: Array.isArray(extracted.phoneNumbers) ? extracted.phoneNumbers : [],
      upiIds: Array.isArray(extracted.upiIds) ? extracted.upiIds : [],
      bankAccounts: Array.isArray(extracted.bankAccounts) ? extracted.bankAccounts : [],
      phishingLinks: Array.isArray(extracted.phishingLinks) ? extracted.phishingLinks : [],
      emails: Array.isArray(extracted.emails) ? extracted.emails : [],
      suspiciousKeywords: Array.isArray(extracted.suspiciousKeywords) ? extracted.suspiciousKeywords : [],
    };

    // Log what we found
    const foundItems = Object.entries(result)
      .filter(([_, arr]) => arr.length > 0)
      .map(([key, arr]) => `${key}: ${arr.length}`)
      .join(", ");

    if (foundItems) {
      console.log(`✅ AI Extractor found: ${foundItems}`);
    } else {
      console.log("ℹ️ AI Extractor found no intelligence in this message");
    }

    return result;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("❌ AI Extractor timeout (>5s)");
    } else if (error instanceof SyntaxError) {
      console.error("❌ AI Extractor returned invalid JSON:", error.message);
    } else {
      console.error("❌ AI Extractor error:", error.message);
    }
    return null;
  }
}

/**
 * Hybrid extraction: AI first, then merge with regex fallback
 */
async function hybridExtraction(messageText, conversationHistory, regexExtractor) {
  // Try AI extraction first
  const aiResult = await extractWithAI(messageText, conversationHistory);

  // Always run regex as backup/validation
  const regexResult = regexExtractor(messageText);

  // If AI failed, use regex only
  if (!aiResult) {
    console.log("⚠️ Using regex-only extraction (AI failed)");
    return regexResult;
  }

  // Merge results: AI primary, regex fills gaps
  const merged = {
    phoneNumbers: [...new Set([...aiResult.phoneNumbers, ...regexResult.phoneNumbers])],
    upiIds: [...new Set([...aiResult.upiIds, ...regexResult.upiIds])],
    bankAccounts: [...new Set([...aiResult.bankAccounts, ...regexResult.bankAccounts])],
    phishingLinks: [...new Set([...aiResult.phishingLinks, ...regexResult.phishingLinks])],
    emails: [...new Set([...aiResult.emails, ...regexResult.emails])],
    suspiciousKeywords: [...new Set([...aiResult.suspiciousKeywords, ...regexResult.suspiciousKeywords])],
  };

  // Log merge stats
  const aiCount = Object.values(aiResult).flat().length;
  const regexCount = Object.values(regexResult).flat().length;
  const mergedCount = Object.values(merged).flat().length;

  console.log(`🔀 Merge stats: AI=${aiCount}, Regex=${regexCount}, Final=${mergedCount}`);

  return merged;
}

module.exports = {
  initAIExtractor,
  extractWithAI,
  hybridExtraction,
};