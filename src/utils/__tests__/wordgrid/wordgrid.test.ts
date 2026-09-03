// src/utils/__tests__/wordgrid/wordgrid.test.ts

import { describe, test, expect } from 'vitest';
import { validateBoardPlacement } from '../../wordgrid/boardValidation';
import { calculateTurnScore } from '../../wordgrid/scoring';
import { GridCell, PlacedTile } from '../../wordgrid/constants';

describe('WordGrid Validation', () => {
  test('First move must touch the center (3,3 for 7x7)', () => {
    const placed: PlacedTile[] = [
      { x: 0, y: 0, letter: 'A' },
      { x: 1, y: 0, letter: 'T' }
    ];
    const res = validateBoardPlacement(placed, [], 7);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('center cell (3,3)');
  });

  test('First move touching center is valid (3,3 for 7x7)', () => {
    const placed: PlacedTile[] = [
      { x: 3, y: 3, letter: 'C' },
      { x: 4, y: 3, letter: 'A' },
      { x: 5, y: 3, letter: 'T' }
    ];
    const res = validateBoardPlacement(placed, [], 7);
    expect(res.isValid).toBe(true);
    expect(res.wordsFormed).toHaveLength(1);
    expect(res.wordsFormed![0].word).toBe('CAT');
  });

  test('Tiles must be placed in a straight line', () => {
    const placed: PlacedTile[] = [
      { x: 3, y: 3, letter: 'C' },
      { x: 4, y: 4, letter: 'A' }
    ];
    const res = validateBoardPlacement(placed, [], 7);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('single straight row or column');
  });

  test('Subsequent moves must connect to existing tiles', () => {
    const existing: GridCell[] = [
      { x: 3, y: 3, letter: 'C' },
      { x: 4, y: 3, letter: 'A' },
      { x: 5, y: 3, letter: 'T' }
    ];
    const placed: PlacedTile[] = [
      { x: 0, y: 0, letter: 'H' },
      { x: 0, y: 1, letter: 'E' }
    ];
    const res = validateBoardPlacement(placed, existing, 7);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('connect');
  });

  test('Contiguous placement check', () => {
    const placed: PlacedTile[] = [
      { x: 3, y: 3, letter: 'C' },
      { x: 5, y: 3, letter: 'A' } // gap at 4,3
    ];
    const res = validateBoardPlacement(placed, [], 7);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('contiguous');
  });
});

