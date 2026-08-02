/* eslint-disable @typescript-eslint/no-explicit-any */
import { safeLocalStorage } from "../../utils/storage";

export const PAUSED_MATCHES_KEY = "wordup_paused_matches";

export interface PausedMatch {
   matchId: string;
   categoryId: string;
   currentIdx: number;
   role: "player1" | "player2" | null;
   matchData: any;
   questions: any[];
   pausedAt: number;
}

export function getPausedGames(): PausedMatch[] {
   try {
      const raw = safeLocalStorage.getItem(PAUSED_MATCHES_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
   } catch {
      return [];
   }
}

export function savePausedGame(pausedMatch: PausedMatch): void {
   try {
      const current = getPausedGames();
      const filtered = current.filter((m) => m.matchId !== pausedMatch.matchId);
      filtered.unshift(pausedMatch);
      safeLocalStorage.setItem(PAUSED_MATCHES_KEY, JSON.stringify(filtered));
   } catch (e) {
      console.warn("Failed to save paused game to storage:", e);
   }
}

export function getPausedGamesByCategory(categoryId: string): PausedMatch[] {
   return getPausedGames().filter((m) => m.categoryId === categoryId);
}

export function removePausedGame(matchId: string): void {
   try {
      const current = getPausedGames();
      const filtered = current.filter((m) => m.matchId !== matchId);
      safeLocalStorage.setItem(PAUSED_MATCHES_KEY, JSON.stringify(filtered));
   } catch (e) {
      console.warn("Failed to remove paused game from storage:", e);
   }
}
