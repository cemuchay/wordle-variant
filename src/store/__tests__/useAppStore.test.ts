import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

const mockIdbStore = new Map<string, string>();

vi.mock('../../utils/indexedDBStorage', () => ({
  asyncGetItem: vi.fn(async (key: string) => mockIdbStore.get(key) ?? null),
  asyncSetItem: vi.fn(async (key: string, value: string) => {
    mockIdbStore.set(key, value);
  }),
  asyncRemoveItem: vi.fn(async (key: string) => {
    mockIdbStore.delete(key);
  }),
  asyncGetAllEntries: vi.fn(async () =>
    Array.from(mockIdbStore.entries()).map(([key, value]) => ({ key, value })),
  ),
}));

beforeEach(() => {
  mockIdbStore.clear();
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAppStore with async storage', () => {
  it('persists preferences and stats through asyncStorage on state change', async () => {
    const { useAppStore } = await import('../useAppStore');

    act(() => {
      useAppStore.getState().setPreferences({ allowRoasts: false, theme: 'light', compactMode: true, navOrder: ['play'], rememberLastView: true });
    });

    vi.advanceTimersByTime(500);

    const persistedRaw = mockIdbStore.get('variant-app-storage');
    expect(persistedRaw).toBeDefined();

    const persisted = JSON.parse(persistedRaw!);
    expect(persisted.state.preferences.allowRoasts).toBe(false);
    expect(persisted.state.preferences.theme).toBe('light');
  });

  it('partialize filter excludes UI-only fields', async () => {
    const { useAppStore } = await import('../useAppStore');

    act(() => {
      useAppStore.getState().setStatsOpen(true);
    });

    vi.advanceTimersByTime(500);

    const persistedRaw = mockIdbStore.get('variant-app-storage');
    const persisted = JSON.parse(persistedRaw!);

    expect(persisted.state.isStatsOpen).toBeUndefined();
    expect(persisted.state.toast).toBeUndefined();
  });

  it('rehydrates persisted state after simulated page refresh', async () => {
    const mod = await import('../../utils/storage');
    mod.safeLocalStorage.clear();

    const { useAppStore: store1 } = await import('../useAppStore');

    act(() => {
      store1.getState().setStats({ gamesPlayed: 10, gamesWon: 7, currentStreak: 3, maxStreak: 5, guesses: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 0, '6': 0, '7': 0, X: 0 } });
    });

    vi.advanceTimersByTime(500);

    vi.resetModules();
    mockIdbStore.clear();

    const savedData = window.localStorage.getItem('variant-app-storage');
    if (savedData) {
      mockIdbStore.set('variant-app-storage', savedData);
    }

    const { useAppStore: store2 } = await import('../useAppStore');

    const stats = store2.getState().stats;
    expect(stats.gamesPlayed).toBe(10);
    expect(stats.gamesWon).toBe(7);
  });
});
