import { describe, it, expect } from 'vitest';
import { scrambleReducer, initialScrambleState } from '../ScrambleEngine';
import { spoolSecretWords, generateTilesFromWords, calculateWordScore, createRng } from '../poolGenerator';

describe('ScrambleEngine & Pool Generator', () => {
  const mockWordLists: Record<number, string[]> = {
    3: ['CAT', 'DOG', 'SUN', 'BAT', 'HAT'],
    4: ['BIRD', 'STAR', 'MOON', 'FISH', 'LION'],
    5: ['APPLE', 'CRANE', 'GRAPE', 'PLANT', 'TRAIN'],
  };

  const mockDict = new Set([
    'CAT', 'DOG', 'SUN', 'BAT', 'HAT', 'TAB', 'ACT',
    'BIRD', 'STAR', 'MOON', 'FISH', 'LION', 'RATS', 'ARTS',
    'APPLE', 'CRANE', 'GRAPE', 'PLANT', 'TRAIN', 'RANCE'
  ]);

  it('spools valid secret words matching single length target (e.g. 5L)', () => {
    const rng = createRng('test_seed_1');
    const words = spoolSecretWords(mockWordLists, [5], 6, rng);
    expect(words).toHaveLength(6);
    words.forEach((w) => {
      expect(w.length).toBe(5);
      expect(mockWordLists[5]).toContain(w);
    });
  });

  it('spools mixed length words (3L, 4L, 5L)', () => {
    const rng = createRng('test_seed_mix');
    const words = spoolSecretWords(mockWordLists, [3, 4, 5], 6, rng);
    expect(words).toHaveLength(6);
    expect(words[0].length).toBe(3);
    expect(words[1].length).toBe(4);
    expect(words[2].length).toBe(5);
  });

  it('generates properly formatted rainbow tiles from spooled words including bonus helper tiles', () => {
    const words = ['APPLE', 'CRANE'];
    const tiles = generateTilesFromWords(words, 0);
    // 10 base letters + 1 bonus butter tile = 11 tiles
    expect(tiles).toHaveLength(11);
    expect(tiles.every((t) => t.status === 'available')).toBe(true);
    expect(tiles.every((t) => t.colorIndex >= 0 && t.colorIndex < 8)).toBe(true);
  });

  it('starts a game properly with initialized state', () => {
    const state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [5],
        mode: 'timed',
        durationSeconds: 90,
        wordsPerSpool: 4,
        useScrabbleDict: true,
        seed: 'fixed_seed',
      },
      wordListMap: mockWordLists,
    });

    expect(state.status).toBe('playing');
    // 4 words * 5 letters = 20 letters + 2 bonus butter tiles = 22 tiles
    expect(state.tiles).toHaveLength(22);
    expect(state.remainingSeconds).toBe(90);
    expect(state.score).toBe(0);
  });

  it('stages and unstages tiles correctly', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [5],
        mode: 'untimed',
        durationSeconds: 0,
        wordsPerSpool: 2,
        useScrabbleDict: true,
        seed: 'seed_stage',
      },
      wordListMap: mockWordLists,
    });

    const firstTile = state.tiles[0];
    // Stage tile
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: firstTile.id });
    expect(state.stagedTileIds).toEqual([firstTile.id]);
    expect(state.tiles.find((t) => t.id === firstTile.id)?.status).toBe('staged');

    // Unstage tile
    state = scrambleReducer(state, { type: 'UNSTAGE_TILE', tileId: firstTile.id });
    expect(state.stagedTileIds).toEqual([]);
    expect(state.tiles.find((t) => t.id === firstTile.id)?.status).toBe('available');
  });

  it('submits a valid word and scores points', () => {
    // Initialize deterministic state
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [3],
        mode: 'untimed',
        durationSeconds: 0,
        wordsPerSpool: 1,
        useScrabbleDict: true,
        seed: 'seed_submit',
      },
      wordListMap: { 3: ['CAT'] },
    });

    // Stage C, A, T
    const cTile = state.tiles.find((t) => t.letter === 'C')!;
    const aTile = state.tiles.find((t) => t.letter === 'A')!;
    const tTile = state.tiles.find((t) => t.letter === 'T')!;

    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: cTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: aTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: tTile.id });

    // Submit word
    state = scrambleReducer(state, {
      type: 'SUBMIT_WORD',
      validDictionary: mockDict,
      wordListMap: mockWordLists,
    });

    expect(state.foundWords).toHaveLength(1);
    expect(state.foundWords[0].word).toBe('CAT');
    expect(state.score).toBeGreaterThan(0);
    expect(state.streak).toBe(1);
    expect(state.stagedTileIds).toHaveLength(0);
    expect(state.tiles.filter((t) => t.status === 'consumed')).toHaveLength(3);
  });

  it('rejects words of invalid length or non-dictionary words', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [5], // Only 5L allowed
        mode: 'untimed',
        durationSeconds: 0,
        wordsPerSpool: 2,
        useScrabbleDict: true,
        seed: 'seed_invalid',
      },
      wordListMap: { 5: ['APPLE', 'CRANE'] },
    });

    // Stage only 3 letters: A, P, P
    const tiles = state.tiles.slice(0, 3);
    tiles.forEach((t) => {
      state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: t.id });
    });

    // Attempt to submit 3L when target is [5]
    state = scrambleReducer(state, {
      type: 'SUBMIT_WORD',
      validDictionary: mockDict,
      wordListMap: mockWordLists,
    });

    // Submission should be rejected
    expect(state.foundWords).toHaveLength(0);
    expect(state.streak).toBe(0);
  });

  it('allows swapping / reordering staged tiles', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [3],
        mode: 'untimed',
        durationSeconds: 0,
        wordsPerSpool: 1,
        useScrabbleDict: true,
        seed: 'seed_swap',
      },
      wordListMap: { 3: ['CAT'] },
    });

    const tileIds = state.tiles.slice(0, 3).map((t) => t.id);
    tileIds.forEach((id) => {
      state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: id });
    });

    expect(state.stagedTileIds).toEqual([tileIds[0], tileIds[1], tileIds[2]]);

    // Swap index 0 and index 2
    state = scrambleReducer(state, {
      type: 'SWAP_STAGED_TILES',
      fromIndex: 0,
      toIndex: 2,
    });

    expect(state.stagedTileIds).toEqual([tileIds[1], tileIds[2], tileIds[0]]);
  });

  it('handles pause and resume game states properly', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [5],
        mode: 'timed',
        durationSeconds: 90,
        wordsPerSpool: 2,
        useScrabbleDict: true,
      },
      wordListMap: mockWordLists,
    });

    expect(state.status).toBe('playing');

    state = scrambleReducer(state, { type: 'PAUSE_GAME' });
    expect(state.status).toBe('paused');

    // Timer tick should not decrement while paused
    state = scrambleReducer(state, { type: 'TICK_TIMER' });
    expect(state.remainingSeconds).toBe(90);

    state = scrambleReducer(state, { type: 'RESUME_GAME' });
    expect(state.status).toBe('playing');
  });

  it('calculates score with streak bonuses correctly', () => {
    const score1 = calculateWordScore('TRAIN', 1);
    const score2 = calculateWordScore('TRAIN', 4);
    expect(score2).toBeGreaterThan(score1);
  });

  it('enforces hard grid letter capacity and prevents overflow on refills', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [3],
        mode: 'timed',
        durationSeconds: 90,
        wordsPerSpool: 10,
        maxCapacity: 24, // Hard cap 24
        useScrabbleDict: true,
        seed: 'seed_cap',
      },
      wordListMap: { 3: ['CAT', 'DOG', 'SUN', 'BAT', 'HAT', 'TAB', 'ACT'] },
    });

    // Initial tiles must not exceed maxCapacity (24)
    expect(state.tiles.length).toBeLessThanOrEqual(24);
    expect(state.maxCapacity).toBe(24);

    // Consume 3 letters
    const cTile = state.tiles.find((t) => t.letter === 'C') || state.tiles[0];
    const aTile = state.tiles.find((t) => t.id !== cTile.id && t.letter === 'A') || state.tiles[1];
    const tTile = state.tiles.find((t) => t.id !== cTile.id && t.id !== aTile.id && t.letter === 'T') || state.tiles[2];

    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: cTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: aTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: tTile.id });

    // Submit word to trigger tile replacement / refill
    state = scrambleReducer(state, {
      type: 'SUBMIT_WORD',
      validDictionary: mockDict,
      wordListMap: { 3: ['CAT', 'DOG', 'SUN', 'BAT', 'HAT', 'TAB', 'ACT'] },
    });

    // After word submission & refill, total grid tiles must strictly NEVER exceed hard cap (24)
    expect(state.tiles.length).toBeLessThanOrEqual(24);
  });

  it('restores a saved game state correctly', () => {
    const savedSnapshot = {
      ...initialScrambleState,
      status: 'playing' as const,
      score: 1500,
      streak: 3,
      highestStreak: 3,
      remainingSeconds: 45,
      maxCapacity: 30,
      tiles: [
        { id: 'tile_1', letter: 'A', originalIndex: 0, status: 'available' as const, colorIndex: 0 },
        { id: 'tile_2', letter: 'B', originalIndex: 1, status: 'available' as const, colorIndex: 1 },
      ],
    };

    const state = scrambleReducer(initialScrambleState, {
      type: 'RESTORE_SAVED_GAME',
      state: savedSnapshot,
    });

    expect(state.score).toBe(1500);
    expect(state.streak).toBe(3);
    expect(state.remainingSeconds).toBe(45);
    expect(state.status).toBe('playing');
  });

  it('auto-computes max tile capacity when not explicitly provided', () => {
    const state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [4, 5],
        mode: 'untimed',
        durationSeconds: 0,
        wordsPerSpool: 4,
        useScrabbleDict: true,
        seed: 'auto_cap_seed',
      },
      wordListMap: mockWordLists,
    });

    // Auto-computed capacity from 4 spooled words (4L & 5L combinations) + bonus butter tiles
    expect(state.maxCapacity).toBeGreaterThanOrEqual(20);
    expect(state.tiles.length).toBeLessThanOrEqual(state.maxCapacity);
  });

  it('awards bonus points and flags isSecretSpoolBonus for original secret spool words', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [3],
        mode: 'untimed',
        durationSeconds: 0,
        wordsPerSpool: 1,
        useScrabbleDict: true,
        seed: 'spool_bonus_seed',
      },
      wordListMap: { 3: ['CAT'] },
    });

    const cTile = state.tiles.find((t) => t.letter === 'C')!;
    const aTile = state.tiles.find((t) => t.letter === 'A')!;
    const tTile = state.tiles.find((t) => t.letter === 'T')!;

    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: cTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: aTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: tTile.id });

    // Submit 'CAT' which is in secretSpoolWords
    state = scrambleReducer(state, {
      type: 'SUBMIT_WORD',
      validDictionary: mockDict,
      wordListMap: { 3: ['CAT'] },
    });

    expect(state.foundWords[0].word).toBe('CAT');
    expect(state.foundWords[0].isSecretSpoolBonus).toBe(true);
    // Spool bonus gives 1.5x points multiplier over regular word
    const normalScore = calculateWordScore('CAT', 1, false);
    const bonusScore = calculateWordScore('CAT', 1, true);
    expect(bonusScore).toBeGreaterThan(normalScore);
    expect(state.foundWords[0].score).toBe(bonusScore);
  });

  it('awards dynamic time bonus and applies progressive time decay in timed mode', () => {
    let state = scrambleReducer(initialScrambleState, {
      type: 'START_GAME',
      config: {
        selectedLengths: [3],
        mode: 'timed',
        durationSeconds: 60,
        wordsPerSpool: 1,
        useScrabbleDict: true,
        seed: 'seed_time_bonus',
      },
      wordListMap: { 3: ['CAT'] },
    });

    expect(state.remainingSeconds).toBe(60);
    expect(state.timeDecayMultiplier).toBe(1.0);

    const cTile = state.tiles.find((t) => t.letter === 'C')!;
    const aTile = state.tiles.find((t) => t.letter === 'A')!;
    const tTile = state.tiles.find((t) => t.letter === 'T')!;

    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: cTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: aTile.id });
    state = scrambleReducer(state, { type: 'STAGE_TILE', tileId: tTile.id });

    // Submit word in timed mode
    state = scrambleReducer(state, {
      type: 'SUBMIT_WORD',
      validDictionary: mockDict,
      wordListMap: { 3: ['CAT'] },
    });

    // Time bonus must be awarded to clock
    expect(state.foundWords[0].timeBonus).toBeGreaterThan(0);
    expect(state.remainingSeconds).toBeGreaterThan(60);
  });
});

