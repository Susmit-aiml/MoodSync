// MoodSync — Backend Entry Point
// Express server: auth, user profile, mood pipeline, playlist, player routes
// Supports both HTTP and optional local HTTPS with auto-generated SSL
// Updated with Gemini 3.5 Flash and enhanced Spotify search queries

import dns from 'dns';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import https from 'https';
import net from 'net';
import selfsigned from 'selfsigned';

// Ensure reliable DNS resolution for MongoDB Atlas SRV connection strings on Windows/broadband
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if restricted
}
import { validateEnv } from './config/env';
import authRoutes from './routes/auth';
import moodRoutes from './routes/mood';
import playlistRoutes from './routes/playlist';
import playerRoutes from './routes/player';
import { authMiddleware } from './middleware/auth';
import { apiGeneralLimiter } from './middleware/rateLimit';
import User from './models/User';
import * as encryption from './services/encryption';
import * as spotify from './services/spotify';

dotenv.config();
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Middleware — Allow extension and local development
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith('chrome-extension://') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev/demo mode
  },
  credentials: true,
}));

app.use(express.json());
app.use(apiGeneralLimiter);

// Public routes (no session required)
app.use('/auth', authRoutes);

// Protected routes (session token required)
app.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let hasActiveDevice = false;
    try {
      const accessToken = encryption.decrypt(user.accessTokenEnc);
      const playback = await spotify.getPlaybackState(accessToken);
      hasActiveDevice = playback.isActive;
    } catch {
      // Non-critical device check failure
    }

    res.json({
      displayName: user.displayName,
      spotifyUserId: user.spotifyUserId,
      product: user.product,
      hasActiveDevice,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user profile', details: err.message });
  }
});

app.use('/mood', authMiddleware, moodRoutes);
app.use('/playlist', authMiddleware, playlistRoutes);
app.use('/player', authMiddleware, playerRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'moodsync-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Start server and connect to MongoDB
async function start() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 8000 });
      console.log('✅ Connected to MongoDB Atlas successfully');
    } catch (dbError: any) {
      console.warn('⚠️  Could not connect to MongoDB:', dbError.message || dbError);
      console.warn('   Ensure MongoDB is running or configure DATABASE_URL in .env');
    }
  } else {
    console.warn('⚠️  DATABASE_URL is not set. Database features require a MongoDB connection.');
  }

  // Generate self-signed certificate for local HTTPS support
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }]);
  const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
  const httpServer = http.createServer(app);

  // Dual HTTP & HTTPS Listener on the same port:
  // Sniffs the first byte of incoming TCP traffic.
  // Byte 0x16 (22 in decimal) indicates a TLS ClientHello handshake -> HTTPS.
  // Any other byte (e.g., 'G' (0x47) for GET, 'P' (0x50) for POST) -> HTTP.
  const server = net.createServer((socket) => {
    socket.once('data', (buffer) => {
      socket.pause();
      const isTls = buffer[0] === 22;
      const targetServer = isTls ? httpsServer : httpServer;
      socket.unshift(buffer);
      targetServer.emit('connection', socket);
      process.nextTick(() => socket.resume());
    });

    socket.on('error', (_err) => {
      // Ignore routine socket disconnects
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 MoodSync backend running (Dual HTTP & HTTPS) on port ${PORT}`);
    console.log(`   - HTTP Auth URL:   http://localhost:${PORT}/auth/login`);
    console.log(`   - HTTPS Auth URL:  https://localhost:${PORT}/auth/login`);
    console.log(`   - Health Check:    http://localhost:${PORT}/health`);
    console.log(`   ℹ️ Works automatically with both http:// and https:// redirect URIs.`);
  });
}

start();

export default app;
