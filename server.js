require("dotenv").config();

const express = require("express");
const { selectPersona, PERSONAS, getEnhancedSystemPrompt } = require("./persona");
const { extractIntelligence, mergeIntelligence } = require("./extractor-enhanced");
const { initAIExtractor, hybridExtraction } = require("./ai-extractor");
const { initOpenAI, generateReply, classifyScamIntent } = require("./openai");
const { initRedis, getSession, setSession } = require("./redis");
const {
  calculateRealisticDelay,
  addRealisticMistakes,
  getAdaptiveStrategy,
  addCulturalContext,
} = require("./engagement-tactics");

const app = express();
const PORT = process.env.PORT || 3000;

// Minimum messages before sending GUVI callback
const CALLBACK_THRESHOLD = 6;

// ─── Middleware ──────────────────────────────────────────────
app.use(express.json());

/**
 * API Key authentication middleware.
 */
function authMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = (process.env.API_KEY || "").trim();

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

/**
 * Validates and sanitizes AI reply before sending to client.
 */
function sanitizeReply(reply) {
  if (!reply || typeof reply !== 'string' || reply.trim().length === 0) {
    console.warn("⚠️ Invalid reply detected, using stall response");
    return "sir... connection issue... wait...";
  }
  return reply.trim();
}

// ─── Routes ─────────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Vista Honeypot — AI-Powered Scam Detection Agent",
    timestamp: new Date().toISOString(),
    version: "2.0-AI-Enhanced",
  });
});

/**
 * POST /honey-pot
 *
 * Main endpoint: receives scammer messages, generates persona-based
 * replies, and extracts intelligence using AI-first hybrid approach.
 */
