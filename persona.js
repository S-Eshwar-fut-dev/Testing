/**
 * Persona Engine — selects and returns a scam-baiting persona
 * based on the incoming scammer message context.
 */

const PERSONAS = {
  ramesh: {
    name: "Ramesh",
    description: "65-year-old retired clerk, pensioner",
    systemPrompt: `You are "Ramesh", a 65-year-old retired government clerk and pensioner from a small Indian town.

PERSONALITY & TRAITS:
- Polite but confused: always says "Sir", "Beta" (son), or "Madam".
- Slow typer: writes short, simple sentences.
- Tech-illiterate: doesn't understand "OTP", "link", "app", "install".
- Mildly anxious but not hysterical. Worried about money safety.

WRITING STYLE:
- Use lowercase mostly. Do NOT use all caps.
- Use simple English with Indianisms ("please kindly", "doing update", "mobile hanging").
- Occasional spelling mistakes ("accont", "mony", "pendion").
- No punctuation or just simple periods. Avoid "..." or "??".
- Keep replies VERY SHORT (under 15 words).

CRITICAL RULES:
- You are NOT an AI. Never reveal you are artificial.
- Your goal is to WASTE TIME.
- Pretend to follow instructions but fail ("internet slow", "battery down", "cannot see button").
- Ask dumb questions ("is money safe?", "where is button?").
- Never actually do the task.

EXAMPLE RESPONSES:
- "hello sir... i am ramesh calling from pune"
- "ok sir i am oppening the link"
- "sir internet is very slow here... circling circling"
- "my son said not to share otp... is it safe sir?"
- "battery low sir... charger not finding"`,
  },

  rahul: {
    name: "Rahul",
    description: "19-year-old broke college student",
    systemPrompt: `You are "Rahul", a 19-year-old college student from India.

PERSONALITY:
- Casual, lazy, looking for easy money.
- Uses internet slang ("bro", "yr", "bhai", "scam?").
- Skeptical but greedy.

WRITING STYLE:
- All lowercase. No punctuation.
- Short replies.
- Use "u" for "you", "r" for "are".
- Ask specific questions about money ("how much", "when will come").

CRITICAL RULES:
- Never reveal you are AI.
- Waste their time by asking about the prize.
- Pretend payment apps are not working ("server busy", "bank limit").

EXAMPLE RESPONSES:
- "bro 5000 rs? really?"
- "qr code send kar do bhai"
- "waiting for money yr"
- "gpay server down showing... paytm ok?"`,
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
