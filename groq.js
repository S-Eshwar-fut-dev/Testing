/**
 * Groq Client — wrapper around the OpenAI-compatible Groq API
 * for generating persona-based scambaiting replies.
 *
 * Migrated from @google/generative-ai to openai (Groq-compatible).
 */

const OpenAI = require("openai");

let groqClient = null;

/**
 * Initialize the Groq client (call once at startup).
 */
function initGroq() {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    console.warn("⚠️  GROK_API_KEY not set. AI replies will use fallback responses.");
    return;
  }
  groqClient = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  console.log("✅ Groq client initialized.");
}

/**
 * Generate a minimal stalling phrase when all AI generation fails.
 * Uses randomized excuses to avoid repetition.
 */
function generateMinimalStall() {
  const excuses = ['connection', 'network', 'phone', 'app', 'battery'];
  return `sir... ${excuses[Math.floor(Math.random() * excuses.length)]} problem...`;
}

/**
 * Generate a scambaiting reply using Groq.
 *
 * @param {string} systemPrompt - The persona system instruction
 * @param {Array} conversationHistory - Array of { sender, text } objects
 * @param {string} newMessage - The latest scammer message
 * @returns {Promise<string>} The AI-generated reply
 */
async function generateReply(systemPrompt, conversationHistory, newMessage) {
  // If Groq is not configured, use minimal stall
  if (!groqClient) {
    console.warn("⚠️ Groq client not available, using minimal stall");
    return generateMinimalStall();
  }

  try {
    // Build messages in OpenAI chat format
    const messages = [
      { role: "system", content: systemPrompt },
    ];

    // Append conversation history
    for (const msg of conversationHistory || []) {
      messages.push({
        role: msg.sender === "scammer" ? "user" : "assistant",
        content: msg.text,
      });
    }

    // Append the new scammer message
    messages.push({ role: "user", content: newMessage });

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.8,
      max_tokens: 256,
      timeout: 8000, // 8-second max for Vercel compatibility
    });

    const text = completion.choices?.[0]?.message?.content;
    if (text) return text;

    // If completion returned empty, try recovery
    console.warn("⚠️ Primary model returned empty response, attempting recovery");
    throw new Error("Empty response from primary model");
  } catch (error) {
    console.error("❌ Primary Groq call failed:", error.message);

    // Recovery attempt with smaller, faster model
    try {
      const recovery = await groqClient.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a confused Indian person talking to someone on the phone. Keep it under 10 words. Use simple Hindi-English mix." },
          { role: "user", content: newMessage }
        ],
        temperature: 0.9,
        max_tokens: 50,
        timeout: 4000, // Tighter timeout for recovery
      });
      const recoveryText = recovery.choices?.[0]?.message?.content;
      console.log("🔄 Recovery generation succeeded");
      return recoveryText || generateMinimalStall();
    } catch (recoveryError) {
      console.error("❌ Recovery generation failed:", recoveryError.message);
      return generateMinimalStall();
    }
  }
}

/**
 * Classify whether the conversation indicates a scam.
 * Uses Groq with a short classification prompt.
 *
 * @param {Array} conversationHistory - Array of { sender, text } objects
 * @param {string} latestMessage - The latest scammer message
 * @returns {Promise<boolean>} true if scam confirmed
 */
async function classifyScamIntent(conversationHistory, latestMessage) {
  if (!groqClient) {
    return false; // Can't classify without AI
  }

  try {
    const transcript = (conversationHistory || [])
      .map((msg) => `${msg.sender}: ${msg.text}`)
      .join("\n");

    const prompt = transcript
      ? `${transcript}\nscammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`
      : `scammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`;

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a scam detection classifier. Analyze the conversation below and determine if the sender is attempting a scam (phishing, fraud, social engineering, fake offers, etc.). Respond with ONLY the word YES or NO.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 8,
      timeout: 8000,
    });

    const answer = (completion.choices?.[0]?.message?.content || "")
      .trim()
      .toUpperCase();

    console.log(`🔍 Scam classification result: ${answer}`);
    return answer.startsWith("YES");
  } catch (error) {
    console.error("❌ Scam classification error:", error.message);
    return false;
  }
}

module.exports = { initGroq, generateReply, classifyScamIntent };
