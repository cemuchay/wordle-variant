import { describe, it, expect, beforeEach } from 'vitest';
import {
  pruneStaleChallengeQueue,
  getPendingChallengeUploads,
  clearAllChallengeLocalData,
} from '../challengeQueueManager';

describe('challengeQueueManager', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('prunes queue items older than 7 days', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;

    localStorage.setItem(
      'challenge-prog-old-r',
      JSON.stringify({ needsSync: true, timestamp: eightDaysAgo, status: 'completed' })
    );
    localStorage.setItem(
      'challenge-prog-recent-r',
      JSON.stringify({ needsSync: true, timestamp: oneDayAgo, status: 'completed' })
    );

    const prunedCount = pruneStaleChallengeQueue();
    expect(prunedCount).toBe(1);
    expect(localStorage.getItem('challenge-prog-old-r')).toBeNull();
    expect(localStorage.getItem('challenge-prog-recent-r')).not.toBeNull();
  });

  it('detects pending uploads with needsSync true', () => {
    const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;

    localStorage.setItem(
      'challenge-prog-c123-m-4',
      JSON.stringify({
        needsSync: true,
        timestamp: oneDayAgo,
        status: 'completed',
        attempts: 4,
        score: 85,
      })
    );
    localStorage.setItem(
      'challenge-prog-c456-r',
      JSON.stringify({
        needsSync: false,
        timestamp: oneDayAgo,
        status: 'completed',
      })
    );

    const pending = getPendingChallengeUploads();
    expect(pending.length).toBe(1);
    expect(pending[0].challengeId).toBe('c123');
    expect(pending[0].wordLength).toBe(4);
    expect(pending[0].score).toBe(85);
  });

  it('clears all challenge local and session storage data on clearAllChallengeLocalData', async () => {
    localStorage.setItem('challenge-prog-c1-r', JSON.stringify({ test: 1 }));
    localStorage.setItem('challenge_filter_mode', 'ALL');
    localStorage.setItem('wordle_challenge_last_view', JSON.stringify({ type: 'list' }));
    localStorage.setItem('wordle_recent_challenges', JSON.stringify(['c1', 'c2']));
    localStorage.setItem('unrelated_key', 'keep_me');

    sessionStorage.setItem('challenge-active-session', '123');

    await clearAllChallengeLocalData();

    expect(localStorage.getItem('challenge-prog-c1-r')).toBeNull();
    expect(localStorage.getItem('challenge_filter_mode')).toBeNull();
    expect(localStorage.getItem('wordle_challenge_last_view')).toBeNull();
    expect(localStorage.getItem('wordle_recent_challenges')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep_me');
    expect(sessionStorage.getItem('challenge-active-session')).toBeNull();
  });
});
