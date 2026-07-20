// src/utils/wordgrid/scoring.ts

import { TILE_VALUES, PREMIUM_CELLS } from './constants';
import type { GridCell, PlacedTile } from './constants';

export interface WordScoreResult {
  word: string;
  score: number;
  breakdown: string;
}

export interface TurnScoreResult {
  totalScore: number;
  words: WordScoreResult[];
  bingoApplied: boolean;
}

/**
 * Calculates the score of a turn.
 * @param wordsFormed - list of words formed with their new tiles
 * @param placedTilesCount - number of tiles placed in this turn (to check for 7-tile bingo)
 * @param existingBoard - existing tiles on the board before this turn
 */
export function calculateTurnScore(
  wordsFormed: { word: string; tiles: PlacedTile[] }[],
  placedTilesCount: number,
  existingBoard: GridCell[]
): TurnScoreResult {
  // Map of existing tiles for quick lookup of already placed cells
  const existingMap = new Map<string, boolean>();
  existingBoard.forEach(c => {
    existingMap.set(`${c.x},${c.y}`, true);
  });

  const results: WordScoreResult[] = [];
  let totalScore = 0;

  for (const item of wordsFormed) {
    const { word, tiles } = item;
    let wordSum = 0;
    let wordMultiplier = 1;
    const breakdownParts: string[] = [];

    // Find the direction of the word (horizontal or vertical)
    // If tiles.length > 0, we can determine the line.
    // If tiles.length is 0, this shouldn't happen for a newly formed word.
    const isHoriz = tiles.length > 0 ? (tiles.length === 1 ? true : tiles[0].y === tiles[1].y) : true;
    const ref = tiles[0];

    // To trace the word coordinates, let's find the start and end of the word.
    // Let's deduce the full sequence of cells for this word.
    // Since we know the letters, we can find the min and max coordinates of the tiles in the word's line.
    const coords = tiles.map(t => isHoriz ? t.x : t.y);
    const minPlaced = Math.min(...coords);
    const fixedCoord = isHoriz ? ref.y : ref.x;

    // Go backwards to find start of the word on the board
    let start = minPlaced;
    const isCellOccupied = (c: number) => {
      const x = isHoriz ? c : fixedCoord;
      const y = isHoriz ? fixedCoord : c;
      // It's occupied if it's either in the existing board or one of the new tiles
      return existingMap.has(`${x},${y}`) || tiles.some(t => t.x === x && t.y === y);
    };

    while (start > 0 && isCellOccupied(start - 1)) {
      start--;
    }

    // Now loop over the length of the word
    for (let i = 0; i < word.length; i++) {
      const currentCoord = start + i;
      const x = isHoriz ? currentCoord : fixedCoord;
      const y = isHoriz ? fixedCoord : currentCoord;
      const letter = word[i];
      const baseValue = TILE_VALUES[letter] || 0;

      const cellKey = `${x},${y}`;
      const isNewTile = tiles.some(t => t.x === x && t.y === y);

      let letterMultiplier = 1;
      let cellPremium = 'NONE';

      // Multipliers only apply if it is a NEW tile placed on a premium cell
      if (isNewTile && PREMIUM_CELLS[cellKey]) {
        cellPremium = PREMIUM_CELLS[cellKey];
        if (cellPremium === 'DL') {
          letterMultiplier = 2;
        } else if (cellPremium === 'TL') {
          letterMultiplier = 3;
        } else if (cellPremium === 'DW') {
          wordMultiplier *= 2;
        } else if (cellPremium === 'TW') {
          wordMultiplier *= 3;
        }
      }

      const cellScore = baseValue * letterMultiplier;
      wordSum += cellScore;

      // Log to breakdown
      if (letterMultiplier > 1) {
        breakdownParts.push(`${letter}(${baseValue}x${letterMultiplier})`);
      } else if (cellPremium === 'DW' || cellPremium === 'TW') {
        breakdownParts.push(`${letter}(${baseValue}, ${cellPremium})`);
      } else {
        breakdownParts.push(`${letter}(${baseValue})`);
      }
    }

    const wordScore = wordSum * wordMultiplier;
    totalScore += wordScore;

    let breakdownStr = breakdownParts.join(' + ');
    if (wordMultiplier > 1) {
      breakdownStr = `(${breakdownStr}) x ${wordMultiplier} = ${wordScore}`;
    } else {
      breakdownStr = `${breakdownStr} = ${wordScore}`;
    }

    results.push({
      word,
      score: wordScore,
      breakdown: breakdownStr
    });
  }

  const bingoApplied = placedTilesCount === 7;
  if (bingoApplied) {
    totalScore += 50;
  }

  return {
    totalScore,
    words: results,
    bingoApplied
  };
}
