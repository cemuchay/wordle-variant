// src/utils/wordgrid/boardValidation.ts

import type { GridCell, PlacedTile } from './constants';
import { DEFAULT_GRID_SIZE } from './constants';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  wordsFormed?: { word: string; tiles: PlacedTile[] }[];
}

/**
 * Validates a proposed move on the WordGrid board.
 * Returns whether the placement is valid and extracts all newly formed words.
 */
export function validateBoardPlacement(
  placedTiles: PlacedTile[],
  existingBoard: GridCell[],
  gridSize = DEFAULT_GRID_SIZE
): ValidationResult {
  if (placedTiles.length === 0) {
    return { isValid: false, error: 'No tiles placed.' };
  }

  const centerCell = Math.floor(gridSize / 2);

  // Create a fast-lookup map for existing tiles
  const boardMap = new Map<string, string>();
  existingBoard.forEach((cell) => {
    boardMap.set(`${cell.x},${cell.y}`, cell.letter.toUpperCase());
  });

  // Check if target cells are already occupied
  for (const tile of placedTiles) {
    if (boardMap.has(`${tile.x},${tile.y}`)) {
      return { isValid: false, error: `Cell at (${tile.x}, ${tile.y}) is already occupied.` };
    }
  }

  const isFirstMove = existingBoard.length === 0;

  // 1. First move must touch the center cell
  if (isFirstMove) {
    const touchesCenter = placedTiles.some((t) => t.x === centerCell && t.y === centerCell);
    if (!touchesCenter) {
      return { isValid: false, error: `The first word must cover the center cell (${centerCell},${centerCell}).` };
    }
  }

  // 2. Alignment Check: all placed tiles must be in the same row or column
  let direction: 'horizontal' | 'vertical' | null = null;
  if (placedTiles.length > 1) {
    const sameRow = placedTiles.every((t) => t.y === placedTiles[0].y);
    const sameCol = placedTiles.every((t) => t.x === placedTiles[0].x);

    if (!sameRow && !sameCol) {
      return { isValid: false, error: 'Tiles must be placed in a single straight row or column.' };
    }
    direction = sameRow ? 'horizontal' : 'vertical';
  }

  // 3. Connectivity check: if not the first move, at least one tile must touch an existing tile
  if (!isFirstMove) {
    let connects = false;
    for (const tile of placedTiles) {
      const neighbors = [
        { x: tile.x + 1, y: tile.y },
        { x: tile.x - 1, y: tile.y },
        { x: tile.x, y: tile.y + 1 },
        { x: tile.x, y: tile.y - 1 },
      ];
      if (neighbors.some((n) => boardMap.has(`${n.x},${n.y}`))) {
        connects = true;
        break;
      }
    }
    if (!connects) {
      return { isValid: false, error: 'Placed word must connect with existing tiles on the board.' };
    }
  }

  // 4. Contiguous check: the placed tiles (plus any existing tiles in between them) must form a solid line
  const tempBoard = new Map(boardMap);
  placedTiles.forEach((tile) => {
    tempBoard.set(`${tile.x},${tile.y}`, tile.letter.toUpperCase());
  });

  if (placedTiles.length > 1) {
    if (direction === 'horizontal') {
      const y = placedTiles[0].y;
      const minX = Math.min(...placedTiles.map((t) => t.x));
      const maxX = Math.max(...placedTiles.map((t) => t.x));
      for (let x = minX; x <= maxX; x++) {
        if (!tempBoard.has(`${x},${y}`)) {
          return { isValid: false, error: 'The placed word must be contiguous, with no empty gaps.' };
        }
      }
    } else {
      const x = placedTiles[0].x;
      const minY = Math.min(...placedTiles.map((t) => t.y));
      const maxY = Math.max(...placedTiles.map((t) => t.y));
      for (let y = minY; y <= maxY; y++) {
        if (!tempBoard.has(`${x},${y}`)) {
          return { isValid: false, error: 'The placed word must be contiguous, with no empty gaps.' };
        }
      }
    }
  }

  // 5. Extract ALL words on the grid ("Nerve" validation)
  // Scan the complete board to ensure EVERY contiguous line of 2+ letters (both horizontal and vertical) is returned for validation
  const wordsFormed: { word: string; tiles: PlacedTile[] }[] = [];
  const processedKeys = new Set<string>();

  // Helper to extract placed tiles contributing to a word
  const getPlacedTilesForWord = (
    startX: number,
    startY: number,
    length: number,
    isHoriz: boolean
  ): PlacedTile[] => {
    const tiles: PlacedTile[] = [];
    for (let i = 0; i < length; i++) {
      const x = isHoriz ? startX + i : startX;
      const y = isHoriz ? startY : startY + i;
      const key = `${x},${y}`;
      if (!boardMap.has(key)) {
        const pTile = placedTiles.find((t) => t.x === x && t.y === y);
        if (pTile) {
          tiles.push(pTile);
        }
      }
    }
    return tiles;
  };

  // Horizontal scan across entire grid
  for (let y = 0; y < gridSize; y++) {
    let currentWord = '';
    let startX = -1;

    for (let x = 0; x <= gridSize; x++) {
      const key = `${x},${y}`;
      const letter = tempBoard.get(key);

      if (letter && x < gridSize) {
        if (currentWord === '') startX = x;
        currentWord += letter;
      } else {
        if (currentWord.length > 1) {
          const wordKey = `H:${startX},${y}:${currentWord.length}`;
          if (!processedKeys.has(wordKey)) {
            processedKeys.add(wordKey);
            const tiles = getPlacedTilesForWord(startX, y, currentWord.length, true);
            wordsFormed.push({ word: currentWord, tiles });
          }
        }
        currentWord = '';
        startX = -1;
      }
    }
  }

  // Vertical scan across entire grid
  for (let x = 0; x < gridSize; x++) {
    let currentWord = '';
    let startY = -1;

    for (let y = 0; y <= gridSize; y++) {
      const key = `${x},${y}`;
      const letter = tempBoard.get(key);

      if (letter && y < gridSize) {
        if (currentWord === '') startY = y;
        currentWord += letter;
      } else {
        if (currentWord.length > 1) {
          const wordKey = `V:${x},${startY}:${currentWord.length}`;
          if (!processedKeys.has(wordKey)) {
            processedKeys.add(wordKey);
            const tiles = getPlacedTilesForWord(x, startY, currentWord.length, false);
            wordsFormed.push({ word: currentWord, tiles });
          }
        }
        currentWord = '';
        startY = -1;
      }
    }
  }

  // First move edge case: single tile word
  if (isFirstMove && placedTiles.length === 1 && wordsFormed.length === 0) {
    wordsFormed.push({
      word: placedTiles[0].letter.toUpperCase(),
      tiles: [placedTiles[0]],
    });
  }

  return {
    isValid: true,
    wordsFormed,
  };
}



