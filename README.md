# MoodSync — AI Spotify Playlist Chrome Extension 🎵

> Turn your mood or vibe into a custom, playable Spotify playlist in seconds. A Manifest V3 Chrome Extension powered by Google Gemini AI and the Spotify Web API.

---

## 🌟 Key Features

- **Natural Language Vibe Understanding:** Type anything like *"rainy evening, low energy but not sad"* or *"hindi 90s songs"*.
- **Google Gemini 3.5 Flash AI:** Extracts rich musical anchors (artists, genres, atmospheric keywords, decade).
- **Direct Spotify Playlist Creation:** Automatically creates a playlist in your Spotify account and populates it with matching songs.
- **Smart Fallback Engine:** Built-in keyword heuristic engine ensures 100% uptime even if LLM APIs are offline.
- **Secure Token Encryption:** AES-256-GCM token encryption at rest on the backend; the browser extension uses short-lived opaque session tokens.
- **Single-Click Play & Queue:** Play songs directly on Spotify or queue them up to your active Spotify player.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│     CHROME EXTENSION (MV3)      │
│  React 18 + TypeScript + Vite   │
│  Popup UI + Background Worker   │
└────────────────┬────────────────┘
                 │ Session Token (Bearer)
                 ▼
┌─────────────────────────────────┐
│      MOODSYNC BACKEND API       │
│     Node.js + Express + TS      │
│    Sessions, AES-256-GCM, DB    │
└────────┬───────────────┬────────┘
         │               │
         ▼               ▼
┌────────────────┐  ┌────────────────┐
│ SPOTIFY WEB API│  │ GOOGLE GEMINI  │
│ OAuth, Search, │  │ 3.5 Flash AI   │
│ Playlists      │  │ Vibe Reasoning │
└────────────────┘  └────────────────┘
```

---

## 📁 Project Structure

```
MoodSync/
├── moodsync-extension/        # Chrome Extension (React + Vite + TypeScript)
│   ├── public/icons/          # 16x16, 48x48, 128x128 extension icons
│   ├── src/
│   │   ├── popup/             # React popup UI (Login, MoodInput, Results, ErrorState)
│   │   ├── background/        # MV3 service worker
│   │   └── services/          # Backend API client
│   └── dist/                  # Production extension build
│
├── moodsync-backend/          # Node.js / Express / TypeScript API server
│   ├── src/
│   │   ├── routes/            # /auth, /mood, /playlist, /player
│   │   ├── services/          # Spotify API, Gemini LLM, Pipeline, Encryption
│   │   └── models/            # User, Session, MoodRequest schemas (Mongoose)
│   └── .env.example           # Template for required environment variables
│
└── README.md
```

---

## 🚀 Local Development Setup

### 1. Backend Setup

```bash
cd moodsync-backend
npm install
cp .env.example .env
```

Configure `.env`:
```env
PORT=3001
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/auth/callback
GEMINI_API_KEY=your_gemini_api_key
SESSION_SECRET=your_random_session_secret_string
TOKEN_ENCRYPTION_KEY=32_character_encryption_key_here
DATABASE_URL=mongodb+srv://...
```

Start the backend:
```bash
npm run dev
# Running on http://127.0.0.1:3001
```

### 2. Extension Setup

```bash
cd moodsync-extension
npm install
npm run build
```

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top-right).
3. Click **Load unpacked** and select `moodsync-extension/dist`.
4. Click the MoodSync icon in your Chrome toolbar!

---

## ☁️ Easy Cloud Deployment (Render / Railway)

You can host the backend on [Render.com](https://render.com) or [Railway.app](https://railway.app) in 3 minutes:

1. **Connect Repo:** Link this GitHub repository to Render / Railway as a **Web Service**.
2. **Build & Start Commands:**
   - **Root Directory:** `moodsync-backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. **Environment Variables:**
   Add these in the dashboard:
   - `PORT`: `3001` (or default assigned by host)
   - `SPOTIFY_CLIENT_ID`: Your Spotify Client ID
   - `SPOTIFY_CLIENT_SECRET`: Your Spotify Client Secret
   - `SPOTIFY_REDIRECT_URI`: `https://<YOUR-RENDER-APP>.onrender.com/auth/callback`
   - `DATABASE_URL`: Your MongoDB Atlas URI
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `SESSION_SECRET`: Any random 64-char string
   - `TOKEN_ENCRYPTION_KEY`: Any 32-char string
4. **Spotify Developer Dashboard:**
   In [developer.spotify.com](https://developer.spotify.com/dashboard) $\rightarrow$ Your App $\rightarrow$ Settings $\rightarrow$ Redirect URIs:
   Add: `https://<YOUR-RENDER-APP>.onrender.com/auth/callback`

---

## 🔒 Security & Privacy

- Client credentials and API keys are never bundled inside extension code.
- All Spotify tokens are encrypted using **AES-256-GCM** before database storage.
- Chrome Extension communicates solely via short-lived opaque session tokens.
- Fully compliant with Manifest V3 and Chrome Web Store policies.

---

## 📄 License
MIT License. Created by [Susmit](https://github.com/Susmit-aiml).
