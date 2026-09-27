// MoodSync — Session Model (Mongoose)
// Maps opaque session tokens to user records

import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ISession {
  _id: string;  // The session token itself
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
}

export interface ISessionModel extends Model<ISession> {
  createForUser(userId: mongoose.Types.ObjectId): Promise<ISession>;
}

const SessionSchema = new Schema<ISession, ISessionModel>({
  _id:       { type: String, default: () => crypto.randomBytes(32).toString('hex') },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index: auto-delete expired sessions
});

// Create a new session for a user (24-hour expiry)
SessionSchema.statics.createForUser = async function (userId: mongoose.Types.ObjectId): Promise<ISession> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const session = await this.create({ userId, expiresAt });
  return session;
};

export default mongoose.model<ISession, ISessionModel>('Session', SessionSchema);
