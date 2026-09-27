// MoodSync — Encryption Service
// AES-256 encrypt/decrypt for Spotify tokens at rest

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY not set');
  // Ensure exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(key).digest();
}

// Encrypt a plaintext string → base64 encoded string (iv:encrypted:tag)
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Store as iv:encrypted:tag (all hex)
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

// Decrypt a base64 encoded string (iv:encrypted:tag) → plaintext
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, encrypted, tagHex] = ciphertext.split(':');

  if (!ivHex || !encrypted || !tagHex) {
    throw new Error('Invalid ciphertext format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
