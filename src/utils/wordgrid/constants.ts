// src/utils/wordgrid/constants.ts

// src/utils/wordgrid/constants.ts

export const DEFAULT_GRID_SIZE = 7;
export const ALLOWED_GRID_SIZES = [7, 8, 9, 10, 11] as const;
export type GridSize = typeof ALLOWED_GRID_SIZES[number];

// Recommended Max Players per Grid Size
// 7x7: 2 (3 at most)
// 8x8: 3
// 9x9: 4
// 10x10 & 11x11: 4–6
export const RECOMMENDED_MAX_PLAYERS: Record<number, number> = {
  7: 3,
  8: 3,
  9: 4,
  10: 6,
  11: 6,
};

// Standard English Scrabble letter values
export const TILE_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
  '_': 0 // Blank tile
};

// Standard English Scrabble letter distribution
export const TILE_BAG_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  '_': 2 // Blank tiles
};

export type MultiplierType = 'TW' | 'DW' | 'TL' | 'DL' | 'NONE';

// Generates dynamic premium cells symmetrically based on board size (7x7 to 11x11)
export function getPremiumCellsForGrid(size: number): Record<string, MultiplierType> {
  const premium: Record<string, MultiplierType> = {};
  const max = size - 1;
  const center = Math.floor(size / 2);

  // Corners are Triple Word (TW)
  premium[`0,0`] = 'TW';
  premium[`0,${max}`] = 'TW';
  premium[`${max},0`] = 'TW';
  premium[`${max},${max}`] = 'TW';

  // Mid edges: TW for larger boards (>= 9)
  if (size >= 9) {
    premium[`0,${center}`] = 'TW';
    premium[`${max},${center}`] = 'TW';
    premium[`${center},0`] = 'TW';
    premium[`${center},${max}`] = 'TW';
  }

  // Diagonals: Double Word (DW)
  for (let i = 1; i < max; i++) {
    if (i !== center) {
      premium[`${i},${i}`] = 'DW';
      premium[`${i},${max - i}`] = 'DW';
    }
  }

  // Triple Letter (TL) cross around center
  const offset = size >= 9 ? 2 : 1;
  if (center - offset >= 0) {
    premium[`${center - offset},${center}`] = 'TL';
    premium[`${center + offset},${center}`] = 'TL';
    premium[`${center},${center - offset}`] = 'TL';
    premium[`${center},${center + offset}`] = 'TL';
  }

  // Center cell gets special Double Word or Star rating
  premium[`${center},${center}`] = 'DW';

  // Double Letter (DL) accents
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const key = `${x},${y}`;
      if (!premium[key]) {
        if ((x + y) % 4 === 0 && Math.abs(x - center) + Math.abs(y - center) <= center) {
          premium[key] = 'DL';
        }
      }
    }
  }

  return premium;
}

// Default 11x11 fallback backward compatibility map
export const PREMIUM_CELLS = getPremiumCellsForGrid(11);

export interface GridCell {
  x: number;
  y: number;
  letter: string;
  ownerId?: string | null;
  isNew?: boolean;
}

export interface PlacedTile {
  x: number;
  y: number;
  letter: string;
}

export interface WordGridPlayer {
  id: string;
  username: string;
  avatar_url?: string;
  score: number;
  rack: string[];
}

