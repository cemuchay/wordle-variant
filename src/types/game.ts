export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface GameConfig {
  word: string;
  length: 4 | 5 | 6;
  maxAttempts: number;
}

export interface GuessResult {
  letter: string;
  status: LetterStatus;
}