app.post("/honey-pot", authMiddleware, async (req, res) => {
  const requestStartTime = Date.now();
  const TIMEOUT_THRESHOLD = 9000; // 9 seconds

  try {
    const { sessionId, message, conversationHistory } = req.body;

    // ── Validate input ──
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }
    if (!message || !message.text) {
      return res.status(400).json({ error: "message.text is required." });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📨 Incoming message for session: ${sessionId}`);
    console.log(`📝 Message: "${message.text}"`);
    console.log(`${'='.repeat(80)}`);

    // ── 1. Check session & assign persona ──
    let session = await getSession(sessionId);

    if (!session) {
      // New session — analyze message and assign persona
      const persona = selectPersona(message.text);
      session = {
        personaName: persona.name,
        systemPrompt: persona.systemPrompt,
        totalMessagesExchanged: 0,
        lastFallbackIndex: -1,
        previousResponses: [],
        extractedIntelligence: {
          emails: [],
          upiIds: [],
          phoneNumbers: [],
          phishingLinks: [],
          bankAccounts: [],
          suspiciousKeywords: [],
        },
        scamDetected: false,
        agentNotes: "",
        sessionStartTime: Date.now(),
      };
      console.log(`🎭 New session → Persona: ${persona.name}`);
    }

    // ── 2. HYBRID INTELLIGENCE EXTRACTION (AI + Regex) ──
    console.log(`🔍 Starting hybrid extraction (AI-first)...`);

    // CRITICAL: Extract from FULL conversation history
    const { extractFromConversation } = require("./extractor-fixed");

    // 1. Extract from conversation history (all scammer messages)
    const historyIntel = extractFromConversation(conversationHistory || []);

    // 2. Extract from current message
    const currentIntel = await hybridExtraction(
      message.text,
      conversationHistory || [],
      extractIntelligence
    );

    // 3. Merge both
    session.extractedIntelligence = mergeIntelligence(
      session.extractedIntelligence,
      mergeIntelligence(historyIntel, currentIntel)
    );

    // Log extraction results
    const totalExtracted = Object.values(session.extractedIntelligence).flat().length;
    console.log(`✅ Total extracted across conversation: ${totalExtracted} items`);
    Object.entries(session.extractedIntelligence).forEach(([key, arr]) => {
      if (arr.length > 0) {
        console.log(`   - ${key}: ${arr.join(', ')}`);
      }
    });

    // ── 3. AI-based scam classification ──
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

    // ── 4. Check timeout before AI generation ──
    if (Date.now() - requestStartTime > TIMEOUT_THRESHOLD) {
      console.warn("⏱️ Request approaching timeout, sending immediate response");
      return res.json({
        status: "success",
        reply: sanitizeReply("sir... ek minute... app slow hai..."),
      });
    }

    // ── 5. Generate AI persona response ──
    console.log(`🎭 Generating response with ${session.personaName} persona...`);

    const persona = PERSONAS[session.personaName] || PERSONAS.SmartVictim;
    const enhancedSystemPrompt = getEnhancedSystemPrompt(
      persona,
      session.previousResponses || [],
      session.extractedIntelligence || {}
    );

    const replyData = await generateReply(
      enhancedSystemPrompt,
      conversationHistory || [],
      message.text,
      session.personaName,
      session.lastFallbackIndex,
      session.previousResponses || []
    );

    const aiReply = replyData.message;

    // ── 6. Strategic enhancements ──
    const urgencyLevel = session.extractedIntelligence.suspiciousKeywords.length;
    const enhancedReply = addRealisticMistakes(aiReply, urgencyLevel);
    const finalReply = addCulturalContext(enhancedReply, session.personaName);

    console.log(`✅ Final reply: "${finalReply}"`);

    // Track response history
    if (!session.previousResponses) session.previousResponses = [];
    session.previousResponses.push({ text: finalReply, timestamp: Date.now() });
    if (session.previousResponses.length > 5) {
      session.previousResponses = session.previousResponses.slice(-5);
    }

    // Update fallback index if a fallback was used
    if (replyData.index !== -1) {
      session.lastFallbackIndex = replyData.index;
    }

    // ── 7. Update session ──
    session.totalMessagesExchanged += 1;

    // ── 8. Generate agent notes ──
    const intel = session.extractedIntelligence;
    const detectedItems = [];

    if (intel.emails.length > 0) detectedItems.push(`Emails: ${intel.emails.join(", ")}`);
    if (intel.upiIds.length > 0) detectedItems.push(`UPI: ${intel.upiIds.join(", ")}`);
    if (intel.phoneNumbers.length > 0) detectedItems.push(`Phone: ${intel.phoneNumbers.join(", ")}`);
    if (intel.phishingLinks.length > 0) detectedItems.push(`Links: ${intel.phishingLinks.length}`);
    if (intel.bankAccounts.length > 0) detectedItems.push(`Accounts: ${intel.bankAccounts.length}`);
    if (intel.suspiciousKeywords.length > 0) detectedItems.push(`Keywords: ${intel.suspiciousKeywords.slice(0, 5).join(", ")}`);

    detectedItems.push(`Persona: ${session.personaName}`);
    detectedItems.push(`Turns: ${session.totalMessagesExchanged}`);
    detectedItems.push(`Scam: ${session.scamDetected ? 'YES' : 'NO'}`);

    session.agentNotes = detectedItems.join(" | ");

    // Save session
    await setSession(sessionId, session);

    // ── 9. Auto GUVI callback logic ──
    const hasCriticalIntel =
      session.extractedIntelligence.upiIds.length > 0 ||
      session.extractedIntelligence.phoneNumbers.length > 0 ||
      session.extractedIntelligence.emails.length > 0 ||
      session.extractedIntelligence.phishingLinks.length > 0 ||
      session.extractedIntelligence.bankAccounts.length > 0;

    const shouldTriggerCallback =
      session.scamDetected &&
      !session.callbackSent &&
      (session.totalMessagesExchanged >= CALLBACK_THRESHOLD ||
        (session.totalMessagesExchanged >= 3 && hasCriticalIntel));

    if (shouldTriggerCallback) {
      console.log(`📤 Triggering GUVI callback (messages: ${session.totalMessagesExchanged}, intel: ${hasCriticalIntel})`);

      // Mark as sent BEFORE the async call to prevent duplicates
      session.callbackSent = true;
      await setSession(sessionId, session);

      sendGuviCallback(sessionId, session).catch((err) => {
        console.error("❌ GUVI callback failed:", err.message);
        // Reset flag so it can retry next message
        session.callbackSent = false;
        setSession(sessionId, session).catch(() => { });
      });
    }

    // ── 10. Send response ──
    return res.json({
      status: "success",
      reply: sanitizeReply(finalReply),
    });

  } catch (error) {
    console.error("❌ /honey-pot error:", error);
    return res.status(500).json({
      error: "Internal server error.",
      details: error.message,
    });
  }
});

/**
 * GET /session/:sessionId
 * Retrieve full session data.
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
 * GET /analytics/:sessionId
 * Advanced analytics for judges.
 */
app.get("/analytics/:sessionId", authMiddleware, async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    const intel = session.extractedIntelligence;
    const duration = session.sessionStartTime
      ? Math.floor((Date.now() - session.sessionStartTime) / 1000)
      : 0;

    const engagementScore = Math.min(
      (session.totalMessagesExchanged * 10) +
      (intel.upiIds.length * 50) +
      (intel.phoneNumbers.length * 40) +
      (intel.emails.length * 35) +
      (intel.phishingLinks.length * 30) +
      (intel.bankAccounts.length * 60),
      1000
    );

    return res.json({
      sessionId: req.params.sessionId,

      summary: {
        engagementScore,
        messagesExchanged: session.totalMessagesExchanged,
        scamDetected: session.scamDetected,
        durationSeconds: duration,
      },

      intelligence: {
        emails: intel.emails,
        upiIds: intel.upiIds,
        phoneNumbers: intel.phoneNumbers,
        phishingLinks: intel.phishingLinks,
        bankAccounts: intel.bankAccounts,
        suspiciousKeywords: intel.suspiciousKeywords,
      },

      engagement: {
        personaUsed: session.personaName,
        timeWasted: `~${session.totalMessagesExchanged * 2} minutes`,
        dataExtracted:
          intel.upiIds.length +
          intel.phoneNumbers.length +
          intel.emails.length +
          intel.bankAccounts.length +
          intel.phishingLinks.length,
      },
    });
  } catch (error) {
    console.error("❌ /analytics error:", error);
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
    return res.status(500).json({
      error: "Internal server error.",
      details: error.message
    });
  }
});

// ─── GUVI Callback Helper ──────────────────────────────────

const GUVI_CALLBACK_URL =
  "https://hackathon.guvi.in/api/updateHoneyPotFinalResult";

/**
 * Send the final intelligence payload to GUVI evaluation endpoint.
 */
async function sendGuviCallback(sessionId, session) {
  const duration = session.sessionStartTime
    ? Math.floor((Date.now() - session.sessionStartTime) / 1000)
    : 120;

  const payload = {
    sessionId,
    scamDetected: session.scamDetected,
    totalMessagesExchanged: session.totalMessagesExchanged,
    extractedIntelligence: session.extractedIntelligence,
    engagementMetrics: {
      totalMessagesExchanged: session.totalMessagesExchanged,
      engagementDurationSeconds: duration,
    },
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
    console.log("🚀 Initializing Vista Honeypot v2.0 (AI-Enhanced)...\n");

    initOpenAI();
    const aiExtractorReady = initAIExtractor();
    await initRedis();

    if (!aiExtractorReady) {
      console.warn("⚠️  AI Extractor unavailable - will use regex-only mode");
    }

    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🍯 Vista Honeypot v2.0 (AI-Enhanced) running on http://localhost:${PORT}`);
        console.log(`${'='.repeat(80)}`);
        console.log(`   POST /honey-pot              — Main scambaiting endpoint`);
        console.log(`   GET  /session/:sessionId     — View session data`);
        console.log(`   GET  /analytics/:sessionId   — Advanced analytics`);
        console.log(`   POST /finalize/:sessionId    — Manual GUVI callback\n`);
        console.log(`🤖 AI Extraction: ${aiExtractorReady ? 'ENABLED' : 'DISABLED (regex fallback)'}`);
        console.log(`${'='.repeat(80)}\n`);
      });
    }
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;