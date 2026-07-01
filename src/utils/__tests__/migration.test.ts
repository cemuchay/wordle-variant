import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIdbStore = new Map<string, string>();

vi.mock('../indexedDBStorage', () => ({
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
});

describe('runLegacyMigration', () => {
  it('migrates localStorage keys to IndexedDB', async () => {
    window.localStorage.setItem('game_stat', '{"wins":5}');
    window.localStorage.setItem('user_pref', 'dark');

    const { runLegacyMigration } = await import('../storage');
    await runLegacyMigration();

    expect(mockIdbStore.get('game_stat')).toBe('{"wins":5}');
    expect(mockIdbStore.get('user_pref')).toBe('dark');
  });

  it('sets __migrated_v2 flag in IndexedDB after migration', async () => {
    window.localStorage.setItem('some_key', 'some_value');

    const { runLegacyMigration } = await import('../storage');
    await runLegacyMigration();

    expect(mockIdbStore.get('__migrated_v2')).toBe('true');
  });

  it('clears native localStorage keys after successful migration', async () => {
    window.localStorage.setItem('to_migrate', 'data');

    const { runLegacyMigration } = await import('../storage');
    await runLegacyMigration();

    expect(window.localStorage.getItem('to_migrate')).toBeNull();
  });

  it('is idempotent — second call does not duplicate writes', async () => {
    window.localStorage.setItem('unique_key', 'unique_value');

    const { runLegacyMigration } = await import('../storage');
    await runLegacyMigration();
    await runLegacyMigration();

    const entries = Array.from(mockIdbStore.entries()).filter(
      ([k]) => k !== '__migrated_v2',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toBe('unique_value');
  });

  it('handles empty localStorage without error', async () => {
    const { runLegacyMigration } = await import('../storage');

    await expect(runLegacyMigration()).resolves.toBeUndefined();
  });
});
