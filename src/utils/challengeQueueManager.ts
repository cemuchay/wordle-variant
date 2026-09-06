/* eslint-disable @typescript-eslint/no-explicit-any */
import { safeLocalStorage, safeSessionStorage } from './storage';
import { asyncGetAllKeys, asyncRemoveItem, getDB, OUTBOX_STORE } from './indexedDBStorage';
import { supabase } from '../lib/supabaseClient';

export interface PendingChallengeGame {
  key: string;
  challengeId: string;
  subKey: string;
  timestamp: number;
  attempts?: number;
  score?: number;
  status: string;
  payload: any;
  wordLength?: number;
  gameIndex?: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Automatically prunes any challenge queue/progress item older than 7 days from localStorage.
 * Returns the count of keys deleted.
 */
export function pruneStaleChallengeQueue(): number {
  let prunedCount = 0;
  const now = Date.now();

  try {
    const keysToCheck: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('challenge-prog-') || key.startsWith('challenge-view-state-'))) {
        keysToCheck.push(key);
      }
    }

    for (const key of keysToCheck) {
      const raw = safeLocalStorage.getItem(key);
      if (!raw) continue;

      try {
        const item = JSON.parse(raw);
        const itemTimestamp = typeof item.timestamp === 'number' ? item.timestamp : null;

        // If the item has a valid timestamp and is older than 7 days, delete it
        if (itemTimestamp && now - itemTimestamp > SEVEN_DAYS_MS) {
          safeLocalStorage.removeItem(key);
          prunedCount++;
        }
      } catch {
        // Corrupted JSON - remove it safely
        safeLocalStorage.removeItem(key);
        prunedCount++;
      }
    }
  } catch (err) {
    console.warn('[ChallengeQueueManager] Failed to prune stale queue items:', err);
  }

  return prunedCount;
}

/**
 * Scans localStorage for any challenge games that have completed or have pending results
 * waiting to be synced (needsSync === true).
 */
export function getPendingChallengeUploads(): PendingChallengeGame[] {
  const pending: PendingChallengeGame[] = [];
  const now = Date.now();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('challenge-prog-')) continue;

      const raw = safeLocalStorage.getItem(key);
      if (!raw) continue;

      try {
        const data = JSON.parse(raw);
        if (!data || !data.needsSync) continue;

        const timestamp = typeof data.timestamp === 'number' ? data.timestamp : now;
        // Ignore if older than 7 days (will be pruned)
        if (now - timestamp > SEVEN_DAYS_MS) continue;

        // Extract challenge ID from key: challenge-prog-${challengeId}-${subKey}
        // subKey can be 'r', 'm-3', 'm-4', 'main', etc.
        const parts = key.replace('challenge-prog-', '').split('-');
        const challengeId = parts[0];
        const subKey = parts.slice(1).join('-');

        let wordLength: number | undefined;
        let gameIndex: number | undefined;

        if (subKey.startsWith('m-')) {
          const parsedLen = parseInt(subKey.replace('m-', ''), 10);
          if (!isNaN(parsedLen)) wordLength = parsedLen;
        }

        if (typeof data.gameIndex === 'number') {
          gameIndex = data.gameIndex;
        } else if (typeof data.game_index === 'number') {
          gameIndex = data.game_index;
        }

        pending.push({
          key,
          challengeId,
          subKey,
          timestamp,
          attempts: data.attempts,
          score: data.score,
          status: data.status || 'completed',
          payload: data,
          wordLength,
          gameIndex,
        });
      } catch {
        // Skip unparseable entries
      }
    }
  } catch (err) {
    console.warn('[ChallengeQueueManager] Failed to read pending uploads:', err);
  }

  // Sort newest first
  return pending.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Uploads a single pending challenge result to the database via Supabase.
 */
