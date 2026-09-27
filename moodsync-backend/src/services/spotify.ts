// MoodSync — Spotify API Service
// Complete client for Spotify Web API: search, playlists, player, profile, token exchange

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

export interface SpotifyTrackItem {
  uri: string;
  name: string;
  artist: string;
  albumName: string;
  albumArtUrl: string;
  durationMs: number;
}

export interface SpotifyUserProfile {
  id: string;
  displayName: string;
  email?: string;
  product: 'free' | 'premium';
  images?: Array<{ url: string }>;
}

export interface SpotifyPlaybackState {
  isActive: boolean;
  deviceName?: string;
  isPlaying: boolean;
}

function getBasicAuthHeader(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/**
 * Exchange an authorization code for access and refresh tokens (PKCE + Confidential Client)
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier?: string,
  redirectUri?: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const effectiveRedirect = redirectUri || process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/auth/callback';

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: effectiveRedirect,
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
  });

  if (codeVerifier) {
    bodyParams.append('code_verifier', codeVerifier);
  }

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${getBasicAuthHeader()}`,
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for tokens [${response.status}]: ${errorText}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
  });

  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${getBasicAuthHeader()}`,
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh access token [${response.status}]: ${errorText}`);
  }

  return response.json();
}

/**
 * Get the current user's profile from Spotify
 */
export async function getUserProfile(accessToken: string): Promise<SpotifyUserProfile> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch user profile [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    displayName: data.display_name || data.id,
    email: data.email,
    product: data.product === 'premium' ? 'premium' : 'free',
    images: data.images,
  };
}

/**
 * Search Spotify for tracks matching a structured query
 */
export async function searchTracks(
  accessToken: string,
  query: string,
  limit: number = 20
): Promise<SpotifyTrackItem[]> {
  const url = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${Math.min(limit, 50)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.warn(`Spotify search warning for query "${query}" [${response.status}]`);
    return [];
  }

  const data = await response.json();
  const rawTracks = data.tracks?.items || [];

  return rawTracks.map((t: any): SpotifyTrackItem => {
    const albumArt = t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || '';
    const artistName = t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

    return {
      uri: t.uri,
      name: t.name,
      artist: artistName,
      albumName: t.album?.name || '',
      albumArtUrl: albumArt,
      durationMs: t.duration_ms || 0,
    };
  });
}

/**
 * Get user's top tracks
 */
export async function getTopTracks(accessToken: string, limit: number = 20): Promise<string[]> {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/top/tracks?limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || []).map((t: any) => t.uri);
  } catch {
    return [];
  }
}

/**
 * Get user's top artists
 */
export async function getTopArtists(accessToken: string, limit: number = 5): Promise<string[]> {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/top/artists?limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || []).map((a: any) => a.name);
  } catch {
    return [];
  }
}

/**
 * Create a new playlist on user's Spotify account
 */
export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description?: string
): Promise<{ id: string; url: string }> {
  // Modern Spotify endpoint: POST /v1/me/playlists
  let response = await fetch(`${SPOTIFY_API_BASE}/me/playlists`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description: description || 'Generated by MoodSync Chrome Extension',
      public: false,
    }),
  });

  // Fallback to legacy endpoint if /me/playlists is unavailable
  if (!response.ok && userId) {
    response = await fetch(`${SPOTIFY_API_BASE}/users/${encodeURIComponent(userId)}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description || 'Generated by MoodSync Chrome Extension',
        public: false,
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create playlist [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    url: data.external_urls?.spotify || `https://open.spotify.com/playlist/${data.id}`,
  };
}

/**
 * Add tracks to an existing playlist in chunks of up to 100
 */
export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  if (trackUris.length === 0) return;

  // Spotify max is 100 tracks per request
  const chunkSize = 100;
  for (let i = 0; i < trackUris.length; i += chunkSize) {
    const chunk = trackUris.slice(i, i + chunkSize);
    // Modern Spotify endpoint: POST /v1/playlists/{id}/items
    let response = await fetch(`${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: chunk }),
    });

    // Fallback to legacy /tracks endpoint if needed
    if (!response.ok) {
      response = await fetch(`${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: chunk }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add tracks to playlist [${response.status}]: ${errorText}`);
    }
  }
}

/**
 * Get current playback state (check active device and premium status)
 */
export async function getPlaybackState(accessToken: string): Promise<SpotifyPlaybackState> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 204 || response.status === 404) {
    return { isActive: false, isPlaying: false };
  }

  if (!response.ok) {
    return { isActive: false, isPlaying: false };
  }

  const data = await response.json();
  return {
    isActive: Boolean(data?.device?.is_active),
    deviceName: data?.device?.name,
    isPlaying: Boolean(data?.is_playing),
  };
}

/**
 * Queue a track on user's active device (Spotify Premium only)
 */
export async function queueTrack(accessToken: string, trackUri: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to queue track [${response.status}]: ${errorText}`);
  }
}
