
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
            // Accept either email or UPI for this one as per user request
            emailsOrUpi: ["scammer.fraud@fakebank"]
        }
    }
];

async function runTests() {
    console.log("🚀 Running Extraction Logic Tests...\n");
    let passed = 0;
    let failed = 0;

    for (const test of TEST_CASES) {
        console.log(`Testing: ${test.name}`);
        console.log(`Input: "${test.input}"`);

        // We act as if this is a conversation history extraction (since users want history fixed)
        const historyResult = extractFromConversation([{ sender: "scammer", text: test.input }]);

        // Also test hybrid just in case
        // const hybridResult = await hybridExtraction(test.input, []);

        // For now, let's focus on verifying the logic in extractor-fixed.js as that's the regex engine
        // and likely the source of the regex fallback errors.

        const result = historyResult;

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
