import type { ScrambleGameState, ScrambleConfig, ScrambleTile } from './types';
import {
  spoolSecretWords,
  generateTilesFromWords,
  calculateWordScore,
  calculateTimeBonus,
  calculateTimeDecayMultiplier,
  createRng,
} from './poolGenerator';

export type ScrambleAction =
  | { type: 'START_GAME'; config: ScrambleConfig; wordListMap: Record<number, string[]> }
  | { type: 'RESTORE_SAVED_GAME'; state: ScrambleGameState }
  | { type: 'STAGE_TILE'; tileId: string }
  | { type: 'UNSTAGE_TILE'; tileId: string }
  | { type: 'UNSTAGE_LAST_TILE' }
  | { type: 'CLEAR_STAGING' }
  | { type: 'SWAP_STAGED_TILES'; fromIndex: number; toIndex: number }
  | { type: 'SUBMIT_WORD'; validDictionary: Set<string>; wordListMap: Record<number, string[]> }
  | { type: 'SHUFFLE_TILES' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
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
  maxCapacity: 30,
  secretSpoolWords: [],
  timeDecayMultiplier: 1.0,
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
      
      // Auto-calculate appropriate matrix capacity based on spooled words and game configuration
      const totalLettersInWords = secretWords.reduce((acc, w) => acc + w.length, 0);
      const bonusButterCount = Math.min(3, Math.max(1, Math.floor(secretWords.length / 2)));
      const autoComputedCapacity = totalLettersInWords + bonusButterCount;
      const targetCapacity = action.config.maxCapacity || Math.min(48, Math.max(20, autoComputedCapacity));

      const tiles = generateTilesFromWords(secretWords, 0, rng).slice(0, targetCapacity);
      const now = Date.now();

      return {
        ...state,
        config: {
          ...action.config,
          maxCapacity: targetCapacity,
        },
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
        maxCapacity: targetCapacity,
        secretSpoolWords: secretWords,
        gameStartedAt: now,
        lastWordSubmittedAt: now,
        timeDecayMultiplier: 1.0,
        gameEndedAt: undefined,
      };
    }

    case 'RESTORE_SAVED_GAME': {
      return {
        ...action.state,
        status: 'playing',
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

    case 'SWAP_STAGED_TILES': {
      if (state.status !== 'playing') return state;
      const { fromIndex, toIndex } = action;
      if (
        fromIndex < 0 ||
        fromIndex >= state.stagedTileIds.length ||
        toIndex < 0 ||
        toIndex >= state.stagedTileIds.length
      ) {
        return state;
      }

      const updated = [...state.stagedTileIds];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      return {
        ...state,
        stagedTileIds: updated,
      };
    }

    case 'PAUSE_GAME': {
      if (state.status !== 'playing') return state;
      return {
        ...state,
        status: 'paused',
      };
    }

    case 'RESUME_GAME': {
      if (state.status !== 'paused') return state;
      return {
        ...state,
        status: 'playing',
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

      // Check if this submitted word is one of the original secret spool words for bonus
      const isSpoolBonus = state.secretSpoolWords.includes(word);
      const nextStreak = state.streak + 1;
      const wordScore = calculateWordScore(word, nextStreak, isSpoolBonus);

      const now = Date.now();
      const lastTime = state.lastWordSubmittedAt || state.gameStartedAt || now;
      const secondsSinceLastWord = Math.max(0, Math.floor((now - lastTime) / 1000));

      // Calculate time bonus for efficient gameplay in timed mode
      const timeBonus = state.config.mode === 'timed'
        ? calculateTimeBonus(word.length, wordScore, secondsSinceLastWord, isSpoolBonus)
        : 0;

      const updatedRemainingSeconds = state.config.mode === 'timed'
        ? state.remainingSeconds + timeBonus
        : state.remainingSeconds;

      const nextFoundWordsCount = state.foundWords.length + 1;
      const nextDecayMultiplier = calculateTimeDecayMultiplier(nextFoundWordsCount);

      const stagedSet = new Set(state.stagedTileIds);
      let updatedTiles = state.tiles.map((t) =>
        stagedSet.has(t.id) ? { ...t, status: 'consumed' as const } : t
      );

      const newFoundWord = {
        word,
        length: word.length,
        score: wordScore,
        timestamp: now,
        tileIds: [...state.stagedTileIds],
        isSecretSpoolBonus: isSpoolBonus,
        timeBonus,
      };

      const wordsCleared = state.wordsClearedSinceRefill + 1;
      let newSecretWords = state.secretSpoolWords;
      const hardCap = state.maxCapacity || 30;

      // In Timed Mode: refill ONLY when available tiles drop below threshold (< 10)
      // Runs only once when tiles drop below the threshold, refilling consumed slots up to hardCap
      if (state.config.mode === 'timed') {
        const availableCount = updatedTiles.filter((t) => t.status === 'available').length;
        const REFILL_THRESHOLD = 10;
        
        if (availableCount < REFILL_THRESHOLD) {
          const freshWords = spoolSecretWords(
            action.wordListMap,
            state.config.selectedLengths,
            state.config.wordsPerSpool
          );
          newSecretWords = [...newSecretWords, ...freshWords];
          
          // Generate fresh tiles pool
          const freshTiles = generateTilesFromWords(freshWords, updatedTiles.length);
          let freshIdx = 0;

          // 1. First replace consumed tile slots in place
          const refilledTiles: ScrambleTile[] = [];
          for (const tile of updatedTiles) {
            if (tile.status === 'consumed' && freshIdx < freshTiles.length) {
              const fresh = freshTiles[freshIdx++];
              refilledTiles.push({
                ...fresh,
                colorIndex: tile.colorIndex, // Keep visual harmonious position
              });
            } else {
              refilledTiles.push(tile);
            }
          }

          // 2. If total tiles < hardCap and more fresh tiles exist, append up to hardCap
          while (refilledTiles.length < hardCap && freshIdx < freshTiles.length) {
            refilledTiles.push(freshTiles[freshIdx++]);
          }

          // Enforce absolute hard cap
          updatedTiles = refilledTiles.slice(0, hardCap);
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
        remainingSeconds: updatedRemainingSeconds,
        wordsClearedSinceRefill: wordsCleared,
        secretSpoolWords: newSecretWords,
        lastWordSubmittedAt: now,
        timeDecayMultiplier: nextDecayMultiplier,
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
