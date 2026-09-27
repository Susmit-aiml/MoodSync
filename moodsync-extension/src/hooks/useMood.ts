// MoodSync — useMood Hook
// Manages mood generation state, active results, and error categorization

import { useState, useCallback } from 'react';
import { PlaylistResult } from '../types/index';
import { generatePlaylist, queueNext } from '../services/api';

export function useMood() {
  const [result, setResult] = useState<PlaylistResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'no-premium' | 'no-device' | 'empty-results' | 'rate-limit' | 'generic'>('generic');

  const generate = useCallback(async (moodText: string) => {
    try {
      setIsGenerating(true);
      setError(null);
      setResult(null);
      const data = await generatePlaylist(moodText);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Playlist generation failed');
      setErrorType(err.errorType || 'generic');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleQueueTrack = useCallback(async (trackUri: string) => {
    try {
      await queueNext(trackUri);
    } catch (err: any) {
      setError(err.message || 'Queue next failed');
      setErrorType(err.errorType || 'generic');
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setErrorType('generic');
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
    setErrorType('generic');
  }, []);

  return {
    result,
    isGenerating,
    error,
    errorType,
    generate,
    queueTrack: handleQueueTrack,
    reset,
    dismissError,
  };
}
