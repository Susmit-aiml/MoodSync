// MoodSync — Auth Middleware
// Validates session token on every protected request

import { Request, Response, NextFunction } from 'express';
import Session from '../models/Session';
import User from '../models/User';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: InstanceType<typeof User>;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const sessionToken = authHeader.slice(7); // Remove "Bearer "

  try {
    // Look up session
    const session = await Session.findById(sessionToken);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      await Session.deleteOne({ _id: sessionToken });
      return res.status(401).json({ error: 'Session expired' });
    }

    // Attach userId to request
    req.userId = session.userId.toString();
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication check failed' });
  }
}
