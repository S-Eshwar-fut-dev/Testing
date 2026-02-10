/**
 * Gemini Client — wrapper around @google/generative-ai SDK
 * for generating persona-based scambaiting replies.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;

/**
 * Initialize the Gemini client (call once at startup).
 */
function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.warn("⚠️  GEMINI_API_KEY not set. AI replies will use fallback responses.");
    return;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("✅ Gemini client initialized.");
}

/**
 * Generate a scambaiting reply using Gemini.
 *
 * @param {string} systemPrompt - The persona system instruction
 * @param {Array} conversationHistory - Array of { sender, text } objects
 * @param {string} newMessage - The latest scammer message
 * @returns {Promise<string>} The AI-generated reply
 */
async function generateReply(systemPrompt, conversationHistory, newMessage) {
  // Fallback if Gemini is not configured
  if (!genAI) {
    return getFallbackReply();
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    // Build chat history in Gemini format
    const history = (conversationHistory || []).map((msg) => ({
      role: msg.sender === "scammer" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(newMessage);
    const response = result.response;
    const text = response.text();

    return text || getFallbackReply();
  } catch (error) {
    console.error("❌ Gemini API error:", error.message);
    return getFallbackReply();
  }
}

/**
 * Classify whether the conversation indicates a scam.
 * Uses Gemini with a short classification prompt.
 *
 * @param {Array} conversationHistory - Array of { sender, text } objects
 * @param {string} latestMessage - The latest scammer message
 * @returns {Promise<boolean>} true if scam confirmed
 */
async function classifyScamIntent(conversationHistory, latestMessage) {
  if (!genAI) {
    return false; // Can't classify without AI
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction:
        "You are a scam detection classifier. Analyze the conversation below and determine if the sender is attempting a scam (phishing, fraud, social engineering, fake offers, etc.). Respond with ONLY the word YES or NO.",
    });

    const transcript = (conversationHistory || [])
      .map((msg) => `${msg.sender}: ${msg.text}`)
      .join("\n");

    const prompt = transcript
      ? `${transcript}\nscammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`
      : `scammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim().toUpperCase();

    console.log(`🔍 Scam classification result: ${answer}`);
    return answer.startsWith("YES");
  } catch (error) {
    console.error("❌ Scam classification error:", error.message);
    return false;
  }
}

/**
 * Fallback replies when Gemini is unavailable.
 */
function getFallbackReply() {
  const fallbacks = [
    "sir please wait... my phone is hanging...",
    "bro hold on... network issue...",
    "one minute sir... i am trying...",
    "sir link is not opening... showing error...",
    "bhai wait... otp not coming...",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

module.exports = { initGemini, generateReply, classifyScamIntent };
