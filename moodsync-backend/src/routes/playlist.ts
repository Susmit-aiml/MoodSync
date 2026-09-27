// MoodSync — Playlist Routes
// POST /playlist/save — Save or recreate a playlist on user's Spotify account

import { Router, Request, Response } from 'express';
import User from '../models/User';
import * as encryption from '../services/encryption';
import * as spotify from '../services/spotify';

const router = Router();

// POST /playlist/save — Save tracks to a new playlist
router.post('/save', async (req: Request, res: Response) => {
  const { trackUris, name, description } = req.body;

  if (!trackUris || !Array.isArray(trackUris) || trackUris.length === 0) {
    return res.status(400).json({ error: 'trackUris array is required and must not be empty' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = encryption.decrypt(user.accessTokenEnc);
    const playlistName = name || `MoodSync Playlist — ${new Date().toLocaleDateString()}`;

    const playlist = await spotify.createPlaylist(
      accessToken,
      user.spotifyUserId,
      playlistName,
      description || 'Created via MoodSync'
    );

    await spotify.addTracksToPlaylist(accessToken, playlist.id, trackUris);

    res.json({
      success: true,
      playlist: {
        id: playlist.id,
        url: playlist.url,
        trackCount: trackUris.length,
      },
    });
  } catch (err: any) {
    console.error('Playlist save error:', err);
    res.status(500).json({
      error: err.message || 'Failed to save playlist to Spotify',
      errorType: 'generic',
    });
  }
});

export default router;