export async function syncSinglePendingChallenge(item: PendingChallengeGame): Promise<boolean> {
  try {
    const { challengeId, payload, wordLength, gameIndex, key } = item;

    // Determine participation id
    let participationId = payload.participation_id || payload.participationId;

    if (!participationId) {
      // Look up the current participation for this challenge
      const { data: partData, error: partError } = await supabase
        .from('challenge_participants')
        .select('id, challenge:challenges(word_length, is_bot_marathon)')
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (partError || !partData) {
        console.warn(`[ChallengeQueueManager] Cannot find participation for challenge ${challengeId}`, partError);
        return false;
      }
      participationId = partData.id;
    }

    const cleanPayload = { ...payload };
    delete cleanPayload.needsSync;
    delete cleanPayload.timestamp;

    if (wordLength !== undefined || gameIndex !== undefined) {
      // Marathon sub-game
      const resolvedGameIndex = gameIndex !== undefined ? gameIndex : (wordLength ? wordLength - 3 : 0);
      const playDate = payload.play_date || payload.playDate || '1970-01-01';

      const updateData: any = {
        participation_id: participationId,
        challenge_id: challengeId,
        game_index: resolvedGameIndex,
        word_length: wordLength || 5,
        play_date: playDate,
        ...cleanPayload,
      };

      if (cleanPayload.status && cleanPayload.status !== 'playing') {
        updateData.completed_at = cleanPayload.completed_at || new Date().toISOString();
      }

      const { error: mError } = await supabase
        .from('challenge_participants_marathon')
        .upsert(updateData, { onConflict: 'participation_id,game_index,play_date' });

      if (mError) {
        console.error('[ChallengeQueueManager] Failed to sync marathon result:', mError);
        return false;
      }
    } else {
      // Regular challenge result
      const updateData: any = { ...cleanPayload };
      if (cleanPayload.status && cleanPayload.status !== 'playing') {
        updateData.completed_at = cleanPayload.completed_at || new Date().toISOString();
      }

      const { error: rError } = await supabase
        .from('challenge_participants')
        .update(updateData)
        .eq('id', participationId);

      if (rError) {
        console.error('[ChallengeQueueManager] Failed to sync challenge result:', rError);
        return false;
      }
    }

    // On success: remove key from localStorage or mark needsSync = false
    safeLocalStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error('[ChallengeQueueManager] Error during sync single challenge:', err);
    return false;
  }
}

/**
 * Batch syncs all pending challenge games.
 */
export async function syncAllPendingChallenges(): Promise<{ successCount: number; failCount: number }> {
  const pending = getPendingChallengeUploads();
  let successCount = 0;
  let failCount = 0;

  for (const item of pending) {
    const ok = await syncSinglePendingChallenge(item);
    if (ok) {
      successCount++;
    } else {
      failCount++;
    }
  }

  return { successCount, failCount };
}

/**
 * Clears ALL local challenge data across localStorage, sessionStorage, and IndexedDB.
 * - Removes challenge-prog-*, challenge-*, wordle_challenge_*, wordle_recent_challenges, etc.
 * - Cleans session storage keys related to challenges
 * - Clears any challenge entries cached in IndexedDB
 */
export async function clearAllChallengeLocalData(): Promise<void> {
  try {
    // 1. LocalStorage
    const lsKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        key.startsWith('challenge-') ||
        key.startsWith('challenge_') ||
        key.startsWith('wordle_challenge') ||
        key.startsWith('wordle_recent_challenges') ||
        key.startsWith('wordle_discover_challenges_cache') ||
        key.startsWith('challenge-view-state-')
      ) {
        lsKeysToRemove.push(key);
      }
    }

    for (const k of lsKeysToRemove) {
      safeLocalStorage.removeItem(k);
    }

    // 2. SessionStorage
    const ssKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;

      if (
        key.startsWith('challenge-') ||
        key.startsWith('challenge_') ||
        key.startsWith('wordle_challenge')
      ) {
        ssKeysToRemove.push(key);
      }
    }

    for (const k of ssKeysToRemove) {
      safeSessionStorage.removeItem(k);
    }

    // 3. IndexedDB keyvalue & outbox stores
    try {
      const idbKeys = await asyncGetAllKeys();
      for (const k of idbKeys) {
        if (
          typeof k === 'string' &&
          (k.startsWith('challenge') || k.includes('challenge'))
        ) {
          await asyncRemoveItem(k);
        }
      }

      // Check if there are any challenge items in IndexedDB outbox store
      const db = await getDB();
      if (db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outboxKeys = await db.getAllKeys(OUTBOX_STORE);
        for (const obk of outboxKeys) {
          const entry = await db.get(OUTBOX_STORE, obk);
          if (entry && (entry.action?.includes?.('challenge') || entry.request?.table?.includes?.('challenge'))) {
            await db.delete(OUTBOX_STORE, obk);
          }
        }
      }
    } catch (idbErr) {
      console.warn('[ChallengeQueueManager] Error clearing IndexedDB challenge records:', idbErr);
    }
  } catch (err) {
    console.error('[ChallengeQueueManager] Failed to clear challenge local data:', err);
  }
}
