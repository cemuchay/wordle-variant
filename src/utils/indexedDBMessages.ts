/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDB, MESSAGES_STORE } from './indexedDBStorage';

export async function getAllMessages(): Promise<any[]> {
   const db = await getDB();
   return db.getAll(MESSAGES_STORE);
}

export async function saveMessages(messages: any[]): Promise<void> {
   if (messages.length === 0) return;
   const db = await getDB();
   const tx = db.transaction(MESSAGES_STORE, 'readwrite');
   for (const msg of messages) {
      tx.store.put(msg);
   }
   await tx.done;
}

export async function addMessage(message: any): Promise<void> {
   const db = await getDB();
   await db.put(MESSAGES_STORE, message);
}

export async function updateMessage(id: string, updates: Record<string, any>): Promise<void> {
   const db = await getDB();
   const existing = await db.get(MESSAGES_STORE, id);
   if (existing) {
      await db.put(MESSAGES_STORE, { ...existing, ...updates });
   }
}

export async function removeMessage(id: string): Promise<void> {
   const db = await getDB();
   await db.delete(MESSAGES_STORE, id);
}

export async function getLatestMessageTimestamp(): Promise<string | null> {
   const db = await getDB();
   const index = db.transaction(MESSAGES_STORE).store.index('created_at');
   const cursor = await index.openCursor(null, 'prev');
   return cursor ? cursor.value.created_at : null;
}

export async function purgeMessagesOlderThan(days: number): Promise<void> {
   const cutoff = new Date();
   cutoff.setDate(cutoff.getDate() - days);
   const cutoffStr = cutoff.toISOString();

   const db = await getDB();
   const index = db.transaction(MESSAGES_STORE, 'readwrite').store.index('created_at');
   let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoffStr));

   while (cursor) {
      cursor.delete();
      cursor = await cursor.continue();
   }
}
