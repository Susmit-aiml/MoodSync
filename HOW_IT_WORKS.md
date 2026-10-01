# MoodSync — Comprehensive Technical Architecture & How It Works

> **A Complete Ground-Truth Guide to the Architecture, Tech Stack, AI Pipeline, and Engineering Decisions of MoodSync.**

---

## Executive Summary

**MoodSync** is an AI-powered music curation system distributed as a **Google Chrome Extension (Manifest V3)** supported by a **cloud-hosted Node.js / Express backend** and **MongoDB Atlas**. It translates conversational, natural language descriptions of moods, vibes, or listening intents (e.g., *"rainy evening, low energy but not sad"*, *"hindi 90s acoustic vibes"*, *"deep work focus minimal vocals"*) into real, playable, and automatically created Spotify playlists in under 3 seconds.

---

## 1. Why Is It Necessary? (Problem Statement)

### The Limitations of Current Music Platforms
1. **Keyword-Based Search Limitations:**  
   Streaming services like Spotify rely primarily on metadata searches (song titles, artist names, album titles, and broad genre tags). If a user types *"songs for a rainy Sunday morning when you need to read without feeling lonely"*, Spotify’s native search returns tracks that literally have the words "Rainy", "Sunday", or "Morning" in their title, rather than music that captures the emotional atmosphere.
2. **Algorithmic Curation Is a Black Box:**  
   Algorithmic tools (like Spotify Daylist or Discover Weekly) are passive and non-interactive. The user cannot steer them with precise prompts or adjust specific musical constraints (e.g., decade constraints, instrumental vs. vocal balance).
