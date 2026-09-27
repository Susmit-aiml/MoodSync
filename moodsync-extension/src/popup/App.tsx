// MoodSync — Chrome Extension Popup Main View
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMood } from '../hooks/useMood';
import Login from './Login';
import MoodInput from './MoodInput';
import Results from './Results';
import ErrorState from './ErrorState';

const App: React.FC = () => {
  const { user, isLoading: authLoading, isLoggingIn, login, logout } = useAuth();
  const {
    result,
    isGenerating,
    error: moodError,
    errorType,
    generate,
    queueTrack,
    reset,
    dismissError,
  } = useMood();

  return (
    <div className="moodsync-app">
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-logo-icon">🎵</div>
          <span className="brand-title">MoodSync</span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="user-badge" title={`Logged in as ${user.displayName} (${user.product})`}>
              <span className="user-dot" />
              <span className="user-name">{user.displayName}</span>
            </div>
            <button
              className="logout-icon-btn"
              onClick={logout}
              title="Log out from MoodSync"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Main Body State Machine */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {authLoading ? (
          <div className="loading-box" style={{ flex: 1 }}>
            <div className="spinner-ring" />
            <div className="loading-subtext">Connecting to MoodSync...</div>
          </div>
        ) : !user ? (
          <Login onLogin={login} isLoading={isLoggingIn} />
        ) : (
          <>
            {moodError && (
              <ErrorState
                error={moodError}
                errorType={errorType}
                onDismiss={dismissError}
                onRetry={result ? undefined : () => dismissError()}
              />
            )}

            {result ? (
              <Results
                result={result}
                isPremium={user.product === 'premium'}
                hasActiveDevice={user.hasActiveDevice}
                onQueueNext={queueTrack}
                onReset={reset}
              />
            ) : (
              <MoodInput onGenerate={generate} isLoading={isGenerating} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
