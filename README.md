# Vista Honeypot 🍯

An AI-powered Agentic Honeypot for scam detection and intelligence extraction.
Powered by Groq's `llama-3.3-70b-versatile` model.

This project was built for the **GUVI Hackathon** to detect scam intent, engage scammers autonomously, and extract intelligence (UPI IDs, phone numbers, etc.).

## Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/S-Eshwar-fut-dev/vista_honeypot.git
    cd vista_honeypot
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment:**
    Create a `.env` file with:
    ```env
    GROK_API_KEY=your_groq_api_key
    API_KEY=your_secure_password
    ```
4.  **Run Server:**
    ```bash
    npm start
    ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROK_API_KEY` | Groq API Key (starts with `gsk_`) |
| `API_KEY` | Secret key for securing the `/honey-pot` endpoint. |

## API Endpoints

- **POST /honey-pot**: Main endpoint for receiving scam messages.
- **GET /session/:sessionId**: View session details.
- **POST /finalize/:sessionId**: Manually trigger GUVI callback.

