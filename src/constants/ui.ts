/** Duration (ms) for toast notification visibility. */
export const TOAST_DURATION = {
   /** Brief toast. */
   SHORT: 2000,
   /** Standard toast. */
   DEFAULT: 3000,
   /** Long toast. */
   LONG: 4000,
   /** Extra-long toast. */
   VERY_LONG: 5000,
   /** Extremely -long toast. */
   EXTRA_LONG: 10000,
} as const;

/** Z-index values for layered UI elements (higher = on top). */
export const Z_INDEX = {
   /** Backdrop behind modals. */
   MODAL_BACKDROP: 50,
   /** Foreground modal content. */
   MODAL_CONTENT: 60,
   /** Stats modal layer. */
   STATS_MODAL: 120,
   /** Guess-preview overlay. */
   GUESS_PREVIEW: 130,
   /** Announcement modal layer. */
   ANNOUNCEMENT_MODAL: 150,
   /** Auth modal layer. */
   AUTH_MODAL: 200,
   /** Toast notifications. */
   TOAST: 300,
   /** Dynamic Island status overlay (highest priority). */
   DYNAMIC_ISLAND: 999,
} as const;

/** Duration (ms) for various animations. */
export const ANIMATION_DURATION = {
   /** Quick transition. */
   FAST: 200,
   /** Standard transition. */
   NORMAL: 300,
   /** Per-tile reveal in the guess grid. */
   TILE_REVEAL: 400,
   /** Per-tile reveal for longer words (7+ letters). */
   TILE_REVEAL_LONG: 600,
   /** Shake animation on invalid guess. */
   SHAKE: 500,
} as const;
