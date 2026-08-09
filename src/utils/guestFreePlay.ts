// src/utils/guestFreePlay.ts

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
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getGuestFreePlayState(): GuestFreePlayState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(GUEST_FREEPLAY_KEY);
    if (!raw) return null;
    const parsed: GuestFreePlayState = JSON.parse(raw);
    const today = getTodayDateString();
    
    // Auto-clear only if the saved state is from a previous date
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
    if (typeof window === 'undefined' || !window.localStorage) return;
    const today = getTodayDateString();
    const fullState: GuestFreePlayState = {
      ...state,
      date: today,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(GUEST_FREEPLAY_KEY, JSON.stringify(fullState));
  } catch (err) {
    console.warn('[guestFreePlay] saveGuestFreePlayState error:', err);
  }
}

export function clearGuestFreePlayState(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(GUEST_FREEPLAY_KEY);
  } catch (err) {
    console.warn('[guestFreePlay] clearGuestFreePlayState error:', err);
  }
}
