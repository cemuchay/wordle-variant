// src/utils/wordgrid/boardValidation.ts

import type { GridCell, PlacedTile } from './constants';

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
  gridSize = 11
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

  // 5. Extract all newly formed words
  const wordsFormed: { word: string; tiles: PlacedTile[] }[] = [];

  if (placedTiles.length === 1) {
    const horizWord = getWordAt(placedTiles[0].x, placedTiles[0].y, 'horizontal', tempBoard, boardMap, gridSize);
    if (horizWord && horizWord.word.length > 1) {
      wordsFormed.push(horizWord);
    }
    const vertWord = getWordAt(placedTiles[0].x, placedTiles[0].y, 'vertical', tempBoard, boardMap, gridSize);
    if (vertWord && vertWord.word.length > 1) {
      wordsFormed.push(vertWord);
    }

    if (wordsFormed.length === 0) {
      if (isFirstMove) {
        wordsFormed.push({
          word: placedTiles[0].letter.toUpperCase(),
          tiles: [placedTiles[0]],
        });
      } else {
        return { isValid: false, error: 'Placed tile must touch another tile to form a valid word.' };
      }
    }
  } else {
    const primaryDir = direction!;
    const refTile = placedTiles[0];
    const primaryWord = getWordAt(refTile.x, refTile.y, primaryDir, tempBoard, boardMap, gridSize);
    if (primaryWord) {
      wordsFormed.push(primaryWord);
    }

    const secondaryDir = primaryDir === 'horizontal' ? 'vertical' : 'horizontal';
    for (const tile of placedTiles) {
      const crossWord = getWordAt(tile.x, tile.y, secondaryDir, tempBoard, boardMap, gridSize);
      if (crossWord && crossWord.word.length > 1) {
        wordsFormed.push(crossWord);
      }
    }
  }

  return {
    isValid: true,
    wordsFormed,
  };
}

/**
 * Traces a line horizontally or vertically to find a word containing (startX, startY).
 */
function getWordAt(
  startX: number,
  startY: number,
  dir: 'horizontal' | 'vertical',
  tempBoard: Map<string, string>,
  boardMap: Map<string, string>,
  gridSize: number
): { word: string; tiles: PlacedTile[] } | null {
  const isHoriz = dir === 'horizontal';
  let minCoord = isHoriz ? startX : startY;
  let maxCoord = isHoriz ? startX : startY;

  const getKey = (c: number) => (isHoriz ? `${c},${startY}` : `${startX},${c}`);

  // Trace backwards
  while (minCoord > 0 && tempBoard.has(getKey(minCoord - 1))) {
    minCoord--;
  }
  // Trace forwards
  while (maxCoord < gridSize - 1 && tempBoard.has(getKey(maxCoord + 1))) {
    maxCoord++;
  }

  if (minCoord === maxCoord) {
    return null;
  }

  let word = '';
  const tiles: PlacedTile[] = [];

  for (let c = minCoord; c <= maxCoord; c++) {
    const key = getKey(c);
    const letter = tempBoard.get(key)!;
    word += letter;

    if (!boardMap.has(key)) {
      tiles.push({
        x: isHoriz ? c : startX,
        y: isHoriz ? startY : c,
        letter,
      });
    }
  }

  return { word, tiles };
}

