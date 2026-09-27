// MoodSync — Rate Limiting Middleware
// In-memory sliding window rate limiter to protect Spotify & LLM quotas

import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimit(options: {
  windowMs: number;       // Window duration in ms (e.g. 60_000 for 1 min)
  maxRequests: number;    // Maximum requests allowed in that window
  message?: string;
}) {
  const { windowMs, maxRequests, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Key by authenticated userId or remote IP
    const key = req.userId || req.ip || req.socket.remoteAddress || 'anonymous';
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || record.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: message || 'Too many requests. Please slow down and try again shortly.',
        errorType: 'rate-limit',
        retryAfterSeconds,
      });
    }

    record.count += 1;
    next();
  };
}

// Preset rate limiters
export const moodGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15,     // 15 mood generations per minute
  message: 'Mood generation rate limit reached (15/min). Please wait a moment before trying again.',
});

export const apiGeneralLimiter = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'General API rate limit reached. Please wait a moment.',
});
