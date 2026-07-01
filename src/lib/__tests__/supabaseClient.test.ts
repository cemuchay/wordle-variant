import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/indexedDBStorage', () => ({
  asyncGetItem: vi.fn(),
  asyncSetItem: vi.fn(),
  asyncRemoveItem: vi.fn(),
  asyncGetAllEntries: vi.fn(async () => []),
}));

beforeEach(() => {
  vi.resetModules();
});

describe('supabaseClient', () => {
  it('exports a supabase client instance', async () => {
    const { supabase } = await import('../supabaseClient');
    expect(supabase).toBeDefined();
  });

  it('asyncStorage has getItem, setItem, removeItem methods', async () => {
    const storageMod = await import('../../utils/storage');

    expect(typeof storageMod.asyncStorage.getItem).toBe('function');
    expect(typeof storageMod.asyncStorage.setItem).toBe('function');
    expect(typeof storageMod.asyncStorage.removeItem).toBe('function');
  });
});
