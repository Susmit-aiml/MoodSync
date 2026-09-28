// MoodSync — Environment Variable Validation
// Validates configuration and reports missing keys with helpful hints

export function validateEnv(): void {
  const critical = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
    'DATABASE_URL',
  ];

  const missingCritical = critical.filter((key) => !process.env[key]);

  if (missingCritical.length > 0) {
    console.warn('\n⚠️  Notice: Missing environment variables:');
    missingCritical.forEach((key) => console.warn(`   - ${key}`));
    console.warn('   Ensure these are defined in .env before processing live Spotify OAuth requests.\n');
  }

  const hasLlm = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasLlm) {
    console.log('ℹ️  LLM API key not set — using built-in intelligent heuristic anchor engine.');
  } else {
    console.log('✨ Gemini / AI Key detected — AI mood anchor engine is ACTIVE.');
  }

  if (!process.env.SPOTIFY_REDIRECT_URI) {
    process.env.SPOTIFY_REDIRECT_URI = `http://localhost:${process.env.PORT || 3001}/auth/callback`;
  }
}
