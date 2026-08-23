// src/utils/wordgrid/draftStorage.ts

import { safeLocalStorage } from '../storage';
import type { PlacedTile } from './constants';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const DRAFT_KEY_PREFIX = 'wordgrid_draft_';

export interface WordGridDraft {
  placedTiles: PlacedTile[];
  rack: string[];
  savedAt: number;
}

const draftSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function draftKey(matchId: string): string {
  return `${DRAFT_KEY_PREFIX}${matchId}`;
}

/**
 * Debounced draft save (300ms). Uses safeLocalStorage which persists to
 * memory + localStorage synchronously and flushes IndexedDB automatically.
 */
export function scheduleWordGridDraftSave(
  matchId: string | null,
  getDraft: () => WordGridDraft | null
): void {
  if (!matchId) return;
  const existing = draftSaveTimers.get(matchId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    draftSaveTimers.delete(matchId);
    try {
      const draft = getDraft();
      if (draft && matchId) {
        safeLocalStorage.setItem(draftKey(matchId), JSON.stringify(draft));
      }
    } catch (e) {
      console.warn('[WordGridDraft] Save failed:', e);
    }
  }, 300);
  draftSaveTimers.set(matchId, timer);
}

export function cancelWordGridDraftSave(matchId: string | null): void {
  if (!matchId) return;
  const existing = draftSaveTimers.get(matchId);
  if (existing) clearTimeout(existing);
  draftSaveTimers.delete(matchId);
}

export function clearWordGridDraft(matchId: string | null): void {
  if (!matchId) return;
  cancelWordGridDraftSave(matchId);
  try {
    safeLocalStorage.removeItem(draftKey(matchId));
  } catch (e) {
    console.warn('[WordGridDraft] Clear failed:', e);
  }
}

export function loadWordGridDraft(matchId: string | null): WordGridDraft | null {
  if (!matchId) return null;
  try {
    const raw = safeLocalStorage.getItem(draftKey(matchId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('placedTiles' in parsed) ||
      !('rack' in parsed)
    ) {
      return null;
    }
    const record = parsed as { placedTiles?: unknown; rack?: unknown; savedAt?: unknown };
    if (!Array.isArray(record.placedTiles) || !Array.isArray(record.rack)) {
      return null;
    }
    const isValidTile = (t: unknown): t is PlacedTile =>
      !!t &&
      typeof t === 'object' &&
      Number.isInteger((t as PlacedTile).x) &&
      Number.isInteger((t as PlacedTile).y) &&
      typeof (t as PlacedTile).letter === 'string';

    if (
      record.savedAt &&
      typeof record.savedAt === 'number' &&
      Date.now() - record.savedAt > SEVEN_DAYS_MS
    ) {
      clearWordGridDraft(matchId);
      return null;
    }
    return {
      placedTiles: (record.placedTiles as unknown[]).filter(isValidTile),
      rack: (record.rack as unknown[]).filter(
        (l): l is string => typeof l === 'string'
      ),
      savedAt:
        typeof record.savedAt === 'number' ? record.savedAt : Date.now(),
    };
  } catch (e) {
    console.warn('[WordGridDraft] Load failed:', e);
  }
  return null;
}
