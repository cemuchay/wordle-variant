import { getPremiumCellsForGrid } from './constants';
import type { GridCell, PlacedTile } from './constants';
import { EASY_WORDS_3, EASY_WORDS_4, EASY_WORDS_5 } from '../../data/easy-words';
import { loadWordLists } from '../../data/words';
import { validateBoardPlacement } from './boardValidation';
import { validateWordInDictionary } from './dictionary';
import { calculateTurnScore } from './scoring';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotMove {
  word: string;
  placedTiles: PlacedTile[];
  score: number;
  direction: 'horizontal' | 'vertical';
}

const VALID_2_LETTER_WORDS = [
  'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
  'BA', 'BE', 'BI', 'BO', 'BY', 'DE', 'DO', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET',
  'EW', 'FA', 'FE', 'GI', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO',
  'KA', 'KI', 'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU',
  'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OT', 'OW', 'OX', 'OY', 'PA',
  'PE', 'PI', 'PO', 'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TE', 'TI', 'TO', 'UH', 'UM', 'UN', 'UP',
  'US', 'UT', 'WE', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA',
];

let preloadedPools: Record<BotDifficulty, string[]> | null = null;

export async function preloadBotWordPools(): Promise<void> {
  if (preloadedPools) return;

  let words5: string[] = [];
  let words6: string[] = [];
  let words7: string[] = [];

  try {
    const results = await Promise.allSettled([
      loadWordLists(5).then(r => r.official),
      loadWordLists(6).then(r => r.official),
      loadWordLists(7).then(r => r.official),
    ]);
    if (results[0].status === 'fulfilled') words5 = results[0].value;
    if (results[1].status === 'fulfilled') words6 = results[1].value;
    if (results[2].status === 'fulfilled') words7 = results[2].value;
  } catch (err) {
    console.warn('Failed to load word lists for bot pool:', err);
  }

  const easySet = new Set([
    ...VALID_2_LETTER_WORDS,
    ...EASY_WORDS_3,
    ...EASY_WORDS_4,
  ]);

  const normalSet = new Set([
    ...easySet,
    ...EASY_WORDS_5,
  ]);

  const hardSet = new Set([
    ...normalSet,
    ...words5.filter(w => w.length >= 5),
    ...words6,
    ...words7,
  ]);

  preloadedPools = {
    easy: shuffleArray([...easySet]),
    normal: shuffleArray([...normalSet]),
    hard: shuffleArray([...hardSet]),
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getWordPool(difficulty: BotDifficulty): string[] {
  if (!preloadedPools) {
    throw new Error('Bot word pools not preloaded. Call preloadBotWordPools() first.');
  }
  return preloadedPools[difficulty];
}

function hasLettersInRack(word: string, rack: string[], boardMap: Map<string, string>, startX: number, startY: number, direction: 'horizontal' | 'vertical'): boolean {
  const rackCopy = [...rack.map(l => l.toUpperCase())];

  for (let i = 0; i < word.length; i++) {
    const x = direction === 'horizontal' ? startX + i : startX;
    const y = direction === 'horizontal' ? startY : startY + i;
    const key = `${x},${y}`;
    const existing = boardMap.get(key);

    if (existing) {
      if (existing !== word[i]) return false;
    } else {
      const idx = rackCopy.indexOf(word[i]);
      if (idx === -1) return false;
      rackCopy.splice(idx, 1);
    }
  }

  return true;
}

function buildPlacedTiles(
  word: string,
  startX: number,
  startY: number,
  direction: 'horizontal' | 'vertical',
  boardMap: Map<string, string>,
): PlacedTile[] {
  const tiles: PlacedTile[] = [];

  for (let i = 0; i < word.length; i++) {
    const x = direction === 'horizontal' ? startX + i : startX;
    const y = direction === 'horizontal' ? startY : startY + i;
    const key = `${x},${y}`;

    if (!boardMap.has(key)) {
      tiles.push({ x, y, letter: word[i] });
    }
  }

  return tiles;
}

function tryWordInDirection(
  word: string,
  boardMap: Map<string, string>,
  cell: GridCell,
  direction: 'horizontal' | 'vertical',
  gridSize: number,
  rack: string[],
): { placedTiles: PlacedTile[]; startX: number; startY: number } | null {
  const charIdx = word.indexOf(cell.letter.toUpperCase());
  if (charIdx === -1) return null;

  const startX = direction === 'horizontal' ? cell.x - charIdx : cell.x;
  const startY = direction === 'vertical' ? cell.y - charIdx : cell.y;

  if (startX < 0 || startY < 0) return null;
  if (direction === 'horizontal' && startX + word.length > gridSize) return null;
  if (direction === 'vertical' && startY + word.length > gridSize) return null;

  if (!hasLettersInRack(word, rack, boardMap, startX, startY, direction)) return null;

  const placedTiles = buildPlacedTiles(word, startX, startY, direction, boardMap);
  if (placedTiles.length === 0) return null;

  return { placedTiles, startX, startY };
}

function tryWordOnEmptyBoard(
  word: string,
  gridSize: number,
  rack: string[],
): { placedTiles: PlacedTile[] } | null {
  const center = Math.floor(gridSize / 2);
  const boardMap = new Map<string, string>();
  const direction = 'horizontal' as const;
  const startX = Math.max(0, center - Math.floor(word.length / 2));
  const startY = center;

  if (startX + word.length > gridSize) return null;
  if (!hasLettersInRack(word, rack, boardMap, startX, startY, direction)) return null;

  const placedTiles = word.split('').map((letter, i) => ({
    x: startX + i,
    y: startY,
    letter,
  }));

  return { placedTiles };
}

interface CandidateMove {
  word: string;
  placedTiles: PlacedTile[];
  score: number;
  direction: 'horizontal' | 'vertical';
  premiumCount: number;
}

function isPremiumBlockingCell(x: number, y: number, premiumCells: Record<string, string>): boolean {
  const cellType = premiumCells[`${x},${y}`] || 'NONE';
  return cellType === 'TW' || cellType === 'DW';
}

async function validateCandidateMove(
  placedTiles: PlacedTile[],
  board: GridCell[],
  gridSize: number,
  direction: 'horizontal' | 'vertical',
  premiumCells: Record<string, string>,
): Promise<CandidateMove | null> {
  const validation = validateBoardPlacement(placedTiles, board, gridSize);
  if (!validation.isValid || !validation.wordsFormed || validation.wordsFormed.length === 0) {
    return null;
  }

  for (const formed of validation.wordsFormed) {
    const isValidDict = await validateWordInDictionary(formed.word);
    if (!isValidDict) {
      return null;
    }
  }

  const scoreResult = calculateTurnScore(validation.wordsFormed, placedTiles.length, board, gridSize);
  const premiumCount = placedTiles.filter(t => isPremiumBlockingCell(t.x, t.y, premiumCells)).length;

  return {
    word: validation.wordsFormed.map(w => w.word).join(', '),
    placedTiles,
    score: scoreResult.totalScore,
    direction,
    premiumCount,
  };
}

export async function findBotWordMove(
  board: GridCell[],
  rack: string[],
  gridSize: number,
  difficulty: BotDifficulty,
): Promise<BotMove | null> {
  const pool = getWordPool(difficulty);
  const boardMap = new Map<string, string>();
  board.forEach((c) => boardMap.set(`${c.x},${c.y}`, c.letter.toUpperCase()));
  const rackUpper = rack.map((l) => l.toUpperCase());
  const premiumCells = getPremiumCellsForGrid(gridSize);
  const candidates: CandidateMove[] = [];

  if (board.length === 0) {
    for (const w of pool) {
      const result = tryWordOnEmptyBoard(w, gridSize, rackUpper);
      if (result) {
        const candidate = await validateCandidateMove(result.placedTiles, board, gridSize, 'horizontal', premiumCells);
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }
  } else {
    for (const w of pool) {
      for (const cell of board) {
        for (const direction of ['horizontal', 'vertical'] as const) {
          const result = tryWordInDirection(w, boardMap, cell, direction, gridSize, rackUpper);
          if (!result) continue;

          const candidate = await validateCandidateMove(result.placedTiles, board, gridSize, direction, premiumCells);
          if (candidate) {
            candidates.push(candidate);
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  if (difficulty === 'easy') {
    const bottomHalf = candidates
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.max(1, Math.floor(candidates.length / 2)));
    const pick = bottomHalf[Math.floor(Math.random() * bottomHalf.length)];
    return { word: pick.word, placedTiles: pick.placedTiles, score: pick.score, direction: pick.direction };
  }

  if (difficulty === 'normal') {
    const top = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(3, candidates.length));
    const pick = top[Math.floor(Math.random() * top.length)];
    return { word: pick.word, placedTiles: pick.placedTiles, score: pick.score, direction: pick.direction };
  }

  const scored = candidates.map(c => ({
    ...c,
    effectiveScore: c.score + c.premiumCount * 15,
  }));

  scored.sort((a, b) => b.effectiveScore - a.effectiveScore);

  const best = scored[0];

  return { word: best.word, placedTiles: best.placedTiles, score: best.score, direction: best.direction };
}
