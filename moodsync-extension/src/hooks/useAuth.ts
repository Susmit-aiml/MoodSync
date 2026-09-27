// MoodSync — useAuth Hook
// Manages authentication state, Spotify OAuth lifecycle, and session sync

import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types/index';
import { fetchProfile, clearSessionToken, setSessionToken, getSessionToken } from '../services/api';

const BACKEND_URL = 'http://localhost:3001';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const token = await getSessionToken();
      if (!token) {
        setUser(null);
        return;
      }
      const profile = await fetchProfile();
      setUser(profile);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check session on mount and poll/listen on window focus
  useEffect(() => {
    checkSession();

    // Listen for postMessage from auth success page
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MOODSYNC_AUTH_SUCCESS' && event.data?.token) {
        setSessionToken(event.data.token).then(() => {
          checkSession();
          setIsLoggingIn(false);
        });
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', checkSession);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', checkSession);
    };
  }, [checkSession]);

  const login = useCallback(async () => {
    setIsLoggingIn(true);
    setError(null);

    // Try through Chrome extension service worker
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'LOGIN' });
        if (response?.success && response.token) {
          await setSessionToken(response.token);
          await checkSession();
          setIsLoggingIn(false);
          return;
        }
      } catch (e) {
        console.warn('Background worker login message failed, falling back to direct tab:', e);
      }
    }

    // Direct browser tab fallback (works everywhere, including unpacked & local preview)
    const loginUrl = `${BACKEND_URL}/auth/login`;
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: loginUrl });
    } else {
      window.open(loginUrl, '_blank');
    }

    // Poll for session token for up to 60 seconds
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const token = await getSessionToken();
      if (token) {
        clearInterval(interval);
        await checkSession();
        setIsLoggingIn(false);
      } else if (attempts > 30) {
        clearInterval(interval);
        setIsLoggingIn(false);
      }
    }, 2000);
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: 'LOGOUT' }).catch(() => {});
      }
    } finally {
      await clearSessionToken();
      setUser(null);
    }
  }, []);

  return { user, isLoading, isLoggingIn, error, login, logout, checkSession };
}
