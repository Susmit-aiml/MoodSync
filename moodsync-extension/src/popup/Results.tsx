// MoodSync — Results Display Component
import React, { useState } from 'react';
import { PlaylistResult } from '../types/index';

interface ResultsProps {
  result: PlaylistResult;
  isPremium: boolean;
  hasActiveDevice: boolean;
  onQueueNext: (trackUri: string) => Promise<void>;
  onReset: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const Results: React.FC<ResultsProps> = ({
  result,
  isPremium,
  hasActiveDevice,
  onQueueNext,
  onReset,
}) => {
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);

  const openInSpotify = () => {
    if (result.playlist?.url) {
      window.open(result.playlist.url, '_blank');
    }
  };

  const handleQueueNext = async () => {
    if (!result.tracks || result.tracks.length === 0) return;
    try {
      setIsQueueing(true);
      setQueueStatus(null);
      await onQueueNext(result.tracks[0].uri);
      setQueueStatus('✅ Queued next track!');
      setTimeout(() => setQueueStatus(null), 3500);
    } catch (err: any) {
      setQueueStatus(`⚠️ ${err.message || 'Queue failed'}`);
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <div className="results-container">
      {/* Playlist Summary Card */}
      <div className="playlist-header-card">
        <div className="playlist-meta-row">
          <div className="playlist-title">Mood: {result.moodText}</div>
          <span className="track-count-badge">{result.playlist.trackCount} tracks</span>
        </div>

        {/* Anchors Tags */}
        <div className="anchors-chips-row">
          {result.anchors.genres.slice(0, 3).map((genre, i) => (
            <span key={i} className="anchor-tag">
              #{genre}
            </span>
          ))}
          {result.anchors.era && (
            <span className="anchor-tag">📅 {result.anchors.era}</span>
          )}
          {result.anchors.mood_keywords.slice(0, 2).map((kw, i) => (
            <span key={i} className="anchor-tag">
              ✨ {kw}
            </span>
          ))}
        </div>

        {/* Main Actions */}
        <div className="action-buttons-row">
          <button className="btn-spotify" style={{ flex: 1 }} onClick={openInSpotify}>
            <span>▶</span>
            <span>Open in Spotify</span>
          </button>

          {isPremium && hasActiveDevice && (
            <button
              className="btn-secondary"
              onClick={handleQueueNext}
              disabled={isQueueing}
              title="Add first track to your playing queue"
            >
              <span>⏭</span>
              <span>{isQueueing ? 'Queueing...' : 'Queue Next'}</span>
            </button>
          )}

          <button className="btn-secondary" onClick={onReset} title="Generate another mood playlist">
            <span>↺</span>
            <span>New</span>
          </button>
        </div>

        {queueStatus && (
          <div style={{ fontSize: '11px', color: '#1ed760', marginTop: '4px' }}>
            {queueStatus}
          </div>
        )}
      </div>

      {/* Track Cards */}
      <div className="track-list">
        {result.tracks.map((track, index) => (
          <div key={track.uri || index} className="track-item">
            {track.albumArtUrl ? (
              <img src={track.albumArtUrl} alt={track.albumName} className="track-art" />
            ) : (
              <div className="track-art" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🎵
              </div>
            )}
            <div className="track-info">
              <div className="track-name" title={track.name}>{track.name}</div>
              <div className="track-artist" title={track.artist}>{track.artist}</div>
            </div>
            <div className="track-duration">{formatDuration(track.durationMs)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Results;
