// MoodSync — Error State Component
import React from 'react';

interface ErrorStateProps {
  error: string;
  errorType?: 'no-premium' | 'no-device' | 'empty-results' | 'rate-limit' | 'generic';
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, errorType = 'generic', onRetry, onDismiss }) => {
  const getErrorMessage = (): { title: string; body: string } => {
    switch (errorType) {
      case 'no-premium':
        return {
          title: 'Premium Required for Queueing',
          body: 'Direct queue playback requires Spotify Premium. Your playlist was still created in your Spotify account!',
        };
      case 'no-device':
        return {
          title: 'No Active Spotify Session',
          body: 'Open Spotify on your phone, desktop, or browser and start playing a track, then try again.',
        };
      case 'empty-results':
        return {
          title: 'No Matching Tracks Found',
          body: "We couldn't find matching songs on Spotify for this exact phrase. Try describing the instruments, tempo, or genre!",
        };
      case 'rate-limit':
        return {
          title: 'Too Many Requests',
          body: 'Spotify or LLM rate limits reached. Please wait 15 seconds before generating again.',
        };
      default:
        return {
          title: 'Something went wrong',
          body: error || 'An unexpected error occurred while communicating with MoodSync services.',
        };
    }
  };

  const { title, body } = getErrorMessage();

  return (
    <div className="error-banner">
      <div className="error-title">⚠️ {title}</div>
      <div className="error-message">{body}</div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '6px' }}>
        {onRetry && (
          <button className="btn-secondary" onClick={onRetry}>
            Try Again
          </button>
        )}
        {onDismiss && (
          <button className="btn-secondary" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
