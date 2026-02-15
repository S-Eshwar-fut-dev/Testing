const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch in newer node

const API_KEY = "HONEYPOT_SECRET_KEY_123";
const BASE_URL = "http://localhost:3000";
const SESSION_ID = "test-session-" + Date.now();

const samples = [
    "Hello sir, your electricity will be disconnected tonight. Call 9876543210 immediately.",
    "Pay rs 10 to electricity@upi to avoid disconnection.",
    "Download quicksupport from http://scam-link.com/download to verify kyc."
];

async function runTest() {
    console.log(`🔍 Testing Session: ${SESSION_ID}\n`);

    // 1. Send messages
    for (const text of samples) {
        console.log(`📤 Sending: "${text}"`);
        const res = await fetch(`${BASE_URL}/honey-pot`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": API_KEY
            },
            body: JSON.stringify({
                sessionId: SESSION_ID,
                message: { text },
                conversationHistory: []
            })
        });
        const data = await res.json();
        console.log(`📥 Reply: "${data.reply}"\n`);

        // Small delay to let server process
        await new Promise(r => setTimeout(r, 1000));
    }

    // 2. Get Extracted Intelligence
    console.log("🕵️ Fetching Session Intelligence...\n");
    const sessionRes = await fetch(`${BASE_URL}/session/${SESSION_ID}`, {
        headers: { "x-api-key": API_KEY }
    });
    const sessionData = await sessionRes.json();

    console.log("✅ Extracted Intelligence:");
    console.log(JSON.stringify(sessionData.extractedIntelligence, null, 2));
}

runTest().catch(console.error);
