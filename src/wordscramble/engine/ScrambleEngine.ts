import type { ScrambleGameState, ScrambleConfig, ScrambleTile } from './types';
import { spoolSecretWords, generateTilesFromWords, calculateWordScore, createRng } from './poolGenerator';

export type ScrambleAction =
  | { type: 'START_GAME'; config: ScrambleConfig; wordListMap: Record<number, string[]> }
  | { type: 'STAGE_TILE'; tileId: string }
  | { type: 'UNSTAGE_TILE'; tileId: string }
  | { type: 'UNSTAGE_LAST_TILE' }
  | { type: 'CLEAR_STAGING' }
  | { type: 'SUBMIT_WORD'; validDictionary: Set<string>; wordListMap: Record<number, string[]> }
  | { type: 'SHUFFLE_TILES' }
  | { type: 'TICK_TIMER' }
  | { type: 'END_GAME' };

export const initialScrambleState: ScrambleGameState = {
  config: {
    selectedLengths: [5],
    mode: 'timed',
    durationSeconds: 90,
    wordsPerSpool: 6,
    useScrabbleDict: true,
  },
  status: 'idle',
  tiles: [],
  stagedTileIds: [],
  foundWords: [],
  score: 0,
  streak: 0,
  highestStreak: 0,
  remainingSeconds: 90,
  wordsClearedSinceRefill: 0,
  targetRefillThreshold: 5,
  secretSpoolWords: [],
};

export function scrambleReducer(
  state: ScrambleGameState,
  action: ScrambleAction
): ScrambleGameState {
  switch (action.type) {
    case 'START_GAME': {
      const rng = createRng(action.config.seed || Date.now().toString());
      const secretWords = spoolSecretWords(
        action.wordListMap,
        action.config.selectedLengths,
        action.config.wordsPerSpool,
        rng
      );
      const tiles = generateTilesFromWords(secretWords, 0, rng);

      return {
        ...state,
        config: action.config,
        status: 'playing',
        tiles,
        stagedTileIds: [],
        foundWords: [],
        score: 0,
        streak: 0,
        highestStreak: 0,
        remainingSeconds: action.config.durationSeconds,
        wordsClearedSinceRefill: 0,
        targetRefillThreshold: 5,
        secretSpoolWords: secretWords,
        gameStartedAt: Date.now(),
        gameEndedAt: undefined,
      };
    }

    case 'STAGE_TILE': {
      if (state.status !== 'playing') return state;
      const tile = state.tiles.find((t) => t.id === action.tileId);
      if (!tile || tile.status !== 'available') return state;

      return {
        ...state,
        tiles: state.tiles.map((t) =>
          t.id === action.tileId ? { ...t, status: 'staged' } : t
        ),
        stagedTileIds: [...state.stagedTileIds, action.tileId],
      };
    }

    case 'UNSTAGE_TILE': {
      if (state.status !== 'playing') return state;
      if (!state.stagedTileIds.includes(action.tileId)) return state;

      return {
        ...state,
        tiles: state.tiles.map((t) =>
          t.id === action.tileId ? { ...t, status: 'available' } : t
        ),
        stagedTileIds: state.stagedTileIds.filter((id) => id !== action.tileId),
      };
    }

    case 'UNSTAGE_LAST_TILE': {
      if (state.status !== 'playing' || state.stagedTileIds.length === 0) return state;
      const lastId = state.stagedTileIds[state.stagedTileIds.length - 1];

      return {
        ...state,
        tiles: state.tiles.map((t) =>
          t.id === lastId ? { ...t, status: 'available' } : t
        ),
        stagedTileIds: state.stagedTileIds.slice(0, -1),
      };
    }

    case 'CLEAR_STAGING': {
      if (state.status !== 'playing' || state.stagedTileIds.length === 0) return state;

      const stagedSet = new Set(state.stagedTileIds);
      return {
        ...state,
        tiles: state.tiles.map((t) =>
          stagedSet.has(t.id) ? { ...t, status: 'available' } : t
        ),
        stagedTileIds: [],
      };
    }

    case 'SUBMIT_WORD': {
      if (state.status !== 'playing' || state.stagedTileIds.length === 0) return state;

      // Construct word from staged tiles
      const stagedTiles = state.stagedTileIds
        .map((id) => state.tiles.find((t) => t.id === id))
        .filter((t): t is ScrambleTile => Boolean(t));

      const word = stagedTiles.map((t) => t.letter).join('').toUpperCase();

      // Rule 1: Length must strictly match one of the selected lengths
      if (!state.config.selectedLengths.includes(word.length)) {
        return {
          ...state,
          streak: 0,
        };
      }

      // Rule 2: Word must exist in the valid dictionary
      if (!action.validDictionary.has(word)) {
        return {
          ...state,
          streak: 0,
        };
      }

      // Rule 3: Word cannot have already been found in this game
      if (state.foundWords.some((entry) => entry.word === word)) {
        return state;
      }

      const nextStreak = state.streak + 1;
      const wordScore = calculateWordScore(word, nextStreak);

      const stagedSet = new Set(state.stagedTileIds);
      let updatedTiles = state.tiles.map((t) =>
        stagedSet.has(t.id) ? { ...t, status: 'consumed' as const } : t
      );

      const newFoundWord = {
        word,
        length: word.length,
        score: wordScore,
        timestamp: Date.now(),
        tileIds: [...state.stagedTileIds],
      };

      const wordsCleared = state.wordsClearedSinceRefill + 1;
      let newSecretWords = state.secretSpoolWords;

      // In Timed Mode: if cleared threshold words or available tiles < 10, spool new words & refill
      if (state.config.mode === 'timed') {
        const availableCount = updatedTiles.filter((t) => t.status === 'available').length;
        if (wordsCleared >= state.targetRefillThreshold || availableCount < 10) {
          const freshWords = spoolSecretWords(
            action.wordListMap,
            state.config.selectedLengths,
            state.config.wordsPerSpool
          );
          newSecretWords = [...newSecretWords, ...freshWords];
          const newTiles = generateTilesFromWords(freshWords, updatedTiles.length);
          // Keep unconsumed available tiles + append newly spooled tiles
          const remainingAvailable = updatedTiles.filter((t) => t.status === 'available');
          updatedTiles = [...remainingAvailable, ...newTiles];
        }
      }

      return {
        ...state,
        tiles: updatedTiles,
        stagedTileIds: [],
        foundWords: [newFoundWord, ...state.foundWords],
        score: state.score + wordScore,
        streak: nextStreak,
        highestStreak: Math.max(state.highestStreak, nextStreak),
        wordsClearedSinceRefill: wordsCleared,
        secretSpoolWords: newSecretWords,
      };
    }

    case 'SHUFFLE_TILES': {
      if (state.status !== 'playing') return state;
      const availableTiles = state.tiles.filter((t) => t.status === 'available');
      const nonAvailable = state.tiles.filter((t) => t.status !== 'available');

      // Shuffle available
      const shuffled = [...availableTiles];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      return {
        ...state,
        tiles: [...shuffled, ...nonAvailable],
      };
    }

    case 'TICK_TIMER': {
      if (state.status !== 'playing' || state.config.mode === 'untimed') return state;
      const nextTime = state.remainingSeconds - 1;

      if (nextTime <= 0) {
        return {
          ...state,
          remainingSeconds: 0,
          status: 'game_over',
          gameEndedAt: Date.now(),
        };
      }

      return {
        ...state,
        remainingSeconds: nextTime,
      };
    }

    case 'END_GAME': {
      return {
        ...state,
        status: 'game_over',
        gameEndedAt: Date.now(),
      };
    }

    default:
      return state;
  }
}