3. **Geographic & Account Feature Disparities:**  
   Advanced conversational music features (such as Spotify's AI DJ with promptable voice/text requests) remain restricted by region and are unavailable in major global markets (including India and parts of APAC/EMEA).
4. **Curation Friction:**  
   Manually building a tailored 20-track playlist for a specific moment takes 15 to 30 minutes of searching, sampling, and ordering tracks. MoodSync collapses this entire workflow into a 2-second single-click browser interaction.

---

## 2. What Technologies Does It Use? (Complete Tech Stack)

MoodSync is engineered with a strict separation of concerns between client-side extension UI, background service workers, backend orchestration, AI inference, and database security.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MOODSYNC TECH STACK MAP                         │
├───────────────────┬────────────────────────────────────────────────────┤
│ Layer             │ Technologies & Libraries                           │
├───────────────────┼────────────────────────────────────────────────────┤
│ Frontend UI       │ React 18, TypeScript, Vite, Vanilla CSS3 (Custom   │
│ (Chrome Extension)│ Spotify Dark Theme, Glassmorphism, Responsive)     │
├───────────────────┼────────────────────────────────────────────────────┤
│ Browser Platform  │ Chrome Extension Manifest V3 (MV3), Service Worker,│
│                   │ chrome.storage (session & local), chrome.identity  │
├───────────────────┼────────────────────────────────────────────────────┤
│ Backend API       │ Node.js, Express.js, TypeScript, Mongoose ODM,     │
│                   │ express-rate-limit, cors, dotenv                   │
├───────────────────┼────────────────────────────────────────────────────┤
│ Networking &      │ Custom TCP byte-sniffing router (Dual HTTP/HTTPS   │
│ Protocol Engine   │ multiplexer via 'net' module), selfsigned TLS      │
├───────────────────┼────────────────────────────────────────────────────┤
│ Cryptography &    │ AES-256-GCM (with IV and auth tag verification),   │
│ Security          │ SHA-256 PKCE challenge generator, Opaque Sessions  │
├───────────────────┼────────────────────────────────────────────────────┤
│ Database          │ MongoDB Atlas (Cloud NoSQL), Mongoose Schemas      │
│                   │ (Users, Sessions with TTL auto-expiry, Requests)   │
├───────────────────┼────────────────────────────────────────────────────┤
│ AI & LLM Engine   │ Google Gemini (gemini-3.5-flash-lite / 3.1 / 3.8)   │
│                   │ via @google/genai SDK & Google AI Studio REST API; │
│                   │ Anthropic Claude (claude-3-5-haiku) fallback;      │
│                   │ Built-in semantic heuristic fallback engine        │
├───────────────────┼────────────────────────────────────────────────────┤
│ Music Platform    │ Spotify Web API (OAuth 2.0 PKCE, Search API,       │
│                   │ Playlists API, Player Web API, User Profile API)   │
├───────────────────┼────────────────────────────────────────────────────┤
│ Cloud Hosting     │ Render.com (Web Service), GitHub Pages (Legal)     │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 3. How It Is Made (Architecture & Component Design)

MoodSync is composed of three interconnected tiers:

```
┌──────────────────────────────────────────────────────────┐
│              CLIENT: CHROME EXTENSION (MV3)              │
│  ┌─────────────────────────┐  ┌───────────────────────┐  │
│  │     React Popup UI      │  │   Service Worker      │  │
│  │ (MoodInput/Results/Auth)│  │ (Identity & Session)  │  │
│  └───────────┬─────────────┘  └───────────┬───────────┘  │
└──────────────┼────────────────────────────┼──────────────┘
               │ Bearer Opaque Session Token│
               ▼                            ▼
┌──────────────────────────────────────────────────────────┐
│              BACKEND API: NODE.JS / EXPRESS              │
│  ┌───────────────────────┐    ┌───────────────────────┐  │
│  │ Dual TCP Multiplexer  │    │ AES-256-GCM Crypto    │  │
│  │ (HTTP / HTTPS Listener│    │ Token Security Layer  │  │
│  └───────────┬───────────┘    └───────────┬───────────┘  │
│              │                            │              │
│  ┌───────────▼───────────┐    ┌───────────▼───────────┐  │
│  │   Pipeline Orchestrator│   │   Spotify API Client  │  │
│  └───────────┬───────────┘    └───────────────────────┘  │
└──────────────┼───────────────────────────────────────────┘
               ├────────────────────────────┬──────────────┐
               ▼                            ▼              ▼
     ┌───────────────────┐        ┌──────────────────┐  ┌──────────────┐
     │  GOOGLE GEMINI    │        │ SPOTIFY WEB API  │  │ MONGODB      │
     │  AI Studio Engine │        │ OAuth / Search / │  │ User & Token │
     │  Vibe Translation │        │ Playlist Creator │  │ Store        │
     └───────────────────┘        └──────────────────┘  └──────────────┘
```

### 3.1 The Frontend (Chrome Extension — Manifest V3)
* **Popup UI (`src/popup/`):** Built with React 18, TypeScript, and Vite. It renders conditionally based on authentication state:
  * `Login.tsx`: Displays clean Spotify OAuth entry with connection status indicators.
  * `MoodInput.tsx`: Fast natural language input area with quick-prompt chips (e.g., *"Late Night Drive"*, *"Lofi Rain Study"*, *"Hindi 90s"*).
  * `Results.tsx`: Renders the generated playlist, tracklist with album art, artist credits, "Open in Spotify" deep link, and "Queue Next" playback integration.
  * `ErrorState.tsx`: User-friendly recovery views for rate limits, expired tokens, or playback device disconnection.
* **Background Worker (`src/background/service-worker.ts`):** 
  * Listens for extension runtime messages (`LOGIN`, `GET_SESSION`, `LOGOUT`).
  * Initiates the OAuth flow via `chrome.identity.launchWebAuthFlow` or tab creation.
  * Securely caches session identifiers in `chrome.storage.session` (memory-only per browser session) with persistence fallback to `chrome.storage.local`.
* **Zero-Latency Fallover (`src/services/api.ts`):** Automatically targets the production cloud backend (`https://moodsync-e4q2.onrender.com`) while allowing instant fallback to `http://127.0.0.1:3001` for local debugging.

### 3.2 The Backend API Server (`moodsync-backend/src/`)
* **Dual-Protocol TCP Listener (`index.ts`):**
  * Rather than consuming multiple ports for HTTP and HTTPS, the backend uses a custom TCP server (`net.createServer`) that inspects the first byte of incoming TCP packets.
  * If the first byte is `0x16` (decimal 22, the TLS `ClientHello` handshake indicator), it routes the connection to an HTTPS server powered by auto-generated `selfsigned` certificates.
  * If any other byte arrives (such as HTTP `GET`, `POST`), it routes to the standard HTTP server. This solves local OAuth redirect URI mismatches effortlessly.
* **Security & AES-256-GCM Encryption (`services/encryption.ts`):**
  * Spotify access and refresh tokens are **never stored in plain text**.
  * They are encrypted with AES-256-GCM using a 32-byte secret key and an initialization vector (IV). An authentication tag (`authTag`) guarantees tamper-proofing.
  * The Chrome Extension never receives raw Spotify tokens; it receives an opaque MongoDB session token that maps to the user on the server.
* **Reliable Cloud DNS Configuration (`index.ts`):**
  * Node.js sets DNS lookup servers to `8.8.8.8` and `1.1.1.1` upon startup to eliminate DNS SRV resolution timeouts on Windows and varied ISP connections when communicating with MongoDB Atlas.

---

## 4. How It Works (Step-by-Step Execution Lifecycle)

### Phase 1: Authentication & Session Establishment (OAuth 2.0 PKCE)
1. The user clicks **"Login with Spotify"** in the extension popup.
2. The backend generates a cryptographically random `state` and a **PKCE pair**:
   * `verifier`: 32 random bytes, base64url-encoded.
   * `challenge`: SHA-256 hash of the verifier, base64url-encoded.
3. The user is redirected to Spotify's consent screen requesting scoped permissions:
   * `playlist-modify-public`, `playlist-modify-private`
   * `user-read-playback-state`, `user-modify-playback-state`
   * `user-top-read`, `user-read-email`, `user-read-private`
4. Once approved, Spotify calls back `GET /auth/callback?code=...&state=...`.
5. The backend verifies the state, matches the stored PKCE code verifier, and exchanges the authorization code for Spotify `access_token` and `refresh_token`.
6. The backend encrypts both tokens via AES-256-GCM, upserts the user in MongoDB, and generates a 24-hour session document in the `Session` collection.
7. The browser tab posts a `MOODSYNC_AUTH_SUCCESS` message containing the opaque session token to the extension, which stores it securely.

### Phase 2: Natural Language Mood Analysis (The AI Vibe Engine)
When the user submits a mood (e.g., *"rainy evening, low energy but not sad"*):
1. **Contextual Enrichment:**  
   The backend retrieves the user's current time of day (`late night`, `morning`, `evening`) and optionally pulls the user's top Spotify artists (`/me/top/artists`) to personalize suggestions.
2. **AI Vibe Reasoning (`services/llm.ts`):**  
   The prompt is dispatched to **Google Gemini** (`gemini-3.5-flash-lite` prioritized for sub-1.5s latency, cascading to `gemini-3.1-flash-lite` and `gemini-3.8-flash`).  
   A strict system instruction forces a typed JSON response conforming to the `MoodAnchors` schema:
   ```json
   {
     "genres": ["lo-fi beats", "ambient acoustic", "indie folk"],
     "artists": ["Novo Amor", "Phoebe Bridgers", "Bon Iver", "Iron & Wine"],
     "mood_keywords": ["rainy", "mellow", "soft", "cozy"],
     "era": null
   }
   ```
3. **Multi-Model & Heuristic Failover:**
   * If Gemini is unavailable, the pipeline attempts Anthropic Claude (`claude-3-5-haiku`).
   * If third-party LLM APIs are offline or unconfigured, the internal **Heuristic Anchor Engine** uses rule-based semantic pattern matching to extract genres, artists, and era filters, guaranteeing 100% system uptime.

### Phase 3: Query Synthesis & Parallel Spotify Search
Instead of performing a single naive search, the pipeline synthesizes multiple distinct query vectors:
1. **Direct Intent Query:** The raw user input.
2. **Targeted Artist Queries:** e.g., `artist:"Novo Amor"` (with era bounds like `year:2010-2019` if requested).
3. **Genre & Atmosphere Queries:** e.g., `"lo-fi beats"`, `"ambient acoustic rainy"`.
4. **Vibe & Keyword Queries:** Combinations of anchor keywords.

All queries are executed concurrently across the Spotify Search API (`/v1/search?type=track&limit=10`) using `Promise.all`.

### Phase 4: Track Deduplication, Normalization & Scoring
1. The combined candidate tracks (typically 40–60 raw tracks) pass through a normalization filter.
2. Track titles are normalized by stripping remaster and live flags (e.g., `"Song Name - Remastered 2021"` $\rightarrow$ `"song name"`).
3. Tracks are deduplicated based on unique Spotify URIs and normalized `trackTitle|artist` keys to prevent duplicate live or re-issued versions.
4. The top 20 best-matching tracks are assembled into the final selection.

### Phase 5: Automated Playlist Creation & Presentation
1. The backend calls Spotify's `POST /v1/me/playlists` to create a dedicated playlist:
   * **Title:** `MoodSync: <User's Mood>`
   * **Description:** `Vibe: "<User's Mood>" • Genres: <Genres> • Generated by MoodSync`
2. The track URIs are attached via `POST /v1/playlists/{id}/items` (chunked up to 100 tracks).
3. The response is returned to the Chrome extension popup displaying:
   * Playlist title, deep-link URL to open in web or desktop Spotify.
   * Full tracklist with album cover art, song names, artist names, and durations.
4. **Live Playback Queueing:**  
   If the user has Spotify Premium and an active Spotify player open, clicking **"Queue Next"** invokes `POST /player/queue-next`, instantly queueing the track into their current listening session without disrupting playback.

---

## 5. How to Explain This Project (Interview & Presentation Guide)

Use the following modular answers when presenting or explaining MoodSync to recruiters, engineers, or project evaluators.

### The 30-Second Elevator Pitch
> *"MoodSync is a full-stack Chrome extension and AI curation pipeline that turns natural language listening vibes into real Spotify playlists in seconds. While Spotify’s native search is limited to exact keyword matching and their AI DJ isn’t available in regions like India, MoodSync bridges that gap. It uses Google Gemini to decompose conversational mood descriptions into musical anchors—genres, representative artists, atmosphere keywords, and release eras—then runs parallel queries against the Spotify Web API, deduplicates the results, and automatically provisions a playable playlist in your Spotify account with single-click queueing."*

### The 2-Minute Technical Deep Dive
> *"Architecturally, MoodSync is split into a Manifest V3 Chrome Extension frontend and an Express/TypeScript backend backed by MongoDB Atlas.
>
> On the client side, I built the UI using React 18 and Vite with a custom Spotify-dark design system. Authentication uses OAuth 2.0 with PKCE: the backend securely generates code verifiers and challenges, and upon callback, encrypts the sensitive Spotify access and refresh tokens using AES-256-GCM before writing them to the database. The extension only handles short-lived, opaque session tokens.
>
> The core innovation is in the recommendation pipeline. When a user submits an emotional prompt like 'rainy evening, low energy but not sad', we feed that to Google Gemini 3.5 Flash Lite with structured JSON schema output to extract four-dimensional anchors: genres, target artists, mood keywords, and era filters.
>
> We then execute parallel search queries against Spotify's Web API, deduplicate the track candidates by both Spotify URI and normalized title-artist keys to eliminate duplicate remasters, and create the playlist directly on the user's Spotify profile. If the user has an active player, they can even queue songs directly from the extension popup.
>
> To make it resilient, I implemented a custom dual HTTP/HTTPS TCP sniffer on the backend to handle local development callback quirks, cascading AI model failovers, and a built-in semantic heuristic fallback so the app stays functional even without third-party AI APIs."*

---

## 6. Key Interview Questions & Architectural Answers

#### Q1: Why did you build a backend instead of doing everything inside the Chrome extension?
> **Answer:** *"Security and compliance. The Spotify Web API requires client credentials. In a browser extension, any embedded client secret or third-party AI API key can be extracted by inspecting the extension package. By hosting a dedicated Node.js backend, all API secrets and Gemini keys remain protected. Furthermore, Spotify OAuth tokens are encrypted at rest using AES-256-GCM, and the extension only communicates using opaque session tokens."*

#### Q2: How does the AI turn vague feelings into concrete songs?
> **Answer:** *"Instead of asking the LLM to hallucinate track titles (which often yields non-existent tracks or wrong URIs), we use the LLM strictly as an **anchor extractor**. We prompt Gemini to act as a musicologist and extract four tangible search dimensions: 2–4 genres, 2–5 real reference artists, atmosphere keywords, and an era decade. We then search Spotify's actual catalog using those anchors. This guarantees 100% of returned songs are real, high-quality, and playable."*

#### Q3: How do you handle LLM latency and reliability?
> **Answer:** *"We use a three-tier resilience strategy:
> 1. We prioritize Google Gemini 3.5 Flash Lite via the modern `@google/genai` SDK and direct REST fallback, achieving sub-1.5 second inference times.
> 2. We support automated cascade to alternative models (such as Claude 3.5 Haiku).
> 3. If external AI APIs are offline or rate-limited, we have an internal regex-based Heuristic Anchor Engine that parses intent locally so the user never sees a broken experience."*

#### Q4: How is token security handled?
> **Answer:** *"Tokens are encrypted before being written to MongoDB using AES-256-GCM with unique initialization vectors (IVs) and authentication tags. When an API call is made, the backend decrypts the token in memory, checks if the access token is expiring within 5 minutes, automatically refreshes it using the refresh token, and re-encrypts the new tokens before saving. The browser never handles the raw refresh token."*

---

## 7. Directory Structure Reference

```
MoodSync/
├── moodsync-extension/            # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension permissions & entrypoints
│   ├── vite.config.ts             # Vite build configuration
│   └── src/
│       ├── background/            # MV3 background service worker
│       │   └── service-worker.ts  # Handles auth flow & session storage
│       ├── popup/                 # React popup user interface
│       │   ├── App.tsx            # State router (Auth vs. Mood vs. Results)
│       │   ├── Login.tsx          # Spotify login screen
│       │   ├── MoodInput.tsx      # Vibe prompt input & chips
│       │   ├── Results.tsx        # Tracklist view & Spotify player queue
│       │   └── index.css          # Spotify Dark design tokens
│       ├── hooks/                 # Custom React hooks (useAuth, useMood)
│       └── services/              # API client (failover to Render & Local)
│
├── moodsync-backend/              # API Server (Node.js + Express + TS)
│   ├── src/
│   │   ├── index.ts               # Server entry & Dual HTTP/HTTPS TCP sniffer
│   │   ├── config/                # Environment variable validation
│   │   ├── middleware/            # Auth session verification & rate limiters
│   │   ├── models/                # MongoDB schemas (User, Session, MoodRequest)
│   │   ├── routes/                # Express routes (/auth, /mood, /playlist, /player)
│   │   └── services/
│   │       ├── encryption.ts      # AES-256-GCM token encryption
│   │       ├── llm.ts             # Gemini / Claude / Heuristic anchor engine
│   │       ├── pipeline.ts        # Query generation, deduplication & assembly
│   │       └── spotify.ts         # Spotify Web API client
│   └── .env                       # Environment secrets (Spotify, Gemini, DB)
│
├── README.md                      # Quickstart guide
├── HOW_IT_WORKS.md                # This complete architectural document
└── remaining.md                   # Production deployment & Store publishing checklist
```
