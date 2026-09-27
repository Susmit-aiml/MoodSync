// MoodSync — MoodRequest Model (Mongoose)
// Stores each mood generation request for history, caching, and analytics

import mongoose, { Schema, Document } from 'mongoose';

export interface IMoodRequest extends Document {
  userId: mongoose.Types.ObjectId;
  moodText: string;
  parsedAnchors: {
    genres: string[];
    artists: string[];
    mood_keywords: string[];
    era: string | null;
  };
  trackUris: string[];
  createdAt: Date;
}

const MoodRequestSchema = new Schema<IMoodRequest>({
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  moodText:      { type: String, required: true },
  parsedAnchors: {
    genres:        [{ type: String }],
    artists:       [{ type: String }],
    mood_keywords: [{ type: String }],
    era:           { type: String, default: null },
  },
  trackUris:     [{ type: String }],
  createdAt:     { type: Date, default: Date.now },
});

// Index for caching: look up recent identical mood strings
MoodRequestSchema.index({ userId: 1, moodText: 1, createdAt: -1 });

export default mongoose.model<IMoodRequest>('MoodRequest', MoodRequestSchema);
