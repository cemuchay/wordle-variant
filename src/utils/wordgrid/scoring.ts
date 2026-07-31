// src/utils/wordgrid/scoring.ts

import { TILE_VALUES, getPremiumCellsForGrid } from './constants';
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
 * @param gridSize - size of the grid (default 7)
 */
export function calculateTurnScore(
  wordsFormed: { word: string; tiles: PlacedTile[] }[],
  placedTilesCount: number,
  existingBoard: GridCell[],
  gridSize = 7
): TurnScoreResult {
  const premiumCells = getPremiumCellsForGrid(gridSize);
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

    if (!tiles || tiles.length === 0 || !tiles[0]) {
      for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const baseValue = TILE_VALUES[letter] || 0;
        wordSum += baseValue;
        breakdownParts.push(`${letter}(${baseValue})`);
      }
      totalScore += wordSum;
      results.push({ word, score: wordSum, breakdown: `${breakdownParts.join(' + ')} = ${wordSum}` });
      continue;
    }

    const ref = tiles[0];
    const isHoriz = tiles.length > 1 ? (tiles[0].y === (tiles[1]?.y ?? tiles[0].y)) : true;
    const coords = tiles.map(t => (isHoriz ? t?.x : t?.y)).filter(c => c !== undefined) as number[];
    if (coords.length === 0) continue;
    const minPlaced = Math.min(...coords);
    const fixedCoord = isHoriz ? (ref.y ?? 0) : (ref.x ?? 0);

    // Go backwards to find start of the word on the board
    let start = minPlaced;
    const isCellOccupied = (c: number) => {
      const x = isHoriz ? c : fixedCoord;
      const y = isHoriz ? fixedCoord : c;
      // It's occupied if it's either in the existing board or one of the new tiles
      return existingMap.has(`${x},${y}`) || tiles.some(t => t && t.x === x && t.y === y);
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
      if (isNewTile && premiumCells[cellKey]) {
        cellPremium = premiumCells[cellKey];
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

  const isFirstPlay = existingBoard.length === 0;
  const bingoApplied = isFirstPlay && placedTilesCount === 7;
  if (bingoApplied) {
    totalScore += 50;
  }

  return {
    totalScore,
    words: results,
    bingoApplied
  };
}
