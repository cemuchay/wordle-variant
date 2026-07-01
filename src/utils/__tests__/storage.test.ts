import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

beforeEach(async () => {
  mockIdbStore.clear();
  vi.useFakeTimers();
  vi.resetModules();
  const mod = await import('../storage');
  mod.safeLocalStorage.clear();
  mod.safeSessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

async function importStorage() {
  return import('../storage') as Promise<typeof import('../storage')>;
}

describe('SafeStorage with IndexedDB backing', () => {
  it('hydrateFromDB populates memoryStore from IndexedDB', async () => {
    mockIdbStore.set('existing-key', 'existing-value');
    mockIdbStore.set('another-key', 'another-value');

    const { safeLocalStorage } = await importStorage();
    await safeLocalStorage.hydrateFromDB();

    expect(safeLocalStorage.getItem('existing-key')).toBe('existing-value');
    expect(safeLocalStorage.getItem('another-key')).toBe('another-value');
    expect(safeLocalStorage.getItem('nonexistent')).toBeNull();
  });

  it('setItem writes to memoryStore synchronously', async () => {
    const { safeLocalStorage } = await importStorage();

    safeLocalStorage.setItem('sync-key', 'sync-value');

    expect(safeLocalStorage.getItem('sync-key')).toBe('sync-value');
  });

  it('debounced flush writes to IndexedDB within expected window', async () => {
    const { safeLocalStorage } = await importStorage();

    safeLocalStorage.setItem('flush-key', 'flush-value');

    expect(mockIdbStore.has('flush-key')).toBe(false);

    vi.advanceTimersByTime(500);

    expect(mockIdbStore.get('flush-key')).toBe('flush-value');
  });

  it('removeItem removes from memoryStore and removes from IndexedDB', async () => {
    const { safeLocalStorage } = await importStorage();

    safeLocalStorage.setItem('to-remove', 'value');
    expect(safeLocalStorage.getItem('to-remove')).toBe('value');

    safeLocalStorage.removeItem('to-remove');
    expect(safeLocalStorage.getItem('to-remove')).toBeNull();
    expect(mockIdbStore.has('to-remove')).toBe(false);
  });

  it('asyncStorage.getItem returns a Promise resolving to the same value as getItem', async () => {
    const { safeLocalStorage, asyncStorage } = await importStorage();

    safeLocalStorage.setItem('async-test', 'async-value');
    const result = await asyncStorage.getItem('async-test');

    expect(result).toBe('async-value');
  });

  it('asyncStorage.setItem triggers debounced IndexedDB write', async () => {
    const { asyncStorage } = await importStorage();

    await asyncStorage.setItem('async-set', 'async-val');

    expect(mockIdbStore.has('async-set')).toBe(false);

    vi.advanceTimersByTime(500);

    expect(mockIdbStore.get('async-set')).toBe('async-val');
  });

  it('multiple rapid setItem calls coalesce to a single IndexedDB write', async () => {
    const { safeLocalStorage } = await importStorage();

    safeLocalStorage.setItem('coalesce', 'v1');
    safeLocalStorage.setItem('coalesce', 'v2');
    safeLocalStorage.setItem('coalesce', 'v3');

    vi.advanceTimersByTime(500);

    expect(mockIdbStore.get('coalesce')).toBe('v3');
  });

  it('key() method returns all keys including newly added ones', async () => {
    const { safeLocalStorage } = await importStorage();

    safeLocalStorage.setItem('key-a', 'a');
    safeLocalStorage.setItem('key-b', 'b');
    safeLocalStorage.setItem('key-c', 'c');

    const keys: string[] = [];
    for (let i = 0; i < safeLocalStorage.length; i++) {
      const k = safeLocalStorage.key(i);
      if (k) keys.push(k);
    }

    expect(keys).toEqual(expect.arrayContaining(['key-a', 'key-b', 'key-c']));
    expect(keys).toHaveLength(3);
  });
});
