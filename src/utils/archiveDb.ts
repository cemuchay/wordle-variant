// src/utils/archiveDb.ts

import { openDB, type IDBPDatabase } from 'idb';

export interface ArchiveGameRecord {
  date: string; // YYYY-MM-DD
  word: string;
  guesses: string[];
  isGameOver: boolean;
  isWon: boolean;
  score: number;
  attempts: number;
  playedAt: string;
  completedAt?: string;
}

const DB_NAME = 'variant-archive-games-db';
const DB_VERSION = 1;
const ARCHIVE_STORE = 'archive_games';

export const FIRST_ARCHIVE_DATE = '2026-05-18';

let dbInstance: IDBPDatabase | null = null;

async function getArchiveDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
        const store = db.createObjectStore(ARCHIVE_STORE, { keyPath: 'date' });
        store.createIndex('isGameOver', 'isGameOver', { unique: false });
        store.createIndex('isWon', 'isWon', { unique: false });
      }
    },
  });
  return dbInstance;
}

export async function getArchiveGame(date: string): Promise<ArchiveGameRecord | null> {
  try {
    const db = await getArchiveDB();
    const entry = await db.get(ARCHIVE_STORE, date);
    return entry || null;
  } catch (err) {
    console.warn('[archiveDb] getArchiveGame error:', err);
    return null;
  }
}

export async function saveArchiveGame(record: ArchiveGameRecord): Promise<void> {
  try {
    const db = await getArchiveDB();
    await db.put(ARCHIVE_STORE, record);
  } catch (err) {
    console.warn('[archiveDb] saveArchiveGame error:', err);
  }
}

export async function getAllArchiveGames(): Promise<ArchiveGameRecord[]> {
  try {
    const db = await getArchiveDB();
    return (await db.getAll(ARCHIVE_STORE)) || [];
  } catch (err) {
    console.warn('[archiveDb] getAllArchiveGames error:', err);
    return [];
  }
}

export async function getCompletedArchiveDates(): Promise<Set<string>> {
  try {
    const games = await getAllArchiveGames();
    const completedSet = new Set<string>();
    games.forEach((game) => {
      if (game.isGameOver && game.isWon) {
        completedSet.add(game.date);
      }
    });
    return completedSet;
  } catch (err) {
    console.warn('[archiveDb] getCompletedArchiveDates error:', err);
    return new Set();
  }
}

export function getYesterdayArchiveDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

export function getAllValidArchiveDates(): string[] {
  const dates: string[] = [];
  const start = new Date(FIRST_ARCHIVE_DATE);
  const end = new Date(getYesterdayArchiveDate());

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
