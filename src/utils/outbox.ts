/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDB, OUTBOX_STORE } from './indexedDBStorage';

export interface OutboxEntry {
   id: string;
   kind: 'text' | 'voice' | 'image';
   payload: any;
   fallbackText?: string;
   blob?: Blob;
   groupId: string;
   createdAt: string;
}

export async function getOutbox(): Promise<OutboxEntry[]> {
   const db = await getDB();
   return db.getAll(OUTBOX_STORE);
}

export async function putOutbox(entry: OutboxEntry): Promise<void> {
   const db = await getDB();
   await db.put(OUTBOX_STORE, entry);
}

export async function removeOutbox(id: string): Promise<void> {
   const db = await getDB();
   await db.delete(OUTBOX_STORE, id);
}

export async function purgeOldOutbox(days = 7): Promise<void> {
   const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
   const db = await getDB();
   const tx = db.transaction(OUTBOX_STORE, 'readwrite');
   let cursor = await tx.store.openCursor();
   while (cursor) {
      const entry = cursor.value as OutboxEntry;
      if (new Date(entry.createdAt).getTime() < cutoff) {
         await cursor.delete();
      }
      cursor = await cursor.continue();
   }
}
