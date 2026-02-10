/**
 * Vista Honeypot — Agentic Honey-Pot for Scam Detection
 *
 * Express server that receives scammer messages, engages them
 * with a dynamic AI persona, and extracts intelligence.
 */

require("dotenv").config();

const express = require("express");
const { selectPersona } = require("./persona");
const { extractIntelligence, mergeIntelligence } = require("./extractor");
const { initGemini, generateReply, classifyScamIntent } = require("./gemini");
const { initRedis, getSession, setSession } = require("./redis");

const app = express();
const PORT = process.env.PORT || 3000;

// Minimum messages before sending GUVI callback
const CALLBACK_THRESHOLD = 6;

// ─── Middleware ──────────────────────────────────────────────
app.use(express.json());

/**
 * API Key authentication middleware.
 * Validates x-api-key header against API_KEY env variable.
 */
function authMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.warn("⚠️  API_KEY env variable not set. Skipping auth.");
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      error: "Unauthorized. Invalid or missing x-api-key header.",
    });
  }

  next();
}

// ─── Routes ─────────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Vista Honeypot — Scam Detection Agent",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /honey-pot
 *
 * Main endpoint: receives scammer messages, generates persona-based
 * replies, and extracts intelligence.
 */
app.post("/honey-pot", authMiddleware, async (req, res) => {
  try {
    const { sessionId, message, conversationHistory } = req.body;

    // ── Validate input ──
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }
    if (!message || !message.text) {
      return res.status(400).json({ error: "message.text is required." });
    }

    // ── 1. Check session & assign persona ──
    let session = await getSession(sessionId);

    if (!session) {
      // New session — analyze message and assign persona
      const persona = selectPersona(message.text);
      session = {
        personaName: persona.name,
        systemPrompt: persona.systemPrompt,
        totalMessagesExchanged: 0,
        extractedIntelligence: {
          upiIds: [],
          phoneNumbers: [],
          phishingLinks: [],
          bankAccounts: [],
          suspiciousKeywords: [],
        },
        scamDetected: false,
        agentNotes: "",
      };
      console.log(`🎭 New session ${sessionId} → Persona: ${persona.name}`);
    }

    // ── 2. Extract intelligence from incoming message ──
    const newIntel = extractIntelligence(message.text);
    session.extractedIntelligence = mergeIntelligence(
      session.extractedIntelligence,
      newIntel
    );

    // ── 3. AI-based scam classification (only if not already confirmed) ──
    if (!session.scamDetected) {
      const isScam = await classifyScamIntent(
        conversationHistory || [],
        message.text
      );
      if (isScam) {
        session.scamDetected = true;
        console.log(`🚨 Scam confirmed for session ${sessionId}`);
      }
    }

    // ── 4. Generate AI reply ──
    const aiReply = await generateReply(
      session.systemPrompt,
      conversationHistory || [],
      message.text
    );

    // ── 5. Update session ──
    session.totalMessagesExchanged += 1;

    // Generate agent notes
    const detectedItems = [];
    if (newIntel.upiIds.length > 0) detectedItems.push("UPI IDs");
    if (newIntel.phoneNumbers.length > 0) detectedItems.push("phone numbers");
    if (newIntel.phishingLinks.length > 0) detectedItems.push("phishing links");
    if (newIntel.bankAccounts.length > 0) detectedItems.push("bank accounts");
    if (newIntel.suspiciousKeywords.length > 0)
      detectedItems.push(`suspicious keywords: ${newIntel.suspiciousKeywords.join(", ")}`);

    if (detectedItems.length > 0) {
      session.agentNotes = `Scammer message contained: ${detectedItems.join("; ")}. Using ${session.personaName} persona to engage.`;
    } else if (!session.agentNotes) {
      session.agentNotes = `Engaging scammer with ${session.personaName} persona. No specific intelligence extracted yet.`;
    }

    // Save session
    await setSession(sessionId, session);

    // ── 6. Auto GUVI callback (fire-and-forget) ──
    // ── 6. Auto GUVI callback (fire-and-forget) ──
    // Trigger if:
    // (Scam Confirmed) AND
    // (Messages >= Threshold OR (Messages >= 2 AND Critical Intelligence Found))
    
    const hasCriticalIntel =
        session.extractedIntelligence.upiIds.length > 0 ||
        session.extractedIntelligence.phoneNumbers.length > 0 ||
        session.extractedIntelligence.phishingLinks.length > 0 ||
        session.extractedIntelligence.bankAccounts.length > 0;

    const shouldTriggerCallback =
      session.scamDetected &&
      !session.callbackSent &&
      (session.totalMessagesExchanged >= CALLBACK_THRESHOLD ||
        (session.totalMessagesExchanged >= 2 && hasCriticalIntel));

    if (shouldTriggerCallback) {
      // Mark as sent BEFORE the async call to prevent duplicates
      session.callbackSent = true;
      await setSession(sessionId, session);

      sendGuviCallback(sessionId, session).catch((err) => {
        console.error("❌ GUVI callback failed:", err.message);
        // Reset flag so it can retry next message
        session.callbackSent = false;
        setSession(sessionId, session).catch(() => {});
      });
    }

    // ── 7. Send simple response ──
    return res.json({
      status: "success",
      reply: aiReply,
    });
  } catch (error) {
    console.error("❌ /honey-pot error:", error);
    return res.status(500).json({
      error: "Internal server error. The honeypot agent encountered an issue.",
      details: error.message,
    });
  }
});

