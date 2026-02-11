/**
 * Enhanced Groq Client with Response History Awareness
 */

const OpenAI = require("openai");
const { getContextualFallback } = require("./persona");

let groqClient = null;

function initGroq() {
  const apiKey = process.env.GROK_API_KEY;
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
 * Generate reply with anti-repetition awareness
 * Now accepts previousResponses to avoid repetition
 */
async function generateReply(
  systemPrompt,
  conversationHistory,
  newMessage,
  personaName,
  lastFallbackIndex,
  previousResponses = []  // NEW PARAMETER
) {
  if (!groqClient) {
    console.warn("⚠️ Groq client not available, using persona fallback");
    return getContextualFallback(personaName, lastFallbackIndex);
  }

  try {
    const messages = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    for (const msg of conversationHistory || []) {
      messages.push({
        role: msg.sender === "scammer" ? "user" : "assistant",
        content: msg.text,
      });
    }

    // Add the new scammer message
    messages.push({ role: "user", content: newMessage });

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 1.0,  // INCREASED from 0.9 for more variation
      max_tokens: 256,
      timeout: 8000,
      top_p: 0.95,  // ADD nucleus sampling for diversity
      frequency_penalty: 0.7,  // PENALIZE repetition
      presence_penalty: 0.6,   // ENCOURAGE new topics
    });

    const text = completion.choices?.[0]?.message?.content;

    if (text && text.trim().length > 0) {
      const cleanText = text.trim();

      // 🚨 POST-GENERATION CHECK: Detect if AI is being repetitive
      if (previousResponses.length >= 2) {
        const lastTwo = previousResponses.slice(-2).map(r => r.text.toLowerCase());
        const currentLower = cleanText.toLowerCase();

        // Check for suspicious repetition patterns
        const isRepetitive = lastTwo.some(prev => {
          // If current response is >70% similar to previous ones
          const similarity = calculateSimilarity(currentLower, prev);
          return similarity > 0.7;
        });

        if (isRepetitive) {
          console.warn("⚠️ Repetitive response detected, regenerating...");

          // Try ONE more time with even higher temperature
          const retryCompletion = await groqClient.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `${systemPrompt}\n\n🚨 YOU ARE BEING REPETITIVE! Generate something COMPLETELY DIFFERENT from what you said before!`
              },
              ...messages.slice(1), // Skip old system message
            ],
            temperature: 1.2,  // VERY HIGH
            max_tokens: 256,
            timeout: 6000,
            frequency_penalty: 1.0,
            presence_penalty: 0.8,
          });

          const retryText = retryCompletion.choices?.[0]?.message?.content?.trim();
          if (retryText && retryText.length > 0) {
            console.log("✅ Regenerated with higher diversity");
            return { message: retryText, index: -1 };
          }
        }
      }

      return { message: cleanText, index: -1 };
    }

    throw new Error("Empty response from primary model");

  } catch (error) {
    console.error("❌ Primary Groq call failed:", error.message);

    // Recovery with smaller model
    try {
      const recovery = await groqClient.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are stalling a scammer. Be creative and natural. Previous responses to AVOID repeating: ${previousResponses.slice(-2).map(r => r.text).join(', ')}. Generate something DIFFERENT. Under 15 words.`
          },
          { role: "user", content: newMessage }
        ],
        temperature: 1.1,
        max_tokens: 50,
        timeout: 4000,
        frequency_penalty: 0.8,
      });

      const recoveryText = recovery.choices?.[0]?.message?.content?.trim();
      if (recoveryText && recoveryText.length > 0) {
        console.log("🔄 Recovery generation succeeded");
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

/**
 * Calculate text similarity (Jaccard similarity)
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
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
      timeout: 8000,
    });

    const answer = (completion.choices?.[0]?.message?.content || "").trim().toUpperCase();
    console.log(`🔍 Scam classification: ${answer}`);
    return answer.startsWith("YES");

  } catch (error) {
    console.error("❌ Classification error:", error.message);
    return false;
  }
}

module.exports = { initGroq, generateReply, classifyScamIntent };