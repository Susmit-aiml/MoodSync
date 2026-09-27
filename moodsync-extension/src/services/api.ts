// MoodSync — API Service
// HTTP client for all extension ↔ backend communication

export const RENDER_URL = 'https://moodsync-oiq2.onrender.com';
export const LOCAL_URL = 'http://127.0.0.1:3001';
export const BACKEND_URL = RENDER_URL;

let activeBackend: string | null = null;
let lastCheckTime = 0;

export async function getBackendUrl(): Promise<string> {
  const now = Date.now();
  if (activeBackend && now - lastCheckTime < 20000) {
    return activeBackend;
  }

  // 1. If Render is alive and serving healthy responses, use Render
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${RENDER_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      activeBackend = RENDER_URL;
      lastCheckTime = now;
      return RENDER_URL;
    }
  } catch {}

  // 2. Fall back to local server
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${LOCAL_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      activeBackend = LOCAL_URL;
      lastCheckTime = now;
      return LOCAL_URL;
    }
  } catch {}

  activeBackend = LOCAL_URL;
  lastCheckTime = now;
  return LOCAL_URL;
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

  // Auto-sync with backend if an active session exists (check local then Render)
  try {
    const endpoints = [
      `${LOCAL_URL}/auth/latest-session`,
      'http://localhost:3001/auth/latest-session',
      `${RENDER_URL}/auth/latest-session`,
    ];
    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(ep, { signal: controller.signal });
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
  } catch {}

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