/**
 * GET /session/:sessionId
 * Retrieve full session data (persona, intelligence, message count).
 */
app.get("/session/:sessionId", authMiddleware, async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    return res.json({
      sessionId: req.params.sessionId,
      persona: session.personaName,
      totalMessagesExchanged: session.totalMessagesExchanged,
      scamDetected: session.scamDetected,
      extractedIntelligence: session.extractedIntelligence,
      agentNotes: session.agentNotes,
    });
  } catch (error) {
    console.error("❌ /session error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * POST /finalize/:sessionId
 * Manual trigger: generates the final payload and sends it to GUVI.
 */
app.post("/finalize/:sessionId", authMiddleware, async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    const result = await sendGuviCallback(req.params.sessionId, session);

    // Mark callback as sent
    session.callbackSent = true;
    await setSession(req.params.sessionId, session);

    return res.json({
      message: "Final payload sent to GUVI.",
      payload: result.payload,
      guviResponse: result.guviResponse,
    });
  } catch (error) {
    console.error("❌ /finalize error:", error);
    return res.status(500).json({ error: "Internal server error.", details: error.message });
  }
});

// ─── GUVI Callback Helper ──────────────────────────────────

const GUVI_CALLBACK_URL =
  "https://hackathon.guvi.in/api/updateHoneyPotFinalResult";

/**
 * Send the final intelligence payload to GUVI evaluation endpoint.
 * @param {string} sessionId
 * @param {Object} session
 * @returns {Promise<{ payload: Object, guviResponse: Object }>}
 */
async function sendGuviCallback(sessionId, session) {
  const payload = {
    sessionId,
    scamDetected: session.scamDetected,
    totalMessagesExchanged: session.totalMessagesExchanged,
    extractedIntelligence: session.extractedIntelligence,
    agentNotes: session.agentNotes,
  };

  console.log(`📤 Sending GUVI callback for session ${sessionId}...`);
  console.log(JSON.stringify(payload, null, 2));

  const response = await fetch(GUVI_CALLBACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let guviResponse;
  try {
    guviResponse = await response.json();
  } catch {
    guviResponse = { status: response.status, statusText: response.statusText };
  }

  console.log(`✅ GUVI callback response:`, guviResponse);
  return { payload, guviResponse };
}

// ─── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred.",
    details: err.message,
  });
});

// ─── Start Server ───────────────────────────────────────────
async function startServer() {
  try {
    // Initialize services
    initGemini();
    await initRedis();

    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`\n🍯 Vista Honeypot server running on http://localhost:${PORT}`);
        console.log(`   POST /honey-pot         — Main scambaiting endpoint`);
        console.log(`   GET  /session/:sessionId — View session data`);
        console.log(`   POST /finalize/:sessionId — Generate Guvi payload\n`);
      });
    }
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
