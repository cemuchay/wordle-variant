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

  constructor(type: StorageType) {
    this.type = type;
    this.isAvailable = this.checkAvailability();
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
    if (this.isAvailable) {
      try {
        const storage = this.getUnderlyingStorage();
        if (storage) {
          storage.setItem(key, value);
          return;
        }
      } catch (e) {
        console.warn(`[SafeStorage] failed to write "${key}" to native storage:`, e);
      }
    }
    this.memoryStore[key] = String(value);
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
