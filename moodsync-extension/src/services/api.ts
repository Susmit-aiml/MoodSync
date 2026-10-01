// MoodSync — API Service
// HTTP client for all extension ↔ backend communication

export const RENDER_URL = 'https://moodsync-e4q2.onrender.com';
export const LOCAL_URL = 'http://127.0.0.1:3001';
export const BACKEND_URL = RENDER_URL;

let activeBackend: string = RENDER_URL;

/**
 * Returns the active backend URL immediately with zero artificial buffering.
 * Defaults to the production Render backend.
 */
export async function getBackendUrl(): Promise<string> {
  return activeBackend || RENDER_URL;
}

export function setBackendUrl(url: string): void {
  activeBackend = url;
}

export async function getSessionToken(): Promise<string | null> {
  // Check chrome.storage.session first
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      const res = await chrome.storage.session.get('sessionToken');
      if (res.sessionToken) return res.sessionToken;
    } catch {}
  }

  // Fallback to chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const res = await chrome.storage.local.get('sessionToken');
      if (res.sessionToken) return res.sessionToken;
    } catch {}
  }

  // Fallback to localStorage (for preview or web debug)
  try {
    const local = localStorage.getItem('moodsync_session_token');
    if (local) return local;
  } catch {}

  // Auto-sync with backend if an active session exists
  const endpoints = Array.from(new Set([activeBackend, RENDER_URL, LOCAL_URL].filter(Boolean)));

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${endpoint}/auth/latest-session`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.sessionToken) {
          await setSessionToken(data.sessionToken);
          return data.sessionToken;
        }
      }
    } catch {}
  }

  return null;
}

export async function setSessionToken(token: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      await chrome.storage.session.set({ sessionToken: token });
    } catch {}
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ sessionToken: token });
    } catch {}
  }
  try {
    localStorage.setItem('moodsync_session_token', token);
  } catch {}
}

export async function clearSessionToken(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      await chrome.storage.session.remove('sessionToken');
    } catch {}
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.remove('sessionToken');
    } catch {}
  }
  try {
    localStorage.removeItem('moodsync_session_token');
  } catch {}
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * GET /me — fetch user profile + Premium status
 */
export async function fetchProfile() {
  const backend = await getBackendUrl();
  const headers = await authHeaders();
  const res = await fetch(`${backend}/me`, { headers });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `Profile fetch failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * POST /mood/generate — run the mood-to-playlist pipeline
 */
export async function generatePlaylist(moodText: string) {
  const backend = await getBackendUrl();
  const headers = await authHeaders();
  const res = await fetch(`${backend}/mood/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ moodText }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const err = new Error(errorJson.error || `Playlist generation failed with status ${res.status}`);
    (err as any).errorType = errorJson.errorType || 'generic';
    throw err;
  }
  return res.json();
}

/**
 * POST /playlist/save — persist a generated playlist
 */
export async function savePlaylist(trackUris: string[], name?: string) {
  const backend = await getBackendUrl();
  const headers = await authHeaders();
  const res = await fetch(`${backend}/playlist/save`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ trackUris, name }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `Playlist save failed: ${res.status}`);
  }
  return res.json();
}

/**
 * POST /player/queue-next — queue a track (Premium only)
 */
export async function queueNext(trackUri: string) {
  const backend = await getBackendUrl();
  const headers = await authHeaders();
  const res = await fetch(`${backend}/player/queue-next`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ trackUri }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const err = new Error(errorJson.error || `Queue failed: ${res.status}`);
    (err as any).errorType = errorJson.errorType || 'generic';
    throw err;
  }
  return res.json();
}
