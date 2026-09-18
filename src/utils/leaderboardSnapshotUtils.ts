import { safeLocalStorage } from "./storage";
import type { LeaderboardEntry } from "../types/game";

export interface LeaderboardSnapshotItem {
  user_id?: string;
  username: string;
  rank: number;
  total_score: number;
  status?: "won" | "lost" | "playing";
  attempts?: number | "X";
}

export interface LeaderboardSnapshot {
  date: string;
  timestamp: number;
  entries: LeaderboardSnapshotItem[];
}

export interface RankMovementInfo {
  prevRank?: number;
  delta?: number; // positive = moved up (e.g. #4 to #2 -> delta = +2), negative = moved down
  isNew?: boolean;
}

const STORAGE_PREFIX = "wordle_lb_snapshot_";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Purge snapshot entries older than 2 days
 */
export function cleanStaleLeaderboardSnapshots(currentDate?: string): void {
  try {
    const now = Date.now();
    const currentParsedDate = currentDate ? new Date(currentDate).getTime() : now;

    if (typeof window === "undefined" || !window.localStorage) return;

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const dateStr = key.replace(STORAGE_PREFIX, "");
        const raw = safeLocalStorage.getItem(key);
        let shouldDelete = false;

        if (raw) {
          try {
            const parsed: LeaderboardSnapshot = JSON.parse(raw);
            if (now - parsed.timestamp > TWO_DAYS_MS) {
              shouldDelete = true;
            }
          } catch {
            shouldDelete = true;
          }
        }

        // Also check by date string comparison if timestamp check passed
        if (!shouldDelete && dateStr) {
          const itemDate = new Date(dateStr).getTime();
          if (!isNaN(itemDate) && currentParsedDate - itemDate > TWO_DAYS_MS) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          safeLocalStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.error("Failed to clean stale leaderboard snapshots:", err);
  }
}

/**
 * Retrieve cached snapshot for a given date
 */
export function getLeaderboardSnapshot(date: string): LeaderboardSnapshot | null {
  if (!date) return null;
  try {
    const raw = safeLocalStorage.getItem(`${STORAGE_PREFIX}${date}`);
    if (!raw) return null;
    const parsed: LeaderboardSnapshot = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error("Failed to read leaderboard snapshot:", err);
    return null;
  }
}

/**
 * Save new snapshot to local storage
 */
export function saveLeaderboardSnapshot(
  date: string,
  rankedEntries: Array<{ entry: LeaderboardEntry; rank: number }>
): void {
  if (!date || !rankedEntries) return;
  try {
    const snapshot: LeaderboardSnapshot = {
      date,
      timestamp: Date.now(),
      entries: rankedEntries.map(({ entry, rank }) => ({
        user_id: entry.user_id,
        username: entry.username,
        rank,
        total_score: entry.total_score,
        status: entry.status,
        attempts: entry.attempts,
      })),
    };
    safeLocalStorage.setItem(`${STORAGE_PREFIX}${date}`, JSON.stringify(snapshot));
  } catch (err) {
    console.error("Failed to save leaderboard snapshot:", err);
  }
}

/**
 * Computes rank movements & NEW flags by comparing current ranked entries to previous snapshot
 */
export function computeLeaderboardMovement(
  currentRanked: Array<{ entry: LeaderboardEntry; rank: number }>,
  previousSnapshot: LeaderboardSnapshot | null
): Map<string, RankMovementInfo> {
  const movementMap = new Map<string, RankMovementInfo>();

  if (!previousSnapshot || !previousSnapshot.entries || previousSnapshot.entries.length === 0) {
    return movementMap;
  }

  // Create lookup maps by user_id and username for robust matching
  const prevRankById = new Map<string, number>();
  const prevRankByUsername = new Map<string, number>();

  previousSnapshot.entries.forEach((item) => {
    if (item.user_id) prevRankById.set(item.user_id, item.rank);
    if (item.username) prevRankByUsername.set(item.username.toLowerCase(), item.rank);
  });

  currentRanked.forEach(({ entry, rank }) => {
    const key = entry.user_id || entry.username;
    let prevRank: number | undefined;

    if (entry.user_id && prevRankById.has(entry.user_id)) {
      prevRank = prevRankById.get(entry.user_id);
    } else if (entry.username && prevRankByUsername.has(entry.username.toLowerCase())) {
      prevRank = prevRankByUsername.get(entry.username.toLowerCase());
    }

    if (prevRank !== undefined) {
      const delta = prevRank - rank; // e.g. prev was #4, now #2 -> +2
      movementMap.set(key, {
        prevRank,
        delta,
        isNew: false,
      });
    } else {
      // Not present in previous snapshot
      movementMap.set(key, {
        isNew: true,
      });
    }
  });

  return movementMap;
}
