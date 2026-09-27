// MoodSync — Player Routes
// POST /player/queue-next — Queue a track on active device (Spotify Premium only)

import { Router, Request, Response } from 'express';
import User from '../models/User';
import * as encryption from '../services/encryption';
import * as spotify from '../services/spotify';

const router = Router();

// POST /player/queue-next — Queue a track on user's active Spotify device
router.post('/queue-next', async (req: Request, res: Response) => {
  const { trackUri } = req.body;

  if (!trackUri || typeof trackUri !== 'string') {
    return res.status(400).json({ error: 'trackUri is required' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.product !== 'premium') {
      return res.status(403).json({
        error: 'Queueing tracks directly requires Spotify Premium.',
        errorType: 'no-premium',
      });
    }

    const accessToken = encryption.decrypt(user.accessTokenEnc);

    // Verify active playback device
    const playback = await spotify.getPlaybackState(accessToken);
    if (!playback.isActive) {
      return res.status(404).json({
        error: 'No active Spotify device found. Start playing music on Spotify first, then try queueing again.',
        errorType: 'no-device',
      });
    }

    await spotify.queueTrack(accessToken, trackUri);
    res.json({
      success: true,
      message: 'Track queued to your active Spotify session!',
      deviceName: playback.deviceName,
    });
  } catch (err: any) {
    console.error('Queue track error:', err);
    res.status(500).json({
      error: err.message || 'Failed to queue track to Spotify device',
      errorType: 'generic',
    });
  }
});

export default router;
