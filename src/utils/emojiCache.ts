// src/utils/emojiCache.ts
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'variant-emoji-db';
const DB_VERSION = 1;
const STORE_NAME = 'twemoji_svgs';
const TWEMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

let dbPromise: Promise<IDBPDatabase> | null = null;

// Synchronous fast memory cache for instantaneous 0ms rendering
const memoryCache = new Map<string, string>(); // hex -> objectUrl
const pendingFetches = new Map<string, Promise<string | null>>();
const subscribers = new Map<string, Set<(url: string) => void>>();

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'hex' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Synchronously checks if an emoji SVG URL is already in memory.
 */
export function getMemoryEmoji(hex: string): string | null {
  return memoryCache.get(hex) || null;
}

/**
 * Subscribes to when a specific emoji SVG finishes loading into memory.
 * Returns an unsubscribe function.
 */
export function subscribeEmoji(hex: string, callback: (url: string) => void): () => void {
  let set = subscribers.get(hex);
  if (!set) {
    set = new Set();
    subscribers.set(hex, set);
  }
  set.add(callback);

  return () => {
    const existing = subscribers.get(hex);
    if (existing) {
      existing.delete(callback);
      if (existing.size === 0) {
        subscribers.delete(hex);
      }
    }
  };
}

function notifySubscribers(hex: string, url: string) {
  const set = subscribers.get(hex);
  if (set) {
    set.forEach((cb) => {
      try {
        cb(url);
      } catch (err) {
        console.error('Error notifying emoji subscriber:', err);
      }
    });
    subscribers.delete(hex);
  }
}

/**
 * Asynchronously loads an emoji SVG, checking IndexedDB first,
 * then falling back to remote CDN fetch. Stores result in IndexedDB & memory.
 */
export async function loadEmojiSvg(hex: string): Promise<string | null> {
  // 1. In-memory check
  const inMem = memoryCache.get(hex);
  if (inMem) return inMem;

  // 2. Pending fetch deduplication
  const existingFetch = pendingFetches.get(hex);
  if (existingFetch) return existingFetch;

  const fetchPromise = (async () => {
    try {
      // 3. IndexedDB check
      const db = await getDB();
      const entry = await db.get(STORE_NAME, hex);
      if (entry && entry.svg) {
        const blob = new Blob([entry.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        memoryCache.set(hex, url);
        notifySubscribers(hex, url);
        return url;
      }

      // 4. Remote CDN fetch in background
      const res = await fetch(`${TWEMOJI_BASE_URL}/${hex}.svg`);
      if (!res.ok) {
        return null;
      }

      const svgText = await res.text();
      // Save to IndexedDB
      await db.put(STORE_NAME, {
        hex,
        svg: svgText,
        cachedAt: Date.now(),
      });

      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      memoryCache.set(hex, url);
      notifySubscribers(hex, url);
      return url;
    } catch (err) {
      console.warn(`Failed to cache twemoji for hex ${hex}:`, err);
      return null;
    } finally {
      pendingFetches.delete(hex);
    }
  })();

  pendingFetches.set(hex, fetchPromise);
  return fetchPromise;
}
