// MoodSync — LLM Service
// Converts natural language mood text → structured music search anchors
// Supports Google Gemini API, Anthropic Claude, and Intelligent Heuristic Fallback

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export interface MoodAnchors {
  genres: string[];       // 2-4 genres
  artists: string[];      // 2-5 real artist names
  mood_keywords: string[]; // 2-4 descriptive words
  era: string | null;     // e.g. "2010s", "90s", or null
}

const SYSTEM_PROMPT = `You are a music curation expert. Your job is to convert a user's natural language mood, listening intent, or emotional description into structured music search anchors for Spotify.
Respond with ONLY a valid JSON object, no prose, in this exact format:
{
  "genres": ["string", "string"],
  "artists": ["string", "string", "string"],
  "mood_keywords": ["string", "string"],
  "era": "string or null"
}
Rules:
- genres: 2-4 relevant musical genres (e.g. "lo-fi", "indie folk", "deep house", "ambient jazz", "synthwave")
- artists: 2-5 real, well-known artist names matching this vibe
- mood_keywords: 2-4 search-friendly atmosphere words (e.g. "rainy", "mellow", "warm", "late night", "energetic")
- era: release decade if requested or implied (e.g. "80s", "90s", "2010s", "2020s"), or null if contemporary/not specified
Never wrap the output in markdown backticks or commentary. Only output the raw JSON object.`;

/**
 * Call Google Gemini API to extract mood anchors with ultra-fast latency & failover
 */
async function callGemini(apiKey: string, moodText: string, contextInfo: string): Promise<MoodAnchors | null> {
  const prompt = `User listening intent: "${moodText}".${contextInfo}`;
  const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');

  // Models ordered by speed and stability:
  // gemini-3.5-flash-lite (1.4s) -> gemini-3.1-flash-lite (2.6s) -> gemini-3.8-flash (fallback)
  const modelsToTry = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  // 1. Try modern @google/genai SDK across candidate models
  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });

    for (const model of modelsToTry) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on ${model}`)), 6000)
          ),
        ]);

        const text = response.text?.trim();
        if (text) {
          const cleaned = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          if (validateAnchors(parsed)) {
            console.log(`✨ Generated AI anchors via Gemini [${model}] in real-time`);
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ Gemini SDK ${model} failed (${err.message || err}), trying next candidate...`);
      }
    }
  } catch (sdkErr: any) {
    console.warn('⚠️ @google/genai SDK init error, trying Google AI REST fallback:', sdkErr.message || sdkErr);
  }

  // 2. Direct REST Fallback to Google AI Studio with 4-second timeout
  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleaned = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          if (validateAnchors(parsed)) {
            console.log(`✨ Generated AI anchors via Gemini REST [${model}]`);
            return parsed;
          }
        }
      }
    } catch {
      // Continue to next model or fallback
    }
  }

  return null;
}

/**
 * Call Anthropic Claude API to extract mood anchors
 */
async function callClaude(apiKey: string, moodText: string, contextInfo: string): Promise<MoodAnchors | null> {
  try {
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    const anthropic = new Anthropic({ apiKey: cleanKey });
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `User listening intent: "${moodText}".${contextInfo}`,
        },
      ],
    });

    const firstBlock = response.content[0];
    if (firstBlock && firstBlock.type === 'text') {
      const cleaned = firstBlock.text.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (validateAnchors(parsed)) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Anthropic API error:', err.message || err);
  }
  return null;
}

/**
 * Generate mood anchors using Gemini, Claude, or intelligent local heuristic
 */
