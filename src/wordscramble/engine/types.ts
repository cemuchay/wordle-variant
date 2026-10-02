export type ScrambleGameMode = 'timed' | 'untimed';

export interface ScrambleTile {
  id: string;
  letter: string;
  originalIndex: number;
  status: 'available' | 'staged' | 'consumed';
  colorIndex: number; // 0 to 7 mapping to rainbow palette
}

export interface ScrambleConfig {
  selectedLengths: number[]; // e.g. [5] or [3, 4, 5]
  mode: ScrambleGameMode;
  durationSeconds: number; // e.g. 90
  wordsPerSpool: number; // e.g. 6 words (30 tiles for 5L)
  useScrabbleDict: boolean;
  seed?: string;
}

export interface FoundWordEntry {
  word: string;
  length: number;
  score: number;
  timestamp: number;
  tileIds: string[];
}

export interface ScrambleGameState {
  config: ScrambleConfig;
  status: 'idle' | 'playing' | 'paused' | 'game_over';
  tiles: ScrambleTile[];
  stagedTileIds: string[];
  foundWords: FoundWordEntry[];
  score: number;
  streak: number;
  highestStreak: number;
  remainingSeconds: number;
  wordsClearedSinceRefill: number;
  targetRefillThreshold: number;
  secretSpoolWords: string[];
  allPossibleWordsCount?: number;
  gameStartedAt?: number;
  gameEndedAt?: number;
}

export interface ScrambleSessionStats {
  id: string;
  gameMode: ScrambleGameMode;
  selectedLengths: number[];
  score: number;
  wordsFound: string[];
  totalWordsCount: number;
  longestWord: string;
  highestStreak: number;
  timeSpentSeconds: number;
  completedAt: string;
}
