// src/utils/wordgrid/staleMatches.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

// Client-owned expiry: each player's device auto-cancels its own matches whose
// last activity is older than 7 days. No server schedules required — every
// play/exchange/bot turn appends a move with a created_at timestamp, so last
// activity can be derived from the moves array itself.

export const STALE_MATCH_MS = 7 * 24 * 60 * 60 * 1000;

const NON_TERMINAL_STATUSES = new Set(['active', 'pending', 'waiting']);

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Most recent activity timestamp for a match record:
 * last move's created_at -> match last_move_at -> match created_at.
 */
export function getLastActivityAt(record: any): string | null {
  if (!record) return null;
  const moves = Array.isArray(record.moves) ? record.moves : [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const createdAt = moves[i]?.created_at;
    if (isValidIsoDate(createdAt)) return createdAt;
  }
  if (isValidIsoDate(record.last_move_at)) return record.last_move_at;
  if (isValidIsoDate(record.created_at)) return record.created_at;
  return null;
}

export function isStaleMatch(record: any, now: number = Date.now()): boolean {
  if (!record || typeof record.id !== 'string') return false;
  if (!NON_TERMINAL_STATUSES.has(record.status)) return false;
  const lastActivity = getLastActivityAt(record);
  if (!lastActivity) return false;
  return now - Date.parse(lastActivity) > STALE_MATCH_MS;
}

export function findStaleMatchIds(matches: any[]): string[] {
  return (matches || [])
    .filter((m) => isStaleMatch(m))
    .map((m) => m.id as string);
}
