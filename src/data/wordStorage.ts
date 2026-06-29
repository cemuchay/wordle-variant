const DB_NAME = 'wordle_word_cache';
const DB_VERSION = 1;
const STORE_NAME = 'word_lists';

export const WORD_DATA_VERSION = '1';

interface StoredWordList {
    length: number;
    version: string;
    official: string[];
    valid: string[];
    storedAt: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                req.result.createObjectStore(STORE_NAME, { keyPath: 'length' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function getCachedWords(length: number): Promise<{ official: string[]; valid: string[] } | null> {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(length);
            req.onsuccess = () => {
                const data = req.result as StoredWordList | undefined;
                if (data && data.version === WORD_DATA_VERSION) {
                    resolve({ official: data.official, valid: data.valid });
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

export async function cacheWords(length: number, official: string[], valid: Set<string>): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({
                length,
                version: WORD_DATA_VERSION,
                official,
                valid: [...valid],
                storedAt: Date.now(),
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* silent */ }
}
