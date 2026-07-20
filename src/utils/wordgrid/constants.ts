// src/utils/wordgrid/constants.ts

export const BOARD_SIZE = 11;
export const CENTER_CELL = 5; // (5, 5) is the 0-indexed center of an 11x11 board

// Standard English Scrabble letter values
export const TILE_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
  '_': 0 // Blank tile
};

// Standard English Scrabble letter distribution (modified slightly for faster/smaller games if necessary)
export const TILE_BAG_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  '_': 2 // Blank tiles
};

export type MultiplierType = 'TW' | 'DW' | 'TL' | 'DL' | 'NONE';

// 11x11 Premium Multiplier coordinates (symmetric distribution)
export const PREMIUM_CELLS: Record<string, MultiplierType> = {
  // Triple Word (TW) - corners and mid-edges
  '0,0': 'TW', '0,5': 'TW', '0,10': 'TW',
  '5,0': 'TW',              '5,10': 'TW',
  '10,0': 'TW', '10,5': 'TW', '10,10': 'TW',

  // Double Word (DW) - diagonal rings
  '1,1': 'DW', '1,9': 'DW',
  '2,2': 'DW', '2,8': 'DW',
  '3,3': 'DW', '3,7': 'DW',
  '4,4': 'DW', '4,6': 'DW',
  '6,4': 'DW', '6,6': 'DW',
  '7,3': 'DW', '7,7': 'DW',
  '8,2': 'DW', '8,8': 'DW',
  '9,1': 'DW', '9,9': 'DW',

  // Triple Letter (TL)
  '1,5': 'TL', '5,1': 'TL', '5,9': 'TL', '9,5': 'TL',
  '5,5': 'TL', // Center tile is a TL in our simplified distribution

  // Double Letter (DL)
  '2,4': 'DL', '2,6': 'DL',
  '4,2': 'DL', '4,8': 'DL',
  '6,2': 'DL', '6,8': 'DL',
  '8,4': 'DL', '8,6': 'DL',
};

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
