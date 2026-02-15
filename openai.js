/**
 * Simplified OpenAI Client — Reliable Context-Aware Generation
 */

const OpenAI = require("openai");

// ─── 30 Generic Fallback Messages ───────────────────────────
// Used when OpenAI API fails entirely. Designed to match any scammer context.
const GENERIC_FALLBACKS = [
    "sir ek minute... phone thoda slow hai... abhi try karta hun",
    "okay sir... but internet not working properly... can you wait?",
    "sir I am trying... but page not loading... what should I do?",
    "hold on sir... my phone screen froze... restarting now",
    "sir can you repeat that... I didn't understand properly",
    "okay sir... but first tell me is this really from the bank?",
    "sir I am scared... should I call someone to help me?",
    "wait sir... let me put on my reading glasses first",
    "sir my son told me not to do anything on phone... is this safe?",
    "okay I am doing it sir... but which app should I open?",
    "sir one minute... someone is at the door... I will come back",
    "okay sir... but my balance is very low... will there be charges?",
    "sir I don't know how to do this... can you explain step by step?",
    "wait sir... battery is at 5%... let me find charger",
    "sir is this urgent? I am in the middle of cooking",
    "okay sir... I am opening the app now... it's loading very slow",
    "sir I tried but it's showing some error... what does it mean?",
    "one second sir... I need to find my reading glasses",
    "sir my wife is saying don't share anything... what should I tell her?",
    "okay sir... but can I do this tomorrow? I am very busy today",
    "sir I am confused... too many steps... can you simplify?",
    "wait sir... network signal is very weak here... moving to balcony",
    "sir should I go to bank directly? that would be safer no?",
    "okay but sir... how do I know you are not a fraud?",
    "sir I pressed something wrong... now what should I do?",
    "hold on sir... my neighbor is calling... two minutes please",
    "sir this is too complicated for me... can someone else help?",
    "okay sir... but my phone storage is full... cannot download anything",
    "sir I am getting another call... can I put you on hold?",
    "wait sir... let me write down these steps on paper first",
];

/**
 * Pick a random fallback message from the generic array.
 */
function getRandomFallback() {
    const idx = Math.floor(Math.random() * GENERIC_FALLBACKS.length);
    return { message: GENERIC_FALLBACKS[idx], index: idx };
}

let openaiClient = null;

function initOpenAI() {
    const apiKey = (process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey || apiKey === "your_openai_api_key_here") {
        console.warn("⚠️  OPENAI_API_KEY not set.");
        return;
    }
    openaiClient = new OpenAI({
        apiKey,
    });
    console.log("✅ OpenAI client initialized.");
}

/**
 * Generate a context-aware reply using OpenAI.
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
    if (!openaiClient) {
        console.warn("⚠️ OpenAI client not available, using generic fallback");
        return getRandomFallback();
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

        console.log(`🚀 Calling OpenAI API with ${messages.length} messages...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages,

            max_completion_tokens: 60,
        }, { signal: controller.signal });

        clearTimeout(timeoutId);

        console.log(`✅ OpenAI API responded`);

        const text = completion.choices?.[0]?.message?.content;

        if (text && text.trim().length > 0) {
            const cleanText = text.trim();
            console.log(`✅ AI generated: "${cleanText}"`);
            return { message: cleanText, index: -1 };
        }

        console.error(`❌ OpenAI returned empty text`);
        throw new Error("Empty response from primary model");

    } catch (error) {
        console.error(`❌ Primary OpenAI call failed:`, error.message);
        console.error(`❌ Error details:`, {
            message: error.message,
            code: error.code,
            status: error.status,
        });

        // Recovery with simplified prompt
        try {
            console.log(`🔄 Attempting recovery with gpt-40-mini simplified...`);
            const recoveryController = new AbortController();
            const recoveryTimeout = setTimeout(() => recoveryController.abort(), 4000);

            const recovery = await openaiClient.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are stalling a scammer on the phone. Respond to their message naturally. Under 15 words.`,
                    },
                    { role: "user", content: newMessage },
                ],

                max_completion_tokens: 30,
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

        // Final fallback — random generic message
        console.warn("⚠️ Using generic fallback");
        return getRandomFallback();
    }
}

async function classifyScamIntent(conversationHistory, latestMessage) {
    if (!openaiClient) return false;

    try {
        const transcript = (conversationHistory || [])
            .map((msg) => `${msg.sender}: ${msg.text}`)
            .join("\n");

        const prompt = transcript
            ? `${transcript}\nscammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`
            : `scammer: ${latestMessage}\n\nIs this a scam? (YES/NO)`;

        const classifyController = new AbortController();
        const classifyTimeout = setTimeout(() => classifyController.abort(), 8000);

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a scam detection classifier. Respond with ONLY YES or NO.",
                },
                { role: "user", content: prompt },
            ],

            max_completion_tokens: 8,
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

module.exports = { initOpenAI, generateReply, classifyScamIntent };