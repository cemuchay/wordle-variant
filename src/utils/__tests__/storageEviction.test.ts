import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { purgeStaleStorage, getStorageUsage, isQuotaExceededError, safeLocalStorage } from '../storage';

describe('LocalStorage Auto-Purge and Capacity Management', () => {
  beforeEach(() => {
    localStorage.clear();
    safeLocalStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    safeLocalStorage.clear();
  });

  it('calculates storage usage estimation accurately', () => {
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');

    const usage = getStorageUsage();
    expect(usage.bytes).toBeGreaterThan(0);
    expect(usage.percentage).toBeGreaterThanOrEqual(0);
    expect(usage.percentage).toBeLessThanOrEqual(100);
  });

  it('detects DOMException quota exceeded error formats across browsers', () => {
    const standardError = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const firefoxError = new DOMException('Quota exceeded', 'NS_ERROR_DOM_QUOTA_REACHED');
    const genericError = new Error('Generic failure');

    expect(isQuotaExceededError(standardError)).toBe(true);
    expect(isQuotaExceededError(firefoxError)).toBe(true);
    expect(isQuotaExceededError(genericError)).toBe(false);
  });

  it('purges completed daily games older than 7 days that have been synced', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Old completed and synced game (safe to purge)
    localStorage.setItem(
      `wordle-${eightDaysAgo}`,
      JSON.stringify({ status: 'won', needsSync: false, guesses: ['APPLE'] }),
    );
    // Old uncompleted or unsynced game (NEVER purge)
    localStorage.setItem(
      `wordle-${eightDaysAgo}-unsynced`,
      JSON.stringify({ status: 'playing', needsSync: true }),
    );
    // Today's game (NEVER purge)
    localStorage.setItem(
      `wordle-${today}`,
      JSON.stringify({ status: 'won', needsSync: false }),
    );
    // User preference / Auth (NEVER purge)
    localStorage.setItem('sb-token', 'auth-session-data');
    localStorage.setItem('wordle-preferences', JSON.stringify({ darkMode: true }));

    const purgedCount = purgeStaleStorage();

    expect(purgedCount).toBe(1);
    expect(localStorage.getItem(`wordle-${eightDaysAgo}`)).toBeNull();
    expect(localStorage.getItem(`wordle-${eightDaysAgo}-unsynced`)).not.toBeNull();
    expect(localStorage.getItem(`wordle-${today}`)).not.toBeNull();
    expect(localStorage.getItem('sb-token')).toBe('auth-session-data');
    expect(localStorage.getItem('wordle-preferences')).not.toBeNull();
  });

  it('purges finished challenge progress and stale view states', () => {
    // Finished challenge (safe to purge)
    localStorage.setItem(
      'challenge-prog-ch1-r-ch1',
      JSON.stringify({ status: 'completed', needsSync: false }),
    );
    // Unfinished challenge (NEVER purge)
    localStorage.setItem(
      'challenge-prog-ch2-r-ch2',
      JSON.stringify({ status: 'playing', needsSync: true }),
    );
    // Stale match history caches (safe to purge)
    localStorage.setItem('wordup_cached_history_matches', JSON.stringify([{ id: 'm1' }]));

    const purgedCount = purgeStaleStorage();

    expect(purgedCount).toBe(2);
    expect(localStorage.getItem('challenge-prog-ch1-r-ch1')).toBeNull();
    expect(localStorage.getItem('challenge-prog-ch2-r-ch2')).not.toBeNull();
    expect(localStorage.getItem('wordup_cached_history_matches')).toBeNull();
  });

  it('SafeStorage.setItem triggers auto-purge and retries when quota exceeded', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    localStorage.setItem(
      `wordle-${eightDaysAgo}`,
      JSON.stringify({ status: 'won', needsSync: false }),
    );

    let quotaThrown = false;
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation((key: string, val: string) => {
      if (key === 'new-game-state' && !quotaThrown) {
        quotaThrown = true;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem(key, val);
    });

    try {
      safeLocalStorage.setItem('new-game-state', 'saved-value');

      // Should have caught quota error and purged old item
      expect(quotaThrown).toBe(true);
      expect(localStorage.getItem(`wordle-${eightDaysAgo}`)).toBeNull();
      expect(safeLocalStorage.getItem('new-game-state')).toBe('saved-value');
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
