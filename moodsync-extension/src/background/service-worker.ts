// MoodSync — Background Service Worker (Manifest V3)
// Coordinates authentication flow, identity management, and session tokens

/// <reference types="chrome" />

const RENDER_BACKEND_URL = 'https://moodsync-e4q2.onrender.com';
const LOCAL_BACKEND_URL = 'http://127.0.0.1:3001';

async function getActiveBackendUrl(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${RENDER_BACKEND_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return RENDER_BACKEND_URL;
  } catch {}

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${LOCAL_BACKEND_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return LOCAL_BACKEND_URL;
  } catch {}

  return RENDER_BACKEND_URL;
}

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'LOGIN':
      handleLogin(message.backendUrl)
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true; // Keep message channel open for async response

    case 'GET_SESSION':
      getSessionToken()
        .then((token) => sendResponse({ token }))
        .catch(() => sendResponse({ token: null }));
      return true;

    case 'LOGOUT':
      handleLogout()
        .then((res) => sendResponse(res))
        .catch(() => sendResponse({ success: false }));
      return true;

    case 'SAVE_SESSION':
      if (message.token) {
        saveSessionToken(message.token)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }
      sendResponse({ success: false, error: 'No token provided' });
      return false;

    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

/**
 * Handle user login via chrome.identity or opening an auth tab
 */
async function handleLogin(providedUrl?: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const backend = providedUrl || await getActiveBackendUrl();
    const authUrl = `${backend}/auth/login`;

    // Check if chrome.identity is available
    if (chrome.identity && chrome.identity.launchWebAuthFlow) {
      try {
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true,
        });

        if (redirectUrl) {
          const urlObj = new URL(redirectUrl);
          const token = urlObj.searchParams.get('token');
          if (token) {
            await saveSessionToken(token);
            return { success: true, token };
          }
        }
      } catch (flowError) {
        console.warn('launchWebAuthFlow did not complete or was closed, falling back to tab:', flowError);
      }
    }

    // Fallback: Open auth tab
    await chrome.tabs.create({ url: authUrl });
    return { success: true, error: 'Tab opened for Spotify authentication' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Login flow failed' };
  }
}

/**
 * Store session token in both session and local storage
 */
async function saveSessionToken(token: string): Promise<void> {
  if (chrome.storage?.session) {
    await chrome.storage.session.set({ sessionToken: token });
  }
  if (chrome.storage?.local) {
    await chrome.storage.local.set({ sessionToken: token });
  }
}

/**
 * Retrieve session token
 */
async function getSessionToken(): Promise<string | null> {
  if (chrome.storage?.session) {
    const res = await chrome.storage.session.get('sessionToken');
    if (res.sessionToken) return res.sessionToken;
  }
  if (chrome.storage?.local) {
    const res = await chrome.storage.local.get('sessionToken');
    if (res.sessionToken) return res.sessionToken;
  }
  return null;
}

/**
 * Clear session and notify backend
 */
async function handleLogout(): Promise<{ success: boolean }> {
  try {
    const backend = await getActiveBackendUrl();
    const token = await getSessionToken();
    if (token) {
      await fetch(`${backend}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {});
    }
  } finally {
    if (chrome.storage?.session) {
      await chrome.storage.session.remove('sessionToken').catch(() => {});
    }
    if (chrome.storage?.local) {
      await chrome.storage.local.remove('sessionToken').catch(() => {});
    }
  }
  return { success: true };
}

// Auto-detect when the Spotify OAuth callback tab finishes loading
if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('/auth/callback') || tab.url.includes('latest-session'))) {
      try {
        const urlObj = new URL(tab.url);
        const urlToken = urlObj.searchParams.get('token') || (urlObj.hash.startsWith('#token=') ? urlObj.hash.slice(7) : null);
        if (urlToken) {
          saveSessionToken(urlToken);
          console.log('✅ Captured session token directly from URL');
          return;
        }
      } catch {}

      getActiveBackendUrl().then((backend) => {
        fetch(`${backend}/auth/latest-session`)
          .then((res) => res.json())
          .then((data) => {
          if (data?.sessionToken) {
            saveSessionToken(data.sessionToken);
            console.log('✅ Background auto-synced session for:', data.user?.displayName);
          }
        })
        .catch(() => {});
      });
    }
  });
}

export {};
