import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDBPDatabase } from 'idb';

type Store = Map<string, { key: string; value: string }>;

let mockStore: Store = new Map();

const mockDb = {
  get: vi.fn(async (storeName: string, key: string) => mockStore.get(key) ?? null),
  put: vi.fn(async (storeName: string, entry: { key: string; value: string }) => {
    mockStore.set(entry.key, entry);
  }),
  delete: vi.fn(async (storeName: string, key: string) => {
    mockStore.delete(key);
  }),
  clear: vi.fn(async (storeName: string) => {
    mockStore.clear();
  }),
  getAllKeys: vi.fn(async (storeName: string) => Array.from(mockStore.keys())),
  getAll: vi.fn(async (storeName: string) => Array.from(mockStore.values())),
  objectStoreNames: { contains: vi.fn(() => true) },
};

let dbInstance: IDBPDatabase | null = null;

vi.mock('idb', () => ({
  openDB: vi.fn(async () => dbInstance),
}));

vi.mock('../indexedDBStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../indexedDBStorage')>();
  return {
    ...actual,
    getDB: vi.fn(async () => dbInstance),
  };
});

beforeEach(() => {
  mockStore = new Map();
  dbInstance = mockDb as unknown as IDBPDatabase;
  vi.clearAllMocks();
});

describe('indexedDBStorage', () => {
  it('asyncSetItem / asyncGetItem round-trip for string values', async () => {
    const { asyncSetItem, asyncGetItem } = await import('../indexedDBStorage');

    await asyncSetItem('test-key', 'hello world');
    const result = await asyncGetItem('test-key');

    expect(result).toBe('hello world');
    expect(mockDb.put).toHaveBeenCalledWith('keyvalue', { key: 'test-key', value: 'hello world' });
    expect(mockDb.get).toHaveBeenCalledWith('keyvalue', 'test-key');
  });

  it('asyncGetItem returns null for missing keys', async () => {
    const { asyncGetItem } = await import('../indexedDBStorage');

    const result = await asyncGetItem('nonexistent-key');

    expect(result).toBeNull();
  });

  it('asyncRemoveItem removes existing key', async () => {
    const { asyncSetItem, asyncGetItem, asyncRemoveItem } = await import('../indexedDBStorage');

    await asyncSetItem('remove-me', 'value');
    expect(await asyncGetItem('remove-me')).toBe('value');

    await asyncRemoveItem('remove-me');
    expect(await asyncGetItem('remove-me')).toBeNull();
    expect(mockDb.delete).toHaveBeenCalledWith('keyvalue', 'remove-me');
  });

  it('asyncClear removes all entries', async () => {
    const { asyncSetItem, asyncGetItem, asyncClear } = await import('../indexedDBStorage');

    await asyncSetItem('key1', 'val1');
    await asyncSetItem('key2', 'val2');
    await asyncClear();

    expect(await asyncGetItem('key1')).toBeNull();
    expect(await asyncGetItem('key2')).toBeNull();
    expect(mockDb.clear).toHaveBeenCalledWith('keyvalue');
  });

  it('asyncGetAllKeys returns only stored keys', async () => {
    const { asyncSetItem, asyncGetAllKeys } = await import('../indexedDBStorage');

    await asyncSetItem('alpha', '1');
    await asyncSetItem('beta', '2');

    const keys = await asyncGetAllKeys();
    expect(keys).toEqual(expect.arrayContaining(['alpha', 'beta']));
    expect(keys).toHaveLength(2);
  });

  it('asyncGetAllEntries returns key-value pairs', async () => {
    const { asyncSetItem, asyncGetAllEntries } = await import('../indexedDBStorage');

    await asyncSetItem('a', '1');
    await asyncSetItem('b', '2');

    const entries = await asyncGetAllEntries();
    expect(entries).toEqual(
      expect.arrayContaining([
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ]),
    );
    expect(entries).toHaveLength(2);
  });
});
