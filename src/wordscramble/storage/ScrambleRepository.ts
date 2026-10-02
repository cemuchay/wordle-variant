import type { ScrambleSessionStats } from '../engine/types';

export interface IScrambleRepository {
  saveSession(session: ScrambleSessionStats): Promise<void>;
  getSessions(): Promise<ScrambleSessionStats[]>;
  getHighScores(): Promise<Record<string, number>>;
  saveActiveGame(state: any): Promise<void>;
  loadActiveGame(): Promise<any | null>;
  clearActiveGame(): Promise<void>;
}

export class LocalStorageScrambleRepository implements IScrambleRepository {
  private readonly SESSIONS_KEY = 'word_scramble_sessions_v1';
  private readonly HIGHSCORES_KEY = 'word_scramble_highscores_v1';
  private readonly ACTIVE_GAME_KEY = 'word_scramble_active_game_v1';

  async saveSession(session: ScrambleSessionStats): Promise<void> {
    try {
      const existing = await this.getSessions();
      const updated = [session, ...existing].slice(0, 100);
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(updated));

      // Update High Scores map by mode and letter config key
      const key = `${session.gameMode}_${session.selectedLengths.sort().join('-')}`;
      const highScores = await this.getHighScores();
      if (!highScores[key] || session.score > highScores[key]) {
        highScores[key] = session.score;
        localStorage.setItem(this.HIGHSCORES_KEY, JSON.stringify(highScores));
      }
    } catch (e) {
      console.warn('Failed to save scramble session to localStorage:', e);
    }
  }

  async getSessions(): Promise<ScrambleSessionStats[]> {
    try {
      const raw = localStorage.getItem(this.SESSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async getHighScores(): Promise<Record<string, number>> {
    try {
      const raw = localStorage.getItem(this.HIGHSCORES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async saveActiveGame(state: any): Promise<void> {
    try {
      localStorage.setItem(this.ACTIVE_GAME_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to cache active scramble game:', e);
    }
  }

  async loadActiveGame(): Promise<any | null> {
    try {
      const raw = localStorage.getItem(this.ACTIVE_GAME_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async clearActiveGame(): Promise<void> {
    try {
      localStorage.removeItem(this.ACTIVE_GAME_KEY);
    } catch {}
  }
}
