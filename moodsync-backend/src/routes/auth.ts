// MoodSync — Auth Routes
// Complete OAuth 2.0 PKCE flow, Spotify token management, and session handling

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as spotify from '../services/spotify';
import * as encryption from '../services/encryption';
import User from '../models/User';
import Session from '../models/Session';

const router = Router();

// Store PKCE verifiers temporarily in memory (keyed by state)
const pkceStore = new Map<string, { verifier: string; createdAt: number }>();

// Clean up stale PKCE verifiers older than 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of pkceStore.entries()) {
    if (data.createdAt < tenMinutesAgo) {
      pkceStore.delete(state);
    }
  }
}, 60 * 1000);

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-top-read',
].join(' ');

/**
 * GET /auth/login — Initiates Spotify OAuth 2.0 with PKCE
 * If query param json=true, returns { authUrl, state } for Chrome Extension identity flow
 */
router.get('/login', (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  const { verifier, challenge } = generatePkcePair();

  pkceStore.set(state, { verifier, createdAt: Date.now() });

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}/auth/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'SPOTIFY_CLIENT_ID is not configured in backend environment.' });
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  if (req.query.json === 'true') {
    return res.json({ authUrl, state });
  }

  res.redirect(authUrl);
});

/**
 * GET /auth/callback — Receives Spotify auth code, exchanges for tokens, stores user, creates session
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; background: #121212; color: #fff; text-align: center; padding: 50px;">
          <h2>❌ Authorization Cancelled</h2>
          <p>Spotify reported an error: ${String(error)}</p>
          <p>Please close this tab and try logging in again from the MoodSync extension.</p>
        </body>
      </html>
    `);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  const storedPkce = state && typeof state === 'string' ? pkceStore.get(state) : undefined;
  const codeVerifier = storedPkce?.verifier;

  if (state && typeof state === 'string') {
    pkceStore.delete(state);
  }

  try {
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}/auth/callback`;
    const tokenData = await spotify.exchangeCodeForTokens(code, codeVerifier, redirectUri);
    const profile = await spotify.getUserProfile(tokenData.access_token);

    // Encrypt sensitive tokens at rest
    const accessTokenEnc = encryption.encrypt(tokenData.access_token);
    const refreshTokenEnc = encryption.encrypt(tokenData.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Upsert user
    const user = await User.findOneAndUpdate(
      { spotifyUserId: profile.id },
      {
        displayName: profile.displayName,
        product: profile.product,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Create session (24h)
    const session = await (Session as any).createForUser(user._id);
    const sessionToken = session._id.toString();

    // Render success landing page which communicates token back to the extension
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>MoodSync — Connected!</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #0d1117, #161b22, #0a0c10);
            color: #f0f6fc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          .card {
            background: rgba(22, 27, 34, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 40px;
            max-width: 420px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          }
          .badge {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: #1DB954;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 20px;
            box-shadow: 0 0 20px rgba(29, 185, 84, 0.4);
          }
          h2 { margin: 0 0 10px; font-size: 22px; color: #fff; }
          p { color: #8b949e; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
          .token-box {
            background: #0d1117;
            padding: 10px 14px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            color: #58a6ff;
            word-break: break-all;
            margin-bottom: 20px;
            display: none;
          }
          .btn {
            background: #1DB954;
            color: #000;
            font-weight: 600;
            padding: 10px 20px;
            border-radius: 20px;
            text-decoration: none;
            display: inline-block;
            cursor: pointer;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">🎵</div>
          <h2>Connected to Spotify!</h2>
          <p>Welcome back, <strong>${profile.displayName}</strong> (${profile.product.toUpperCase()}). You can now close this tab and return to the MoodSync extension.</p>
          <div id="token-box" class="token-box">${sessionToken}</div>
          <button class="btn" onclick="window.close()">Close Window</button>
        </div>

        <script>
          const token = "${sessionToken}";
          const user = {
            displayName: "${profile.displayName}",
            product: "${profile.product}"
          };

          // Save to localStorage so popup or background can pick it up
          try {
            localStorage.setItem('moodsync_session_token', token);
          } catch(e) {}

          // Post to window opener if popup opened this tab
          if (window.opener) {
            window.opener.postMessage({ type: 'MOODSYNC_AUTH_SUCCESS', token, user }, '*');
            setTimeout(() => window.close(), 1500);
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; background: #121212; color: #fff; text-align: center; padding: 50px;">
          <h2>❌ Authentication Failed</h2>
          <p>${err.message || 'Unknown error occurred during Spotify authorization.'}</p>
        </body>
      </html>
    `);
  }
});

/**
 * POST /auth/refresh — Refresh access token for the logged in user
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const sessionToken = authHeader.slice(7);

  try {
    const session = await Session.findById(sessionToken);
    if (!session) return res.status(401).json({ error: 'Session not found or expired' });

    const user = await User.findById(session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const decryptedRefresh = encryption.decrypt(user.refreshTokenEnc);
    const newTokens = await spotify.refreshAccessToken(decryptedRefresh);

    user.accessTokenEnc = encryption.encrypt(newTokens.access_token);
    user.tokenExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    if (newTokens.refresh_token) {
      user.refreshTokenEnc = encryption.encrypt(newTokens.refresh_token);
    }
    await user.save();

    res.json({ success: true, expiresAt: user.tokenExpiresAt });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to refresh token', details: err.message });
  }
});

/**
 * POST /auth/logout — Invalidate current session
 */
router.post('/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.slice(7);
    await Session.deleteOne({ _id: sessionToken });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /auth/latest-session — Retrieves the most recent active session for extension auto-sync
 */
router.get('/latest-session', async (_req: Request, res: Response) => {
  try {
    const latestSession = await Session.findOne({
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!latestSession) {
      return res.status(404).json({ error: 'No active session found' });
    }

    const user = await User.findById(latestSession.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      sessionToken: latestSession._id.toString(),
      user: {
        displayName: user.displayName,
        product: user.product,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve latest session', details: err.message });
  }
});

export default router;
