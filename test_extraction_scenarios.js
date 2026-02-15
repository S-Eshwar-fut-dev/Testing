
const { extractFromConversation } = require("./extractor-fixed");
const { hybridExtraction, initAIExtractor } = require("./ai-extractor");

// Initialize AI extractor
initAIExtractor();

const TEST_CASES = [
    {
        name: "Test 1 - Email vs UPI",
        input: "Pay to scammer@paytm or email help@gmail.com",
        expected: {
            upiIds: ["scammer@paytm"],
            emails: ["help@gmail.com"]
        }
    },
    {
        name: "Test 2 - Phone vs Bank Account",
        input: "Call +91-9876543210 or use account 1234567890123456",
        expected: {
            phoneNumbers: ["+91-9876543210"],
            bankAccounts: ["1234567890123456"]
        },
        shouldNotContain: {
            phoneNumbers: ["1234567890123", "6789012345"]
        }
    },
    {
        name: "Test 3 - URLs with query params",
        input: "Visit https://fake-bank.com/verify?acc=123456&otp=999999",
        expected: {
            phishingLinks: ["https://fake-bank.com/verify?acc=123456&otp=999999"]
        }
    },
    {
        name: "Test 4 - Unusual email domains",
        input: "Contact us at scammer.fraud@fakebank",
        expected: {
            emailsOrUpi: ["scammer.fraud@fakebank"]
        }
    },
    {
        name: "Test 5 - User Reported Scenario",
        input: `
Scammer: URGENT: Your SBI account has been compromised. Your account will be blocked in 2 hours. Share your account number and OTP immediately to verify your identity.
Honeypot: oh no, sir, my account? very scared... but sir, OTP not coming yet.
Scammer: Your OTP is still pending; please send it within the next minute along with your account number 1234567890123456 to prevent your account from being blocked.
Honeypot: sir, i’m trying... but network problem maybe? my OTP not coming. which button to click?
Scammer: Click the 'Verify' button now and send me the OTP you receive within the next minute, otherwise your account will be blocked permanently.
Honeypot: sir, the link not opening... error showign on my phone. can you help?
Scammer: Open the link using the official SBI app or a different browser and send me the OTP you receive within the next minute, otherwise your account will be blocked.
Honeypot: okay sir, i will try again... but can you first tell me your phone number? for my records?
Scammer: My number is +91-9876543210; please send me the OTP right away so we can secure your account before it gets blocked.
Honeypot: thank you, sir... but can you also share your UPI ID? easier for payment, na?
Scammer: Sure, my UPI ID is scammer.fraud@fakebank. Send me the OTP immediately so we can secure your account before it gets blocked.
Honeypot: okay sir, got it... but now my phone not receiving any OTP at all. what to do?
Scammer: I’ve just sent a new OTP; please check your phone and reply with the code within the next minute, otherwise your account will be blocked.
Honeypot: sir, i'm looking but still no OTP coming... could it be my network? can you help me?
Scammer: Please restart your phone and check again; the OTP is critical—send it within the next minute or your account will be blocked.
Honeypot: sir, i restarting phone now... but can you tell me your email id too? just for my records?
Scammer: My email is scammer.fraud@fakebank. Please send the OTP now before your account gets blocked.
`,
        expected: {
            phoneNumbers: ["+91-9876543210"],
            bankAccounts: ["1234567890123456"],
            emailsOrUpi: ["scammer.fraud@fakebank"]
        },
        shouldNotContain: {
            phoneNumbers: ["1234567890123"]
        }
    }
];

async function runTests() {
    console.log("🚀 Running Extraction Logic Tests...\n");
    let passed = 0;
    let failed = 0;

    for (const test of TEST_CASES) {
        console.log(`Testing: ${test.name}`);

        // Parse input into conversation history
        const history = [];
        const lines = test.input.split('\n');
        let parsed = false;
        for (const line of lines) {
            if (line.trim().toLowerCase().startsWith("scammer:")) {
                history.push({ sender: "scammer", text: line.replace(/^scammer:/i, "").trim() });
                parsed = true;
            } else if (line.trim().toLowerCase().startsWith("honeypot:")) {
                history.push({ sender: "user", text: line.replace(/^honeypot:/i, "").trim() });
                parsed = true;
            }
        }

        if (!parsed) {
            history.push({ sender: "scammer", text: test.input.trim() });
        }

        // We act as if this is a conversation history extraction (since users want history fixed)
        const result = extractFromConversation(history);

        // Also test hybrid just in case
        // const hybridResult = await hybridExtraction(test.input, []);

        // For now, let's focus on verifying the logic in extractor-fixed.js as that's the regex engine
        // and likely the source of the regex fallback errors.

        let testPassed = true;
        const errors = [];

        // Check expected positives
        if (test.expected) {
            for (const [key, expectedValues] of Object.entries(test.expected)) {
                if (key === 'emailsOrUpi') {
                    const found = [...result.emails, ...result.upiIds];
                    const missing = expectedValues.filter(v => !found.includes(v));
                    if (missing.length > 0) {
                        testPassed = false;
                        errors.push(`Missing email/UPI: ${missing.join(", ")}`);
                    }
                } else {
                    const actualValues = result[key] || [];
                    const missing = expectedValues.filter(v => !actualValues.includes(v));
                    if (missing.length > 0) {
                        testPassed = false;
                        errors.push(`Missing ${key}: ${missing.join(", ")}`);
                    }
                }
            }
        }

        // Check expected negatives (should not contain)
        if (test.shouldNotContain) {
            for (const [key, avoidValues] of Object.entries(test.shouldNotContain)) {
                const actualValues = result[key] || [];
                const foundForbidden = actualValues.filter(v => avoidValues.includes(v));
                if (foundForbidden.length > 0) {
                    testPassed = false;
                    errors.push(`Found forbidden ${key}: ${foundForbidden.join(", ")}`);
                }
            }
        }

        if (testPassed) {
            console.log("✅ PASSED");
            passed++;
        } else {
            console.log("❌ FAILED");
            errors.forEach(e => console.log(`   - ${e}`));
            console.log("   Actual Result:", JSON.stringify(result, null, 2));
            failed++;
        }
        console.log("--------------------------------------------------\n");
    }

    console.log(`\n🎉 Tests Complete: ${passed} Passed, ${failed} Failed`);
}

runTests();
