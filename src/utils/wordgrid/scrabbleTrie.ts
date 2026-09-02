// src/utils/wordgrid/scrabbleTrie.ts

const DB_NAME = 'wordle_word_cache';
const DB_VERSION = 1;
const STORE_NAME = 'word_lists';
const SCRABBLE_CACHE_KEY = 'scrabble_csw21_trie_v1';

export interface TrieNode {
  [key: string]: TrieNode | number;
}

export class ScrabbleTrie {
  private root: TrieNode;

  constructor(root: TrieNode = {}) {
    this.root = root;
  }

  /**
   * Checks whether a word exists in the Scrabble dictionary.
   */
  public isWord(word: string): boolean {
    const w = word.trim().toUpperCase();
    if (w.length < 2) return false;

    let curr: any = this.root;
    for (let i = 0; i < w.length; i++) {
      const char = w[i];
      if (!curr || typeof curr !== 'object') {
        return false;
      }
      curr = curr[char];
      if (!curr) {
        return false;
      }
    }

    if (curr === 1) return true;
    if (typeof curr === 'object' && curr['$'] === 1) return true;
    return false;
  }

  /**
   * Checks whether any valid word starts with this prefix.
   * Crucial for branch pruning in bot word searches.
   */
  public hasPrefix(prefix: string): boolean {
    const p = prefix.trim().toUpperCase();
    if (p.length === 0) return true;

    let curr: any = this.root;
    for (let i = 0; i < p.length; i++) {
      const char = p[i];
      if (!curr || typeof curr !== 'object') {
        return false;
      }
      curr = curr[char];
      if (!curr) {
        return false;
      }
    }
    return true;
  }
}

// Memory singleton & in-flight load promise
let trieInstance: ScrabbleTrie | null = null;
let loadPromise: Promise<ScrabbleTrie> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME, { keyPath: 'length' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getCachedTrie(): Promise<TrieNode | null> {
  try {
    const db = await openDB();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SCRABBLE_CACHE_KEY);
      req.onsuccess = () => {
        if (req.result && req.result.trie) {
          resolve(req.result.trie);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cacheTrie(trie: TrieNode): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        length: SCRABBLE_CACHE_KEY,
        trie,
        storedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore caching write errors
  }
}

/**
 * Loads the Scrabble Trie singleton, utilizing IndexedDB and memory caching.
 */
export async function loadScrabbleDictionary(): Promise<ScrabbleTrie> {
  if (trieInstance) return trieInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // 1. Try IndexedDB
    const cached = await getCachedTrie();
    if (cached) {
      trieInstance = new ScrabbleTrie(cached);
      return trieInstance;
    }

    // 2. Fetch from static public asset (or Node fs in test/node environments)
    try {
      let rawTrie: TrieNode;
      const gProcess = (globalThis as any).process;
      if (typeof window === 'undefined' || typeof fetch === 'undefined' || (gProcess && gProcess.env?.NODE_ENV === 'test')) {
        // Node / Vitest environment
        const fsMod = 'fs';
        const pathMod = 'path';
        const fs = await import(/* @vite-ignore */ fsMod);
        const path = await import(/* @vite-ignore */ pathMod);
        const cwd = gProcess?.cwd ? gProcess.cwd() : '';
        const triePath = path.resolve(cwd, 'public/words/scrabble/csw21_trie.json');
        const content = fs.readFileSync(triePath, 'utf-8');
        rawTrie = JSON.parse(content);
      } else {
        const res = await fetch('/words/scrabble/csw21_trie.json');
        if (!res.ok) {
          throw new Error(`Failed to load trie: ${res.statusText}`);
        }
        rawTrie = await res.json();
      }

      trieInstance = new ScrabbleTrie(rawTrie);
      // Cache asynchronously in browser
      cacheTrie(rawTrie).catch(() => {});
      return trieInstance;
    } catch (e) {
      console.warn('Scrabble Trie fetch failed, using fallback empty trie', e);
      trieInstance = new ScrabbleTrie({});
      return trieInstance;
    }
  })();

  return loadPromise;
}

/**
 * Get active Trie instance synchronously if already loaded
 */
export function getScrabbleTrie(): ScrabbleTrie | null {
  return trieInstance;
}
