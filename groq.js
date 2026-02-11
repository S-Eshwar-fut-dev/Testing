/**
 * Simplified Groq Client — Reliable Context-Aware Generation
 */

const OpenAI = require("openai");
const { getContextualFallback } = require("./persona");

let groqClient = null;

function initGroq() {
  const apiKey = (process.env.GROK_API_KEY || "").trim();
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    console.warn("⚠️  GROK_API_KEY not set.");
    return;
  }
  groqClient = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  console.log("✅ Groq client initialized.");
}

/**
 * Generate a context-aware reply using Groq.
 * Simplified: no similarity checks, no aggressive retries.
 */
async function generateReply(
  systemPrompt,
  conversationHistory,
  newMessage,
  personaName,
  lastFallbackIndex,
  previousResponses = []
) {
  if (!groqClient) {
    console.warn("⚠️ Groq client not available, using persona fallback");
    return getContextualFallback(personaName, lastFallbackIndex);
  }

  try {
    console.log(`🎯 Generating reply for persona: ${personaName}`);
    console.log(`📝 Scammer message: "${newMessage}"`);
    console.log(`💬 Conversation history length: ${(conversationHistory || []).length}`);

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of conversationHistory || []) {
      messages.push({
        role: msg.sender === "scammer" ? "user" : "assistant",
        content: msg.text,
      });
    }

    messages.push({ role: "user", content: newMessage });

    console.log(`🚀 Calling Groq API with ${messages.length} messages...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.8,
      max_tokens: 120,
    }, { signal: controller.signal });

    clearTimeout(timeoutId);

    console.log(`✅ Groq API responded`);

    const text = completion.choices?.[0]?.message?.content;

    if (text && text.trim().length > 0) {
      const cleanText = text.trim();
      console.log(`✅ AI generated: "${cleanText}"`);
      return { message: cleanText, index: -1 };
    }

    console.error(`❌ Groq returned empty text`);
    throw new Error("Empty response from primary model");

  } catch (error) {
    console.error(`❌ Primary Groq call failed:`, error.message);
    console.error(`❌ Error details:`, {
      message: error.message,
      code: error.code,
      status: error.status,
    });

    // Recovery with smaller model
    try {
      console.log(`🔄 Attempting recovery with llama-3.1-8b-instant...`);
      const recoveryController = new AbortController();
      const recoveryTimeout = setTimeout(() => recoveryController.abort(), 4000);

      const recovery = await groqClient.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are stalling a scammer on the phone. Respond to their message naturally. Under 15 words.`,
          },
          { role: "user", content: newMessage },
        ],
        temperature: 0.8,
        max_tokens: 50,
      }, { signal: recoveryController.signal });

      clearTimeout(recoveryTimeout);

      const recoveryText = recovery.choices?.[0]?.message?.content?.trim();
      if (recoveryText && recoveryText.length > 0) {
        console.log(`🔄 Recovery succeeded: "${recoveryText}"`);
        return { message: recoveryText, index: -1 };
      }
    } catch (recoveryError) {
      console.error("❌ Recovery failed:", recoveryError.message);
    }

    // Final fallback
    console.warn("⚠️ Using persona-specific fallback");
    return getContextualFallback(personaName, lastFallbackIndex);
  }
}

async function classifyScamIntent(conversationHistory, latestMessage) {
  if (!groqClient) return false;

  try {
    const transcript = (conversationHistory || [])
      .map((msg) => `${msg.sender}: ${msg.text}`)
      .join("\n");

    const prompt = transcript
      ? `${transcript}\nscammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`
      : `scammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`;

    const classifyController = new AbortController();
    const classifyTimeout = setTimeout(() => classifyController.abort(), 8000);

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a scam detection classifier. Respond with ONLY YES or NO.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 8,
    }, { signal: classifyController.signal });

    clearTimeout(classifyTimeout);

    const answer = (completion.choices?.[0]?.message?.content || "").trim().toUpperCase();
    console.log(`🔍 Scam classification: ${answer}`);
    return answer.startsWith("YES");

  } catch (error) {
    console.error("❌ Classification error:", error.message);
    return false;
  }
}

module.exports = { initGroq, generateReply, classifyScamIntent };