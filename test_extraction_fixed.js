const fetch = require('node-fetch');

const API_KEY = "HONEYPOT_SECRET_KEY_123"; // Make sure this matches .env
const BASE_URL = "http://127.0.0.1:3000";
const SESSION_ID = "test-final-" + Date.now();

async function runTest() {
    console.log(`🔍 Testing Session: ${SESSION_ID}\n`);

    // Scenario: Scammer sends info in the first message.
    // The server should extract it immediately.
    const message1 = {
        text: "Your OTP has been sent to +91-9876543210; reply with the code and confirm scammer.fraud@fakebank",
        sender: "scammer"
    };

    console.log(`1️⃣ Sending Message 1: "${message1.text}"`);
    const res1 = await fetch(`${BASE_URL}/honey-pot`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message: message1,
            conversationHistory: []
        })
    });
    const text1 = await res1.text();
    console.log(`📥 Reply 1 Status: ${res1.status}`);
    console.log(`📥 Reply 1 Body: "${text1}"`);
    let data1;
    try {
        data1 = JSON.parse(text1);
    } catch (e) {
        console.error("❌ Failed to parse JSON:", e);
        return;
    }
    console.log(`📥 Reply 1: "${data1.reply}"\n`);

    // Check intelligence after first message
    await checkIntelligence("After Message 1");

    // Scenario: Scammer sends a second message with NO info.
    // The server should RETAIN the info from the first message (via history extraction).
    const message2 = {
        text: "Are you there? Send the code fast.",
        sender: "scammer"
    };

    // Construct history manually as the client would
    const history = [
        message1,
        { text: data1.reply, sender: "user" } // The honeypot's reply
    ];

    console.log(`2️⃣ Sending Message 2: "${message2.text}"`);
    const res2 = await fetch(`${BASE_URL}/honey-pot`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        },
        body: JSON.stringify({
            sessionId: SESSION_ID,
            message: message2,
            conversationHistory: history
        })
    });
    const data2 = await res2.json();
    console.log(`📥 Reply 2: "${data2.reply}"\n`);

    // Check intelligence after second message
    await checkIntelligence("After Message 2");
}

async function checkIntelligence(stage) {
    console.log(`🕵️ Fetching Intelligence (${stage})...`);
    const res = await fetch(`${BASE_URL}/session/${SESSION_ID}`, {
        headers: { "x-api-key": API_KEY }
    });
    const data = await res.json();
    const intel = data.extractedIntelligence;

    console.log("✅ Extracted Intelligence:");
    console.log(JSON.stringify(intel, null, 2));

    // Verification Logic
    const hasPhone = intel.phoneNumbers.some(p => p.includes("9876543210"));
    const hasUPI = intel.upiIds.includes("scammer.fraud@fakebank");

    if (hasPhone && hasUPI) {
        console.log(`🟢 PASSED: Found Phone and UPI in ${stage}\n`);
    } else {
        console.log(`🔴 FAILED: Missing Phone or UPI in ${stage}\n`);
    }
}

runTest().catch(console.error);
