// MoodSync — User Model (Mongoose)
// Stores Spotify user profile + encrypted tokens

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  spotifyUserId: string;
  displayName: string;
  product: 'free' | 'premium';
  accessTokenEnc: string;   // AES-256 encrypted
  refreshTokenEnc: string;  // AES-256 encrypted
  tokenExpiresAt: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  spotifyUserId: { type: String, required: true, unique: true, index: true },
  displayName:   { type: String, required: true },
  product:       { type: String, enum: ['free', 'premium'], required: true },
  accessTokenEnc:  { type: String, required: true },
  refreshTokenEnc: { type: String, required: true },
  tokenExpiresAt:  { type: Date, required: true },
  createdAt:       { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', UserSchema);
