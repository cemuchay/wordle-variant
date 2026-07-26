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

/** Retry configuration for network operations. */
export const RETRY = {
   SYNC_DELAY: 1000,
   PUSH_COUNT: 3,
   QUEUE_MAX: 3,
   NETWORK_GATE_MAX: 5,
   SYNC_COUNT: 3,
} as const;

/** Timeouts and delay values used across the app. */
export const TIMEOUT = {
   CHANNEL_CLEANUP: 1000,
   RECONNECT_GRACE: 5000,
   RECONNECT_CHECK: 4000,
   PRELOAD: 2000,
   QUEUE_PROCESS: 500,
   STORAGE_FLUSH: 500,
   TYPING: 2000,
   HEARTBEAT_INTERVAL: 2 * 60 * 1000,
   AVATAR_CLICK_RESET: 1500,
   LEADERBOARD_REFRESH: 1500,
   BOT_TURN: 600,
   DRAFT_DEBOUNCE: 300,
   IMAGE_RETRY: 200,
   SCROLL: 150,
   MESSAGE_SYNC_THROTTLE: 10000,
   REFRESH_AFTER_HIDDEN: 30 * 60 * 1000,
   AUDIO_RECONNECT: 90000,
} as const;

/** Page size and limit constants for data fetching. */
export const LIMITS = {
   NOTIFICATIONS: 50,
   PRESENCE: 100,
   MESSAGES: 300,
   COMMENTS: 3,
   RECENT_PLAYERS: 5,
   ADMIN_PAGE: 1000,
   MARATHON_SORT: 15,
} as const;

/** Layout and dimension values. */
export const LAYOUT = {
   COMPACT_GRID_THRESHOLD: 6,
   GRID_PADDING_COMPACT: 16,
   GRID_PADDING: 32,
   GRID_EXTRA_WIDTH: 32,
   GRID_RESIZE_SCALE: 0.85,
} as const;

/** Wrapped modal canvas and timing. */
export const WRAPPED = {
   CANVAS_WIDTH: 1080,
   CANVAS_HEIGHT: 1920,
   SLIDE_DURATION: 4000,
} as const;

/** Misc domain constants. */
export const MISC = {
   MESSAGE_PURGE_DAYS: 7,
   DEFAULT_CHALLENGE_DAYS: 7,
   CACHE_EXPIRATION_MS: 24 * 60 * 60 * 1000,
   MESSAGE_EDIT_TIMEOUT: 5 * 60 * 1000,
   PUSH_THROTTLE_HOURS: 24,
   VS_STAGGER: 0.1,
   LOADING_STAGGER: 0.1,
} as const;
