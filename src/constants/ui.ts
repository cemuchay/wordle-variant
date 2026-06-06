export const TOAST_DURATION = {
   SHORT: 2000,
   DEFAULT: 3000,
   LONG: 4000,
} as const;

export const Z_INDEX = {
   MODAL_BACKDROP: 50,
   MODAL_CONTENT: 60,
   STATS_MODAL: 120,
   GUESS_PREVIEW: 130,
   ANNOUNCEMENT_MODAL: 150,
   AUTH_MODAL: 200,
   TOAST: 300,
} as const;

export const ANIMATION_DURATION = {
   FAST: 200,
   NORMAL: 300,
   TILE_REVEAL: 350,
} as const;
