/** Maximum guesses allowed per game (standard Wordle rule). */
export const MAX_ATTEMPTS = 6;
/** Supported word lengths for daily/challenge games. */
export const WORD_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10] as const;
/** Shortest word length available. */
export const MIN_WORD_LENGTH = 3;
/** Longest word length available. */
export const MAX_WORD_LENGTH = 10;
/** Default word length for standard play. */
export const DEFAULT_WORD_LENGTH = 5;

/** Max attempts for ShapeShifter challenge mode (harder variant). */
export const SHAPESHIFTER_MAX_ATTEMPTS = 20;
/** Default max participants when a challenge doesn't specify one. */
export const DEFAULT_MAX_PARTICIPANTS = 100;
/** Word lengths used in bot marathon challenges. */
export const BOT_MARATHON_WORD_LENGTHS = [3, 4, 5, 6, 7] as const;
/** Number of sync retry attempts before showing failure. */
export const SYNC_RETRY_COUNT = 3;

/** Animation and timing values used across game logic. */
export const ANIMATION = {
   /** Duration (ms) of the shake animation on invalid guess. */
   SHAKE_DURATION: 500,
   /** Delay (ms) after a sync attempt before triggering reveal. */
   STABILIZATION_DELAY: 300,
   /** Extra buffer (ms) added to tile-reveal animation total. */
   REVEAL_BUFFER: 400,
   /** Extra ms added to TOAST_DURATION.LONG for sync-failure toasts. */
   SYNC_FAIL_TOAST_EXTRA: 1000,
   /** Minimum guess count before the hint button becomes available. */
   HINT_MIN_GUESSES: 2,
} as const;

/** Scoring values for daily and challenge games. */
export const SCORING = {
    /** Maximum base score achievable. */
    BASE_SCORE_MAX: 1000,
    /** Points awarded per correctly placed letter. */
    POINTS_PER_LETTER: 40,
    /** Points per correct letter when solved on the first try. */
    POINTS_PER_LETTER_FIRST_TRY: 60,
    /** Points per correct letter when solved on the second try. */
    POINTS_PER_LETTER_SECOND_TRY: 50,
    /** Penalty applied per yellow (present) letter. */
    YELLOW_PENALTY: 15,
    /** Score awarded per yellow letter. */
    YELLOW_SCORE: 25,
    /** Score per yellow letter on first try. */
    YELLOW_SCORE_FIRST_TRY: 35,
    /** Score per yellow letter on second try. */
    YELLOW_SCORE_SECOND_TRY: 30,
    /** Penalty per absent letter. */
    ABSENT_PENALTY: 5,
    /** Additional penalty for repeated absent letters. */
    REPEATED_ABSENT_PENALTY: 20,
    /** Score penalty for using a hint. */
    HINT_PENALTY: 100,
} as const;
