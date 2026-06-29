import {
  asyncGetItem as idbGetItem,
  asyncSetItem as idbSetItem,
  asyncRemoveItem as idbRemoveItem,
  asyncGetAllEntries as idbGetAllEntries,
} from './indexedDBStorage';

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
    }, 500);
    this._flushTimers.set(key, timer);
  }

  private checkAvailability(): boolean {
    try {
      const storage = this.getUnderlyingStorage();
      if (!storage) return false;
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  private getUnderlyingStorage(): Storage | null {
    return this.type === 'local' ? originalLocalStorage : originalSessionStorage;
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
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          storage.setItem(key, value);
        }
      } catch (e) {
        console.warn(`[SafeStorage] failed to write "${key}" to native storage:`, e);
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

export const safeLocalStorage = new SafeStorage('local');
export const safeSessionStorage = new SafeStorage('session');

export const asyncStorage = {
  getItem: async (key: string) => safeLocalStorage.getItem(key),
  setItem: async (key: string, value: string) => { safeLocalStorage.setItem(key, value); },
  removeItem: async (key: string) => { safeLocalStorage.removeItem(key); },
};

export async function runLegacyMigration(): Promise<void> {
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
