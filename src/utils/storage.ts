import {
  asyncGetItem as idbGetItem,
  asyncSetItem as idbSetItem,
  asyncRemoveItem as idbRemoveItem,
  asyncGetAllEntries as idbGetAllEntries,
} from './indexedDBStorage';
import { TIMEOUT } from '../constants/game';

type StorageType = 'local' | 'session';

const originalLocalStorage = (() => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
})();

const originalSessionStorage = (() => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
})();

class SafeStorage implements Storage {
  private type: StorageType;
  private memoryStore: Record<string, string> = {};
  private isAvailable: boolean;
  private _hydrated = false;
  private _hydratePromise: Promise<void> | null = null;
  private _flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(type: StorageType) {
    this.type = type;
    this.isAvailable = this.checkAvailability();
  }

  async hydrateFromDB(): Promise<void> {
    if (this._hydrated) return;
    if (this._hydratePromise) return this._hydratePromise;
    this._hydratePromise = (async () => {
      try {
        const entries = await idbGetAllEntries();
        for (const { key, value } of entries) {
          this.memoryStore[key] = value;
        }
        this._hydrated = true;
      } catch (e) {
        console.warn(`[SafeStorage] IndexedDB hydration failed for ${this.type}:`, e);
      }
    })();
    return this._hydratePromise;
  }

  private _scheduleFlush(key: string): void {
    const existing = this._flushTimers.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this._flushTimers.delete(key);
      const value = this.memoryStore[key];
      if (value !== undefined) {
        idbSetItem(key, value).catch((e) =>
          console.warn(`[SafeStorage] IndexedDB write failed for "${key}":`, e),
        );
      }
    }, TIMEOUT.STORAGE_FLUSH);
    this._flushTimers.set(key, timer);
  }

  private checkAvailability(): boolean {
    const storage = this.getUnderlyingStorage();
    if (!storage) return false;
    try {
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch {
      return true; // Still available for memory & fallback writes
    }
  }

  private getUnderlyingStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
      return this.type === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return this.type === 'local' ? originalLocalStorage : originalSessionStorage;
    }
  }

  get length(): number {
    let nativeKeys = new Set<string>();
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) nativeKeys.add(key);
          }
        }
      } catch {}
    }
    const allKeys = new Set([...nativeKeys, ...Object.keys(this.memoryStore)]);
    return allKeys.size;
  }

  clear(): void {
    this.memoryStore = {};
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          storage.clear();
        }
      } catch {}
    }
  }

  getItem(key: string): string | null {
    if (Object.prototype.hasOwnProperty.call(this.memoryStore, key)) {
      return this.memoryStore[key];
    }
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          return storage.getItem(key);
        }
      } catch {}
    }
    return null;
  }

  key(index: number): string | null {
    let nativeKeys = new Set<string>();
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) nativeKeys.add(key);
          }
        }
      } catch {}
    }
    const allKeys = Array.from(new Set([...nativeKeys, ...Object.keys(this.memoryStore)]));
    return index >= 0 && index < allKeys.length ? allKeys[index] : null;
  }

  removeItem(key: string): void {
    delete this.memoryStore[key];
    const existing = this._flushTimers.get(key);
    if (existing) clearTimeout(existing);
    this._flushTimers.delete(key);
    idbRemoveItem(key).catch((e) =>
      console.warn(`[SafeStorage] IndexedDB remove failed for "${key}":`, e),
    );
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          storage.removeItem(key);
        }
      } catch {}
    }
  }

  setItem(key: string, value: string): void {
    this.memoryStore[key] = String(value);
    if (this.isAvailable) {
      const storage = this.getUnderlyingStorage();
      if (storage) {
        try {
          storage.setItem(key, value);
        } catch (e) {
          if (isQuotaExceededError(e)) {
            console.warn(`[SafeStorage] Quota exceeded on "${key}", running auto-purge...`);
            purgeStaleStorage();
            try {
              storage.setItem(key, value);
            } catch (retryErr) {
              console.warn(`[SafeStorage] Write still failed after purge for "${key}". Backed by memory & IndexedDB.`, retryErr);
            }
          } else {
            console.warn(`[SafeStorage] failed to write "${key}" to native storage:`, e);
          }
        }
      }
    }
    this._scheduleFlush(key);
  }

  getAllKeys(): string[] {
    let nativeKeys = new Set<string>();
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key) nativeKeys.add(key);
          }
        }
      } catch {}
    }
    return Array.from(new Set([...nativeKeys, ...Object.keys(this.memoryStore)]));
  }
}

