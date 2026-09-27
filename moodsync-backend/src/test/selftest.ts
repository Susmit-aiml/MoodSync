// MoodSync — Self-Test Suite
// Validates token encryption/decryption, heuristic anchor generation, and data shapes

import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

// Ensure test encryption key is set if not already in env
if (!process.env.TOKEN_ENCRYPTION_KEY) {
  process.env.TOKEN_ENCRYPTION_KEY = 'test_encryption_key_32_characters_long!';
}

import { encrypt, decrypt } from '../services/encryption';
import { generateHeuristicAnchors, validateAnchors } from '../services/llm';

console.log('🧪 Running MoodSync Backend Self-Tests...\n');

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

// 1. Encryption Tests
test('AES-256 Encryption & Decryption roundtrip', () => {
  const sampleToken = 'BQAcX892_spotify_secret_access_token_mock_12345';
  const encrypted = encrypt(sampleToken);
  assert.notStrictEqual(encrypted, sampleToken, 'Encrypted output must not match plaintext');
  assert.ok(encrypted.includes(':'), 'Ciphertext must contain iv:ciphertext:tag format');

  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, sampleToken, 'Decrypted token must exactly match original');
});

test('Tampered ciphertext rejection in decryption', () => {
  const sample = 'secret';
  const encrypted = encrypt(sample);
  const parts = encrypted.split(':');
  // Tamper with the encrypted bytes
  parts[1] = parts[1].slice(0, -2) + 'ff';
  const tampered = parts.join(':');

  assert.throws(() => {
    decrypt(tampered);
  }, /auth tag|unsupported|bad decrypt/i);
});

// 2. Heuristic Anchor Engine Tests
test('Heuristic engine generates valid anchors for rainy evening vibe', () => {
  const anchors = generateHeuristicAnchors('rainy evening, cozy coffee shop vibe');
  assert.ok(validateAnchors(anchors), 'Generated anchors must conform to MoodAnchors schema');
  assert.ok(anchors.genres.length >= 2, 'Must have at least 2 genres');
  assert.ok(anchors.artists.length >= 2, 'Must have at least 2 real artists');
  assert.ok(anchors.mood_keywords.length >= 2, 'Must have at least 2 keywords');
});

test('Heuristic engine detects era specifications (80s, 90s)', () => {
  const eighties = generateHeuristicAnchors('upbeat 80s synthpop disco party');
  assert.strictEqual(eighties.era, '1980s');

  const nineties = generateHeuristicAnchors('grungy 90s rock');
  assert.strictEqual(nineties.era, '1990s');

  const timeless = generateHeuristicAnchors('chill ambient nature sounds');
  assert.strictEqual(timeless.era, null);
});

test('Heuristic engine prioritizes high energy genres for workout intent', () => {
  const gym = generateHeuristicAnchors('heavy gym pump workout hype');
  assert.ok(
    gym.genres.some((g) => /hip-hop|trap|edm|bass/i.test(g)),
    'Workout intent should include high-energy genres'
  );
  assert.ok(
    gym.artists.some((a) => /Travis Scott|Kendrick|Fred again|Skrillex/i.test(a)),
    'Workout intent should suggest energetic artists'
  );
});

test('validateAnchors validator accepts compliant objects and rejects malformed ones', () => {
  assert.strictEqual(
    validateAnchors({
      genres: ['indie', 'folk'],
      artists: ['Bon Iver'],
      mood_keywords: ['warm', 'acoustic'],
      era: null,
    }),
    true
  );

  assert.strictEqual(
    validateAnchors({
      genres: [], // empty genres
      artists: ['Artist'],
      mood_keywords: ['vibe'],
      era: null,
    }),
    false
  );

  assert.strictEqual(validateAnchors(null), false);
  assert.strictEqual(validateAnchors('invalid'), false);
});

console.log(`\n📊 Results: ${passed}/${total} tests passed.\n`);

if (passed === total) {
  console.log('🎉 All MoodSync self-tests passed cleanly!\n');
  process.exit(0);
} else {
  console.error('💥 Some tests failed.\n');
  process.exit(1);
}
