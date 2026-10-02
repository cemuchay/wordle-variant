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

  it('generates properly formatted rainbow tiles from spooled words', () => {
    const words = ['APPLE', 'CRANE'];
    const tiles = generateTilesFromWords(words, 0);
    expect(tiles).toHaveLength(10);
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
    expect(state.tiles).toHaveLength(20); // 4 words * 5 letters
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

  it('calculates score with streak bonuses correctly', () => {
    const score1 = calculateWordScore('TRAIN', 1);
    const score2 = calculateWordScore('TRAIN', 4);
    expect(score2).toBeGreaterThan(score1);
  });
});
