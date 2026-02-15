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

CRITICAL TASK: Extract ALL scam-related intelligence from this ENTIRE conversation.

${fullContext}

ANALYZE EVERY MESSAGE from the scammer and extract:
1. Phone numbers (ANY format: +91-9876543210, 9876543210, etc.)
2. UPI IDs (format: name@bank like fraud@paytm, scammer.fake@upi)
3. Bank account numbers (10-18 digits)
4. URLs and links (http://, https://, www., or domains)
5. Email addresses
6. Scam keywords (urgent, OTP, block, verify, etc.)

CRITICAL RULES:
1. Extract EXACT values - don't modify anything
2. Look at EVERY message in the conversation, not just the last one
3. If scammer mentions something multiple times, extract it
4. Phone numbers can be: +91-9876543210, 9876543210, +91 98765 43210
5. UPI IDs have @ symbol: scammer@paytm, fraud.pay@ybl, name.name@bank
6. Return ONLY valid JSON

Return ONLY this JSON structure (no markdown, no explanation):
{
  "phoneNumbers": [],
  "upiIds": [],
  "bankAccounts": [],
  "phishingLinks": [],
  "emails": [],
  "suspiciousKeywords": []
}

EXAMPLES:
Conversation: "Call +91-9876543210 or pay to scammer@paytm"
Output: {"phoneNumbers":["+91-9876543210"],"upiIds":["scammer@paytm"],"bankAccounts":[],"phishingLinks":[],"emails":[],"suspiciousKeywords":["call","pay"]}`;

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