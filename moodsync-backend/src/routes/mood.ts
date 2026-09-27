// MoodSync — Mood Routes
// POST /mood/generate, GET /mood/history, POST /mood/refine

import { Router, Request, Response } from 'express';
import User from '../models/User';
import MoodRequest from '../models/MoodRequest';
import * as encryption from '../services/encryption';
import * as spotify from '../services/spotify';
import { runPipeline } from '../services/pipeline';
import { moodGenerationLimiter } from '../middleware/rateLimit';

const router = Router();

// Helper to ensure user has a fresh, valid access token
async function getValidAccessToken(user: InstanceType<typeof User>): Promise<string> {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  // If token is expiring within 5 minutes, refresh it automatically
  if (user.tokenExpiresAt <= fiveMinutesFromNow) {
    try {
      const decryptedRefresh = encryption.decrypt(user.refreshTokenEnc);
      const newTokens = await spotify.refreshAccessToken(decryptedRefresh);

      user.accessTokenEnc = encryption.encrypt(newTokens.access_token);
      user.tokenExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      if (newTokens.refresh_token) {
        user.refreshTokenEnc = encryption.encrypt(newTokens.refresh_token);
      }
      await user.save();
      return newTokens.access_token;
    } catch (err) {
      console.warn('⚠️ Token refresh failed, attempting to use current token:', err);
    }
  }

  return encryption.decrypt(user.accessTokenEnc);
}

// POST /mood/generate — Run the full mood-to-playlist pipeline
router.post('/generate', moodGenerationLimiter, async (req: Request, res: Response) => {
  const { moodText } = req.body;

  if (!moodText || typeof moodText !== 'string' || moodText.trim().length === 0) {
    return res.status(400).json({ error: 'moodText is required and must not be empty' });
  }

  const trimmedMood = moodText.trim();

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found. Please log in again.' });
    }

    const accessToken = await getValidAccessToken(user);

    // Run the full AI + Spotify pipeline
    const result = await runPipeline(accessToken, user.spotifyUserId, trimmedMood);

    // Save request to MoodRequest collection for caching and analytics
    try {
      await MoodRequest.create({
        userId: user._id,
        moodText: trimmedMood,
        parsedAnchors: result.anchors,
        trackUris: result.tracks.map((t) => t.uri),
      });
    } catch (e) {
      console.warn('Failed to record mood request log:', e);
    }

    res.json(result);
  } catch (err: any) {
    console.error('Mood generation error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate playlist for your mood',
      errorType: 'generic',
    });
  }
});

// GET /mood/history — Fetch user's recent mood requests
router.get('/history', async (req: Request, res: Response) => {
  try {
    const history = await MoodRequest.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('moodText parsedAnchors trackUris createdAt');

    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve mood history', details: err.message });
  }
});

// POST /mood/refine — Conversational adjustment (Phase 5 stretch goal)
router.post('/refine', moodGenerationLimiter, async (req: Request, res: Response) => {
  const { previousMoodText, feedback } = req.body;

  if (!previousMoodText || !feedback) {
    return res.status(400).json({ error: 'previousMoodText and feedback are both required' });
  }

  const refinedMood = `${previousMoodText}, adjusted for: ${feedback}`;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = await getValidAccessToken(user);
    const result = await runPipeline(accessToken, user.spotifyUserId, refinedMood);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Refinement failed' });
  }
});

export default router;
