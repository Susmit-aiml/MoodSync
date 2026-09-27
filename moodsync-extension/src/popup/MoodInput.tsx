// MoodSync — Mood Text Input Component
import React, { useState, useEffect } from 'react';

interface MoodInputProps {
  onGenerate: (moodText: string) => void;
  isLoading: boolean;
}

const PRESET_MOODS = [
  '🌧️ Rainy evening, low energy but not sad',
  '💪 Heavy gym pump, intense hip-hop & bass',
  '☕ Cozy Sunday morning acoustic cafe',
  '🌌 Late-night neon highway synthwave drive',
  '📚 Deep focus instrumental, no lyrics',
];

const LOADING_STAGES = [
  'Analyzing your mood and listening intent...',
  'Extracting genres, real artists & vibe anchors...',
  'Executing multi-dimensional Spotify searches...',
  'De-duplicating and assembling your playlist...',
];

const MoodInput: React.FC<MoodInputProps> = ({ onGenerate, isLoading }) => {
  const [moodText, setMoodText] = useState('');
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < LOADING_STAGES.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (moodText.trim() && !isLoading) {
      onGenerate(moodText.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isLoading) {
    return (
      <div className="loading-box">
        <div className="spinner-ring" />
        <div className="loading-stage-text">{LOADING_STAGES[stageIndex]}</div>
        <div className="loading-subtext">Curating tracks matching "{moodText}"</div>
      </div>
    );
  }

  return (
    <form className="mood-input-section" onSubmit={handleSubmit}>
      <div className="input-label-row">
        <span className="input-label">Describe your mood or vibe</span>
        <span className="char-counter">{moodText.length}/200</span>
      </div>

      <textarea
        className="mood-textarea"
        value={moodText}
        maxLength={200}
        onChange={(e) => setMoodText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. rainy evening, want something low-energy with soft vocals and warm guitar..."
        disabled={isLoading}
      />

      <div>
        <div className="suggestions-heading">Or pick a quick vibe:</div>
        <div className="chips-grid">
          {PRESET_MOODS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="chip-btn"
              onClick={() => setMoodText(preset.replace(/^[^\s]+\s/, ''))}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="btn-spotify"
        disabled={isLoading || !moodText.trim()}
      >
        <span>✨</span>
        <span>Generate Playlist</span>
      </button>
    </form>
  );
};

export default MoodInput;
