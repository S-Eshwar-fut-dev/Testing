/**
 * Redis Session Store — stores sessionId → persona + intelligence mapping.
 * Falls back to in-memory Map if Redis is unavailable.
 */

const { createClient } = require("redis");

let redisClient = null;
let useMemoryFallback = false;
const memoryStore = new Map();

const SESSION_TTL = 3600; // 1 hour

/**
 * Initialize Redis connection. Falls back to in-memory store on failure.
 */
async function initRedis() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on("error", (err) => {
      if (!useMemoryFallback) {
        console.warn("⚠️  Redis error, switching to in-memory store:", err.message);
        useMemoryFallback = true;
      }
    });

    // Race the connection against a 3-second timeout
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout (3s)")), 3000)
      ),
    ]);
    console.log("✅ Redis connected at", redisUrl);
  } catch (error) {
    console.warn("⚠️  Redis unavailable, using in-memory store:", error.message);
    useMemoryFallback = true;
    // Disconnect if partially connected
    try { if (redisClient) await redisClient.disconnect(); } catch (_) {}
    redisClient = null;
  }
}

/**
 * Get session data by sessionId.
 * @param {string} sessionId
 * @returns {Promise<Object|null>} Parsed session data or null
 */
async function getSession(sessionId) {
  try {
    if (useMemoryFallback) {
      const data = memoryStore.get(sessionId);
      return data || null;
    }

    const raw = await redisClient.get(`session:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("❌ getSession error:", error.message);
    // Fallback to memory
    const data = memoryStore.get(sessionId);
    return data || null;
  }
}

/**
 * Set session data.
 * @param {string} sessionId
 * @param {Object} data - Session data to store
 */
async function setSession(sessionId, data) {
  try {
    // Always update memory store as backup
    memoryStore.set(sessionId, data);

    if (!useMemoryFallback && redisClient) {
      await redisClient.set(`session:${sessionId}`, JSON.stringify(data), {
        EX: SESSION_TTL,
      });
    }
  } catch (error) {
    console.error("❌ setSession error:", error.message);
    // Memory store already updated above
  }
}

module.exports = { initRedis, getSession, setSession };
