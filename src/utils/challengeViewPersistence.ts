import { safeLocalStorage } from './storage';
import { type SavedChallengeView } from '../store/useChallengeStore';

const STORAGE_KEY = 'wordle_challenge_last_view';

export function saveChallengeView(view: SavedChallengeView): void {
    try {
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch (e) {
        console.error('Failed to save challenge view', e);
    }
}

export function loadChallengeView(): SavedChallengeView | null {
    try {
        const stored = safeLocalStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.type === 'string') {
            return parsed as SavedChallengeView;
        }
        return null;
    } catch (e) {
        console.error('Failed to load challenge view', e);
        return null;
    }
}

export function clearChallengeView(): void {
    try {
        safeLocalStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Failed to clear challenge view', e);
    }
}
