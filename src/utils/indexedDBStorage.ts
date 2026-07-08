import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'variant-app-db';
const DB_VERSION = 2;
const STORE_NAME = 'keyvalue';
const MESSAGES_STORE = 'messages';

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        store.createIndex('group_id', 'group_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    },
  });
  return dbInstance;
}

export async function asyncGetItem(key: string): Promise<string | null> {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, key);
  return entry ? entry.value : null;
}

export async function asyncSetItem(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { key, value });
}

export async function asyncRemoveItem(key: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, key);
}

export { getDB, MESSAGES_STORE };

export async function asyncClear(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function asyncGetAllKeys(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys(STORE_NAME) as Promise<string[]>;
}

export async function asyncGetAllEntries(): Promise<Array<{ key: string; value: string }>> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}
