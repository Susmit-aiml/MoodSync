// MoodSync — Login Screen Component
import React from 'react';

interface LoginProps {
  onLogin: () => void;
  isLoading?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, isLoading }) => {
  return (
    <div className="login-screen">
      <div className="hero-emblem">✨</div>
      <h1 className="hero-title">MoodSync</h1>
      <p className="hero-desc">
        Turn your mood into a custom, playable Spotify playlist in seconds.
      </p>

      <div className="feature-pills">
        <span className="feature-pill">🧠 AI Vibe Reasoning</span>
        <span className="feature-pill">⚡ Instant Playlists</span>
        <span className="feature-pill">🎧 Queue Next</span>
      </div>

      <button className="btn-spotify" onClick={onLogin} disabled={isLoading}>
        <span>🎵</span>
        <span>{isLoading ? 'Connecting to Spotify...' : 'Connect with Spotify'}</span>
      </button>
    </div>
  );
};

export default Login;
