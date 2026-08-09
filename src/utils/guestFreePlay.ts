// src/utils/guestFreePlay.ts

import { safeLocalStorage } from './storage';

export interface GuestFreePlayState {
  date: string; // Today's date YYYY-MM-DD
  word: string;
  guesses: string[];
  isGameOver: boolean;
  isWon: boolean;
  score: number;
  attempts: number;
  savedAt: string;
}

const GUEST_FREEPLAY_KEY = 'wordle_guest_freeplay_state_v1';

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getGuestFreePlayState(): GuestFreePlayState | null {
  try {
    const raw = safeLocalStorage.getItem(GUEST_FREEPLAY_KEY);
    if (!raw) return null;
    const parsed: GuestFreePlayState = JSON.parse(raw);
    const today = getTodayDateString();
    
    // Auto-clear if the saved state is from a previous day
    if (parsed.date !== today) {
      clearGuestFreePlayState();
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[guestFreePlay] getGuestFreePlayState error:', err);
    return null;
  }
}

export function saveGuestFreePlayState(state: Omit<GuestFreePlayState, 'date' | 'savedAt'>): void {
  try {
    const today = getTodayDateString();
    const fullState: GuestFreePlayState = {
      ...state,
      date: today,
      savedAt: new Date().toISOString(),
    };
    safeLocalStorage.setItem(GUEST_FREEPLAY_KEY, JSON.stringify(fullState));
  } catch (err) {
    console.warn('[guestFreePlay] saveGuestFreePlayState error:', err);
  }
}

export function clearGuestFreePlayState(): void {
  try {
    safeLocalStorage.removeItem(GUEST_FREEPLAY_KEY);
  } catch (err) {
    console.warn('[guestFreePlay] clearGuestFreePlayState error:', err);
  }
}
