// MoodSync — TypeScript Type Definitions
// Shared interfaces for the extension

// --- LLM Anchor Output ---
export interface MoodAnchors {
  genres: string[];       // 2-4 genres
  artists: string[];      // 2-5 real artist names
  mood_keywords: string[]; // 2-4 descriptive words
  era: string | null;     // e.g. "2010s" or null
}

// --- Spotify Track (simplified) ---
export interface SpotifyTrack {
  uri: string;
  name: string;
  artist: string;
  albumName: string;
  albumArtUrl: string;    // 64x64 thumbnail
  durationMs: number;
}

// --- Playlist Result from /mood/generate ---
export interface PlaylistResult {
  moodText: string;
  anchors: MoodAnchors;
  tracks: SpotifyTrack[];
  playlist: {
    id: string;
    url: string;
    trackCount: number;
  };
}

// --- User Profile from /me ---
export interface UserProfile {
  displayName: string;
  spotifyUserId: string;
  product: 'free' | 'premium';
  hasActiveDevice: boolean;
}

// --- API Error ---
export interface ApiError {
  error: string;
  errorType: 'no-premium' | 'no-device' | 'empty-results' | 'rate-limit' | 'generic';
}