describe('WordGrid Scoring', () => {
  test('Standard word scoring (no multipliers)', () => {
    const words = [{
      word: 'CAT',
      tiles: [
        { x: 2, y: 3, letter: 'C' },
        { x: 3, y: 3, letter: 'A' },
        { x: 4, y: 3, letter: 'T' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    // C=3, A=1, T=1 (Total = 5)
    expect(res.totalScore).toBeGreaterThanOrEqual(5);
    expect(res.bingoApplied).toBe(false);
  });

  test('Double Word and Double Letter multiplier combination', () => {
    const words = [{
      word: 'DOG',
      tiles: [
        { x: 1, y: 1, letter: 'D' }, // DW multiplier
        { x: 2, y: 1, letter: 'O' },
        { x: 3, y: 1, letter: 'G' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    expect(res.totalScore).toBeGreaterThan(5);
    expect(res.bingoApplied).toBe(false);
  });

  test('No bingo when using fewer tiles than the rack holds', () => {
    const words = [{
      word: 'CAT',
      tiles: [
        { x: 3, y: 3, letter: 'C' },
        { x: 4, y: 3, letter: 'A' },
        { x: 5, y: 3, letter: 'T' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    expect(res.bingoApplied).toBe(false);
  });

  test('Bingo bonus (+50) when using all 7 rack tiles in one play', () => {
    const words = [{
      word: 'AMAZING',
      tiles: [
        { x: 5, y: 5, letter: 'A' },
        { x: 6, y: 5, letter: 'M' },
        { x: 7, y: 5, letter: 'A' },
        { x: 8, y: 5, letter: 'Z' },
        { x: 9, y: 5, letter: 'I' },
        { x: 10, y: 5, letter: 'N' },
        { x: 11, y: 5, letter: 'G' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    expect(res.bingoApplied).toBe(true);
    expect(res.totalScore).toBeGreaterThan(50);
  });

  test('Bingo applies on any turn (not just the first play)', () => {
    const existingBoard: GridCell[] = [
      { x: 0, y: 0, letter: 'S' }
    ];
    const words = [{
      word: 'END',
      tiles: [
        { x: 1, y: 1, letter: 'E' },
        { x: 2, y: 1, letter: 'N' },
        { x: 3, y: 1, letter: 'D' }
      ]
    }];
    const res = calculateTurnScore(words, 3, existingBoard);
    expect(res.bingoApplied).toBe(true);
    expect(res.totalScore).toBeGreaterThan(50);
  });

  test('Endgame sub-7 rack bingo still awards +50', () => {
    const existingBoard: GridCell[] = [
      { x: 0, y: 0, letter: 'S' },
      { x: 1, y: 0, letter: 'U' },
      { x: 2, y: 0, letter: 'N' }
    ];
    const words = [{
      word: 'AT',
      tiles: [
        { x: 1, y: 1, letter: 'A' },
        { x: 2, y: 1, letter: 'T' }
      ]
    }];
    const res = calculateTurnScore(words, 2, existingBoard);
    expect(res.bingoApplied).toBe(true);
  });
});

describe('WordGrid Blank Tiles', () => {
  // Premium layout reference for 7x7 (getPremiumCellsForGrid):
  //   TW ×3: corners (0,0) (0,6) (6,0) (6,6)
  //   DW ×2: diagonals (1,1)(2,2)(4,4)(5,5)(1,5)(2,4)(4,2)(5,1) + center (3,3)
  //   TL ×3: (2,3) (4,3) (3,2) (3,4)
  //   DL ×2: remaining cells where (x+y)%4===0 within Manhattan radius 3
  // Row y=6, x=2..4 is entirely plain (no premiums).

  test('Extraction preserves lowercase blank assignment in the word', () => {
    // "C_T" where the blank was assigned as A (stored lowercase 'a')
    const placed: PlacedTile[] = [
      { x: 3, y: 3, letter: 'C' },
      { x: 4, y: 3, letter: 'a' }, // blank assigned as A
      { x: 5, y: 3, letter: 'T' }
    ];
    const res = validateBoardPlacement(placed, [], 7);
    expect(res.isValid).toBe(true);
    expect(res.wordsFormed![0].word).toBe('CaT');
  });

  test('Blank scores 0 points (C=3 + blank 0 + T=1 = 4)', () => {
    const words = [{
      word: 'CaT',
      tiles: [
        { x: 2, y: 6, letter: 'C' },
        { x: 3, y: 6, letter: 'a' },
        { x: 4, y: 6, letter: 'T' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    expect(res.totalScore).toBe(4);
    expect(res.bingoApplied).toBe(false);
  });

  test('Word multipliers still apply to words containing blanks (TW ×3)', () => {
    // "CaT" starting at the TW corner (0,0)
    const words = [{
      word: 'CaT',
      tiles: [
        { x: 0, y: 0, letter: 'C' }, // TW
        { x: 1, y: 0, letter: 'a' },
        { x: 2, y: 0, letter: 'T' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    // C=3 + blank 0 + T=1 = 4, tripled by TW → 12
    expect(res.totalScore).toBe(12);
  });

  test('Letter multiplier under a blank contributes 0 (TL × blank = 0)', () => {
    // Blank sits on the TL at (4,3); C lands on the DL at (1,3); T on center DW
    const words = [{
      word: 'CaT',
      tiles: [
        { x: 1, y: 3, letter: 'C' }, // DL → 6
        { x: 2, y: 3, letter: 'a' }, // TL → 0 × 3 = 0
        { x: 3, y: 3, letter: 'T' }  // center DW → letter 1
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    // Letters: 6 + 0 + 1 = 7, word multiplied ×2 by center DW → 14
    expect(res.totalScore).toBe(14);
  });

  test('Committed blanks from earlier turns keep scoring 0 in later cross-words', () => {
    // Existing board already contains an old blank committed as 'a' (lowercase)
    const existingBoard: GridCell[] = [
      { x: 4, y: 3, letter: 'a' }
    ];
    // New play crosses through it vertically: T above the old blank → "Ta"
    const placed: PlacedTile[] = [{ x: 4, y: 2, letter: 'T' }];
    const res = validateBoardPlacement(placed, existingBoard, 7);
    expect(res.isValid).toBe(true);

    const scored = calculateTurnScore(res.wordsFormed!, 7, existingBoard, 7);
    // T=1 on DW (4,2), blank-a=0 on TL (4,3) → letters 1, ×2 word = 2
    expect(scored.totalScore).toBe(2);
  });

  test('Bingo counts blank tiles toward the all-tiles bonus', () => {
    const words = [{
      word: 'AMaZING', // second A is a blank
      tiles: [
        { x: 5, y: 5, letter: 'A' },
        { x: 6, y: 5, letter: 'M' },
        { x: 7, y: 5, letter: 'a' },
        { x: 8, y: 5, letter: 'Z' },
        { x: 9, y: 5, letter: 'I' },
        { x: 10, y: 5, letter: 'N' },
        { x: 11, y: 5, letter: 'G' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    expect(res.bingoApplied).toBe(true);
  });
});

import { WordGridPvPEngine, WordGridPvPState } from '../../wordgrid/WordGridPvPEngine';
import { WordGridBotEngine, WordGridBotState } from '../../wordgrid/WordGridBotEngine';

describe('WordGrid Turn Actions - Skip & Swap', () => {
  const basePvPState: WordGridPvPState = {
    matchId: 'match-123',
    gridSize: 7,
    maxPlayers: 2,
    status: 'active',
    board: [],
    tileBag: ['A', 'B', 'C', 'D', 'E'],
    players: [
      { id: 'player-1', username: 'Alice', score: 10, rack: ['H', 'E', 'L', 'L', 'O'] },
      { id: 'player-2', username: 'Bob', score: 20, rack: ['W', 'O', 'R', 'L', 'D'] },
    ],
    currentTurnIndex: 0,
    currentTurn: 'player-1',
    moves: [],
  };

  describe('PvP Skip Turn', () => {
    test('skipTurn advances the turn without altering the rack or tile bag', () => {
      const res = WordGridPvPEngine.processSkipTurn(basePvPState, 'player-1');
      expect(res.success).toBe(true);
      expect(res.updatedState?.currentTurnIndex).toBe(1);
      expect(res.updatedState?.currentTurn).toBe('player-2');
      expect(res.updatedState?.moves).toHaveLength(1);
      expect(res.updatedState?.moves?.[0].word).toBe('PASSED');
      expect(res.updatedState?.moves?.[0].score).toBe(0);
      expect(res.updatedState?.status).toBe('active');
    });

    test('fails if not the player turn', () => {
      const res = WordGridPvPEngine.processSkipTurn(basePvPState, 'player-2');
      expect(res.success).toBe(false);
    });

    test('game ends as completed when more than 2 consecutive skips occur', () => {
      const stateWithTwoPasses: WordGridPvPState = {
        ...basePvPState,
        moves: [
          { player_id: 'player-2', word: 'PASSED', score: 0, created_at: new Date().toISOString() },
          { player_id: 'player-1', word: 'PASSED', score: 0, created_at: new Date().toISOString() },
        ],
      };

      const res = WordGridPvPEngine.processSkipTurn(stateWithTwoPasses, 'player-1');
      expect(res.success).toBe(true);
      expect(res.updatedState?.status).toBe('completed');
    });

    test('game does NOT end if a scoring move happened between skips', () => {
      const stateWithInterruptedPasses: WordGridPvPState = {
        ...basePvPState,
        moves: [
          { player_id: 'player-1', word: 'PASSED', score: 0, created_at: new Date().toISOString() },
          { player_id: 'player-2', word: 'CAT', score: 12, created_at: new Date().toISOString() },
          { player_id: 'player-1', word: 'PASSED', score: 0, created_at: new Date().toISOString() },
        ],
      };

      const res = WordGridPvPEngine.processSkipTurn(stateWithInterruptedPasses, 'player-1');
      expect(res.success).toBe(true);
      expect(res.updatedState?.status).toBe('active');
    });
  });

  describe('PvP Swap Tiles', () => {
    test('swaps selected tiles when bag has tiles', async () => {
      const res = await WordGridPvPEngine.processTileExchange(basePvPState, 'player-1', ['H', 'E']);
      expect(res.success).toBe(true);
      expect(res.updatedState?.currentTurnIndex).toBe(1);
      expect(res.updatedState?.currentTurn).toBe('player-2');
      expect(res.updatedState?.moves?.[0].word).toBe('[Swapped 2 tiles]');
      expect(res.updatedState?.moves?.[0].score).toBe(0);

      const p1 = res.updatedState?.players?.find(p => p.id === 'player-1');
      expect(p1?.rack).toHaveLength(5);
      expect(res.updatedState?.tileBag).toHaveLength(5);
    });

    test('swap fails when tile bag is empty (0 tiles)', async () => {
      const emptyBagState: WordGridPvPState = {
        ...basePvPState,
        tileBag: [],
      };

      const res = await WordGridPvPEngine.processTileExchange(emptyBagState, 'player-1', ['H']);
      expect(res.success).toBe(false);
    });
  });

  describe('Bot Mode Skip & Swap', () => {
    const baseBotState: WordGridBotState = {
      matchId: 'bot-123',
      gridSize: 7,
      status: 'active',
      board: [],
      tileBag: ['X', 'Y', 'Z'],
      players: [
        { id: 'player-1', username: 'Alice', score: 5, rack: ['A', 'B', 'C'] },
        { id: 'bot', username: 'AI Bot', score: 5, rack: ['D', 'E', 'F'] },
      ],
      currentTurnIndex: 0,
      currentTurn: 'player-1',
      moves: [],
      botDifficulty: 'normal',
    };

    test('human skip passes turn to bot', () => {
      const res = WordGridBotEngine.processHumanSkip(baseBotState, 'player-1');
      expect(res.success).toBe(true);
      expect(res.updatedState?.currentTurn).toBe('bot');
      expect(res.updatedState?.moves?.[0].word).toBe('PASSED');
      expect(res.botShouldPlay).toBe(true);
    });

    test('consecutive passes (> 2) against bot end match as completed', () => {
      const stateWithTwoPasses: WordGridBotState = {
        ...baseBotState,
        moves: [
          { player_id: 'bot', word: '[Bot Swapped Tiles]', score: 0, created_at: new Date().toISOString() },
          { player_id: 'player-1', word: 'PASSED', score: 0, created_at: new Date().toISOString() },
        ],
      };

      const res = WordGridBotEngine.processHumanSkip(stateWithTwoPasses, 'player-1');
      expect(res.success).toBe(true);
      expect(res.updatedState?.status).toBe('completed');
      expect(res.botShouldPlay).toBe(false);
    });

    test('human swap against bot is rejected when tile bag is empty', () => {
      const emptyBagState: WordGridBotState = {
        ...baseBotState,
        tileBag: [],
      };

      const res = WordGridBotEngine.processHumanExchange(emptyBagState, 'player-1', ['A']);
      expect(res.success).toBe(false);
    });

    test('human swap against bot succeeds when tile bag has tiles', () => {
      const res = WordGridBotEngine.processHumanExchange(baseBotState, 'player-1', ['A']);
      expect(res.success).toBe(true);
      expect(res.updatedState?.currentTurn).toBe('bot');
      expect(res.updatedState?.moves?.[0].word).toBe('[Swapped 1 tiles]');
      expect(res.botShouldPlay).toBe(true);
    });
  });
});


