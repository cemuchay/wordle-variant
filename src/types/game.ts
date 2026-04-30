export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface GameConfig {
  word: string;
  length: 4 | 5 | 6;
  maxAttempts: number;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guesses: Record<string, number>;
}

export interface GuessResult {
  letter: string;
  status: LetterStatus;
}