export async function generateAnchors(
  moodText: string,
  context?: { timeOfDay?: string; topArtists?: string[] }
): Promise<MoodAnchors> {
  const rawKey = (
    process.env.GEMINI_API_KEY ||
    (!process.env.LLM_API_KEY?.startsWith('sk-ant') ? process.env.LLM_API_KEY : '') ||
    ''
  ).trim().replace(/^['"]|['"]$/g, '');

  const claudeKey = (
    process.env.ANTHROPIC_API_KEY ||
    (process.env.LLM_API_KEY?.startsWith('sk-ant') ? process.env.LLM_API_KEY : '') ||
    ''
  ).trim().replace(/^['"]|['"]$/g, '');

  let contextInfo = '';
  if (context?.timeOfDay) contextInfo += ` Current time of day: ${context.timeOfDay}.`;
  if (context?.topArtists?.length) {
    contextInfo += ` User's preferred artists: ${context.topArtists.slice(0, 3).join(', ')}.`;
  }

  // 1. If Gemini key is detected, prioritize Gemini!
  if (rawKey && rawKey.length > 5 && !rawKey.includes('your_')) {
    const geminiAnchors = await callGemini(rawKey, moodText, contextInfo);
    if (geminiAnchors) {
      return {
        genres: geminiAnchors.genres.slice(0, 4),
        artists: geminiAnchors.artists.slice(0, 5),
        mood_keywords: geminiAnchors.mood_keywords.slice(0, 4),
        era: geminiAnchors.era || null,
      };
    }
  }

  // 2. If Claude key is detected, call Claude
  if (claudeKey && claudeKey.trim().length > 0 && !claudeKey.includes('your_')) {
    const claudeAnchors = await callClaude(claudeKey, moodText, contextInfo);
    if (claudeAnchors) {
      return {
        genres: claudeAnchors.genres.slice(0, 4),
        artists: claudeAnchors.artists.slice(0, 5),
        mood_keywords: claudeAnchors.mood_keywords.slice(0, 4),
        era: claudeAnchors.era || null,
      };
    }
  }

  // 3. Fallback heuristic engine (ensures 100% uptime even with no keys)
  return generateHeuristicAnchors(moodText, context);
}

/**
 * Intelligent keyword-based heuristic anchor engine
 * Ensures MoodSync generates accurate playlists even during testing or when LLM API is unavailable
 */
export function generateHeuristicAnchors(
  moodText: string,
  context?: { topArtists?: string[] }
): MoodAnchors {
  const lower = moodText.toLowerCase();

  const anchors: MoodAnchors = {
    genres: [],
    artists: [],
    mood_keywords: [],
    era: null,
  };

  // Era detection
  if (lower.includes('80s') || lower.includes('eighties')) anchors.era = '1980s';
  else if (lower.includes('90s') || lower.includes('nineties')) anchors.era = '1990s';
  else if (lower.includes('2000s') || lower.includes('y2k') || lower.includes('00s')) anchors.era = '2000s';
  else if (lower.includes('2010s')) anchors.era = '2010s';
  else if (lower.includes('70s') || lower.includes('seventies')) anchors.era = '1970s';

  // Mood & genre mapping patterns
  if (lower.includes('rain') || lower.includes('chill') || lower.includes('cozy') || lower.includes('coffee') || lower.includes('study')) {
    anchors.genres.push('lo-fi beats', 'indie folk', 'ambient acoustic');
    anchors.artists.push('Novo Amor', 'Phoebe Bridgers', 'Bon Iver', 'Iron & Wine');
    anchors.mood_keywords.push('rainy', 'mellow', 'soft', 'cozy');
  } else if (lower.includes('gym') || lower.includes('workout') || lower.includes('pump') || lower.includes('energy') || lower.includes('hype')) {
    anchors.genres.push('hip-hop', 'trap', 'edm', 'drum and bass');
    anchors.artists.push('Travis Scott', 'Kendrick Lamar', 'Skrillex', 'Fred again..');
    anchors.mood_keywords.push('workout', 'banger', 'high energy', 'intense');
  } else if (lower.includes('night') || lower.includes('drive') || lower.includes('neon') || lower.includes('synth')) {
    anchors.genres.push('synthwave', 'retrowave', 'indie electronic', 'dream pop');
    anchors.artists.push('The Midnight', 'Kavinsky', 'Gunship', 'M83');
    anchors.mood_keywords.push('night drive', 'nostalgic', 'cinematic', 'atmospheric');
  } else if (lower.includes('sad') || lower.includes('cry') || lower.includes('heartbreak') || lower.includes('lonely') || lower.includes('melanchol')) {
    anchors.genres.push('indie sadcore', 'acoustic', 'chamber pop');
    anchors.artists.push('Sufjan Stevens', 'Julien Baker', 'Radiohead', 'Mitski');
    anchors.mood_keywords.push('heartbroken', 'melancholic', 'raw', 'somber');
  } else if (lower.includes('party') || lower.includes('club') || lower.includes('dance') || lower.includes('happy') || lower.includes('upbeat')) {
    anchors.genres.push('dance pop', 'house', 'disco pop', 'nu-disco');
    anchors.artists.push('Dua Lipa', 'Peggy Gou', 'Disclosure', 'Calvin Harris');
    anchors.mood_keywords.push('upbeat', 'danceable', 'groove', 'celebration');
  } else if (lower.includes('focus') || lower.includes('code') || lower.includes('work') || lower.includes('deep work')) {
    anchors.genres.push('deep focus', 'ambient techno', 'minimal electronic', 'post-rock');
    anchors.artists.push('Tycho', 'Kiasmos', 'Jon Hopkins', 'Bonobo');
    anchors.mood_keywords.push('concentration', 'hypnotic', 'flow state', 'instrumental');
  } else if (lower.includes('jazz') || lower.includes('dinner') || lower.includes('wine') || lower.includes('classy')) {
    anchors.genres.push('contemporary jazz', 'bossa nova', 'cool jazz');
    anchors.artists.push('Miles Davis', 'Bill Evans', 'Norah Jones', 'Chet Baker');
    anchors.mood_keywords.push('smooth', 'classy', 'laid back', 'sophisticated');
  } else {
    anchors.genres.push('indie pop', 'alternative r&b', 'neo soul');
    anchors.artists.push('Leon Bridges', 'Khruangbin', 'Mac DeMarco', 'Arlo Parks');
    anchors.mood_keywords.push('vibes', 'feel good', 'soulful', 'melodic');
  }

  // Personalize with user top artists if provided
  if (context?.topArtists && context.topArtists.length > 0) {
    anchors.artists = Array.from(new Set([...anchors.artists.slice(0, 3), ...context.topArtists.slice(0, 2)]));
  }

  return anchors;
}

/**
 * Validate that an object has the expected MoodAnchors shape
 */
export function validateAnchors(data: unknown): data is MoodAnchors {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.genres) && obj.genres.length >= 1 &&
    Array.isArray(obj.artists) && obj.artists.length >= 1 &&
    Array.isArray(obj.mood_keywords) && obj.mood_keywords.length >= 1 &&
    (obj.era === null || typeof obj.era === 'string')
  );
}