export function isQuotaExceededError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof DOMException) {
    return (
      e.code === 22 ||
      e.code === 1014 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  if (typeof e === 'object' && 'name' in e) {
    const name = (e as any).name;
    const message = (e as any).message || '';
    return (
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      message.includes('QuotaExceededError') ||
      message.includes('quota')
    );
  }
  return false;
}

/**
 * Returns estimated bytes occupied in LocalStorage and percentage of standard 5MB quota.
 */
export function getStorageUsage(): { bytes: number; percentage: number } {
  let totalBytes = 0;
  if (originalLocalStorage) {
    try {
      for (let i = 0; i < originalLocalStorage.length; i++) {
        const key = originalLocalStorage.key(i);
        if (!key) continue;
        const val = originalLocalStorage.getItem(key) || '';
        // UTF-16 strings take ~2 bytes per character
        totalBytes += (key.length + val.length) * 2;
      }
    } catch {}
  }
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  return {
    bytes: totalBytes,
    percentage: Math.min(100, Math.round((totalBytes / MAX_BYTES) * 100 * 10) / 10),
  };
}

/**
 * Intelligently evicts stale, non-critical entries from LocalStorage:
 * - Daily games older than 7 days that are already synced (status won/lost, !needsSync)
 * - Backup keys for old daily games
 * - Finished challenge progress keys
 * - Match history caches
 * - Telemetry batches
 * 
 * Never evicts:
 * - Supabase auth sessions
 * - Active uncompleted games (status 'playing' or needsSync === true)
 * - User preferences, streaks, stats
 */
export function purgeStaleStorage(): number {
  const storage = typeof window !== 'undefined' ? window.localStorage : originalLocalStorage;
  if (!storage) return 0;

  const keysToRemove: string[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;

      // 1. Old Daily Game Keys: wordle-YYYY-MM-DD and backups
      if (key.startsWith('wordle-') && !key.includes('active') && !key.includes('statistics') && !key.includes('preferences')) {
        const cleanKey = key.replace('-backup', '');
        const dateMatch = cleanKey.match(/^wordle-(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch && dateMatch[1] < sevenDaysAgo) {
          const raw = storage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (!parsed.needsSync && (parsed.status === 'won' || parsed.status === 'lost')) {
                keysToRemove.push(key);
              }
            } catch {
              keysToRemove.push(key);
            }
          }
        }
      }

      // 2. Finished Challenge Progress keys
      if (key.startsWith('challenge-prog-')) {
        const raw = storage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (!parsed.needsSync && (parsed.status === 'completed' || parsed.status === 'timed_out')) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }

      // 3. Stale view states & temporary caches
      if (
        key.startsWith('challenge-view-state-') ||
        key === 'wordup_cached_history_matches' ||
        key === 'wordup_cached_async_history_matches' ||
        key === 'wordup_seen_matches'
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      safeLocalStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('[SafeStorage] Auto-purge failed:', e);
  }

  return keysToRemove.length;
}

export const safeLocalStorage = new SafeStorage('local');
export const safeSessionStorage = new SafeStorage('session');

export const asyncStorage = {
  getItem: async (key: string) => safeLocalStorage.getItem(key),
  setItem: async (key: string, value: string) => { safeLocalStorage.setItem(key, value); },
  removeItem: async (key: string) => { safeLocalStorage.removeItem(key); },
};

export async function runLegacyMigration(): Promise<void> {
  // Run proactive auto-purge of stale items on boot
  try {
    purgeStaleStorage();
  } catch {}

  const alreadyMigrated = await idbGetItem('__migrated_v2');
  if (alreadyMigrated) return;
  try {
    if (!originalLocalStorage) return;
    const keysToMigrate: string[] = [];
    for (let i = 0; i < originalLocalStorage.length; i++) {
      const key = originalLocalStorage.key(i);
      if (key) keysToMigrate.push(key);
    }
    for (const key of keysToMigrate) {
      const value = originalLocalStorage.getItem(key);
      if (value !== null) {
        await idbSetItem(key, value);
      }
    }
    await idbSetItem('__migrated_v2', 'true');
    for (const key of keysToMigrate) {
      originalLocalStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('[Migration] Failed to migrate localStorage to IndexedDB:', e);
  }
}
