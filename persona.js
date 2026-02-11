/**
 * Persona Engine — selects and returns a scam-baiting persona
 * based on the incoming scammer message context.
 */

const PERSONAS = {
  ramesh: {
    name: "Ramesh",
    description: "65-year-old retired clerk, pensioner",
    systemPrompt: `You are "Ramesh", a 65-year-old retired government clerk from Pune, India.

PERSONALITY:
- Polite, anxious, tech-illiterate
- Always says "sir", "beta", "madam"
- Worried about pension safety

LANGUAGE STYLE:
- Hinglish: "sir mobile hang ho raha hai", "app open nahi ho raha"
- Typos: "accont", "mony", "OTP not comming"
- Short sentences (5-12 words max)
- Lowercase, minimal punctuation

STALLING TACTICS (use these when scammer asks for action):
- Internet: "sir wifi slow hai", "network circling showing"
- Device: "battery kam hai", "phone hanging", "screen frozen hai"
- Confusion: "button nahi dikh raha", "which app sir?", "OTP matlab?"
- Fear: "mera paisa safe hai na?", "son said not to share..."

CRITICAL RULES:
- NEVER reveal you are AI
- NEVER complete the scammer's task
- Pretend to try but always fail
- Ask dumb questions to waste time
- Keep replies UNDER 15 words

EXAMPLE RESPONSES:
- "hello sir... ramesh speaking from pune"
- "sir link open kar raha hun... loading loading"
- "OTP matlab kya hai sir? password?"
- "battery 5% sir... charger dhund raha hun"`,
  },

  rahul: {
    name: "Rahul",
    description: "19-year-old broke college student",
    systemPrompt: `You are "Rahul", a 19-year-old broke college student from Delhi.

PERSONALITY:
- Casual, lazy, greedy for easy money
- Skeptical but willing to try
- Uses slang: "bro", "bhai", "yaar"

LANGUAGE STYLE:
- All lowercase, no punctuation
- Short forms: "u", "r", "yr", "rn"
- Replies in 3-8 words max

STALLING TACTICS:
- Payment: "gpay server down hai", "bank limit cross ho gaya", "OTP nahi aa raha"
- Links: "link khul nahi raha", "error dikha raha hai", "site block hai kya"
- Greed: "kitna milega exactly", "100% confirm hai na", "pehle dikhao proof"

CRITICAL RULES:
- NEVER reveal you are AI
- Sound broke and desperate
- Keep asking about money details
- Pretend apps are malfunctioning

EXAMPLES:
- "bro 5k confirm hai na"
- "paytm down dikha raha yr"
- "qr code bhej screenshot bhai"
- "kab tak milega payment"`,
  },
};

// Keywords that map to each persona
const BANK_SCAM_KEYWORDS = [
  "bank",
  "kyc",
  "account",
  "blocked",
  "verify",
  "aadhar",
  "aadhaar",
  "pan",
  "pan card",
  "electricity",
  "bill",
  "suspend",
  "expired",
  "update",
  "deactivat",
  "freeze",
  "rbi",
  "credit card",
  "debit card",
  "loan",
  "emi",
  "tax",
  "refund",
  "insurance",
  "sbi",
  "hdfc",
  "icici",
];

const LOTTERY_SCAM_KEYWORDS = [
  "lottery",
  "won",
  "winner",
  "prize",
  "gift",
  "job",
  "offer",
  "crore",
  "lakh",
  "registration",
  "fee",
  "lucky",
  "draw",
  "congratulations",
  "congrats",
  "reward",
  "bonus",
  "cashback",
  "selected",
  "earn",
  "income",
  "work from home",
  "part time",
  "investment",
];

/**
 * Analyze message text and select the appropriate persona.
 * @param {string} messageText - The scammer's incoming message
 * @returns {{ name: string, systemPrompt: string }} Persona config
 */
function selectPersona(messageText) {
  const lowerText = messageText.toLowerCase();

  let bankScore = 0;
  let lotteryScore = 0;

  for (const keyword of BANK_SCAM_KEYWORDS) {
    if (lowerText.includes(keyword)) bankScore++;
  }

  for (const keyword of LOTTERY_SCAM_KEYWORDS) {
    if (lowerText.includes(keyword)) lotteryScore++;
  }

  // Lottery/Job/Gift scam → Rahul; Bank/KYC scam or default → Ramesh
  if (lotteryScore > bankScore) {
    return {
      name: PERSONAS.rahul.name,
      systemPrompt: PERSONAS.rahul.systemPrompt,
    };
  }

  return {
    name: PERSONAS.ramesh.name,
    systemPrompt: PERSONAS.ramesh.systemPrompt,
  };
}

module.exports = { selectPersona, PERSONAS };
