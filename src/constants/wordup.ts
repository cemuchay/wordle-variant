/** Default and boundary values for chess-style ELO rating calculations. */
export const RATING = {
   /** Starting/default rating for new players. */
   DEFAULT: 600,
   /** Minimum possible rating (floor). */
   FLOOR: 600,
   /** Default opponent rating when unknown. */
   DEFAULT_OPPONENT: 1000,
   /** K-factor controlling how much a single match affects ELO. */
   K_FACTOR: 32,
   /** Divisor in the ELO expected-score formula (standard chess value). */
   DIVISOR: 400,
   /** Minimum ELO a player can gain when winning (safety clamp). */
   MIN_GAIN_ON_WIN: 2,
   /** Maximum ELO a player can lose when losing (safety clamp). */
   MAX_LOSS_ON_LOSS: -2,
} as const;

/** Inactivity decay rules for ELO rating. */
export const INACTIVITY = {
   /** Number of days of inactivity before rating decay kicks in. */
   THRESHOLD_DAYS: 7,
   /** ELO points deducted per full week of inactivity. */
   DECAY_PER_WEEK: 15,
} as const;

/** Rank tiers with rating thresholds and display metadata. */
export const RANKS = {
   MASTER: { THRESHOLD: 1700, NAME: "Master", COLOR: "text-purple-400" },
   DIAMOND: { THRESHOLD: 1400, NAME: "Diamond", COLOR: "text-cyan-400" },
   GOLD: { THRESHOLD: 1100, NAME: "Gold", COLOR: "text-yellow-400" },
   SILVER: { THRESHOLD: 800, NAME: "Silver", COLOR: "text-slate-300" },
   BRONZE: { THRESHOLD: 0, NAME: "Bronze", COLOR: "text-amber-600" },
} as const;

/** Experience point reward values for match completion. */
export const XP = {
   /** Base XP awarded for completing a match. */
   BASE_REWARD: 50,
   /** Bonus XP awarded for winning. */
   WIN_BONUS: 100,
   /** XP awarded per correctly answered question. */
   PER_CORRECT: 10,
} as const;

/** Core game configuration for WordUp Battles. */
export const WORDUP_GAME = {
   /** Number of questions/rounds per match. */
   TOTAL_ROUNDS: 7,
   /** Maximum entries fetched for the leaderboard. */
   LEADERBOARD_LIMIT: 30,
   /** Maximum history matches fetched per player. */
   HISTORY_FETCH_LIMIT: 15,
   /** Hours after which an unmatched match auto-expires. */
   MATCH_EXPIRY_HOURS: 24,
   /** Hours after which completed-match notifications are hidden. */
   NOTIFICATION_CUTOFF_HOURS: 48,
} as const;

/** ELO ratings assigned to bot difficulty profiles. */
export const BOT_PROFILES_RATINGS: Record<string, number> = {
   impossible: 2200,
   master: 1800,
   expert: 1400,
   gold: 1400,
   average: 1000,
   slow_thinker: 800,
} as const;

/** Timeout and interval durations for WordUp match flow. */
export const WORDUP_TIMEOUT = {
   /** Safety timer (ms) — aborts to lobby if game doesn't start. */
   SAFETY: 15000,
   /** Matchmaking search timeout (ms) before falling back to bot. */
   MATCHMAKING: 8000,
   /** Delay (ms) before auto-matching with a bot after queue expires. */
   BOT_FALLBACK: 30000,
   /** How long (ms) an invite ring notification is shown. */
   INVITE_RING: 15000,
   /** Interval (ms) between countdown ticks. */
   COUNTDOWN_INTERVAL: 1000,
   /** Starting countdown value before a match begins. */
   COUNTDOWN_START: 3,
   /** Default duration (ms) for WordUp toast notifications. */
   TOAST_DURATION: 4000,
} as const;

/** Input and display limits for WordUp screens. */
export const WORDUP_LIMITS = {
   /** Maximum characters for a nickname. */
   MAX_NICKNAME_LENGTH: 15,
   /** Minimum characters required for a nickname. */
   MIN_NICKNAME_LENGTH: 3,
   /** Maximum characters in a chat/input message. */
   MAX_MESSAGE_LENGTH: 300,
   /** Maximum recently-used categories stored. */
   MAX_RECENT_CATEGORIES: 5,
   /** Maximum players shown in a list before truncation. */
   MAX_PLAYER_DISPLAY: 10,
} as const;

/** Time limit (seconds) per question type. */
export const QUESTION_DURATION: Record<string, number> = {
   real_fake: 8,
   length: 8,
   missing_letter: 8,
   definition: 12,
   anagram: 12,
   anagram_scrambled: 12,
   pattern: 12,
   math: 12,
   odd_one_out: 12,
   synonym_match: 12,
   word_chain: 12,
   letter_shift: 12,
   compound_break: 12,
   cryptogram: 12,
   category_sort: 12,
   letter_add_remove: 12,
   reverse_wordle: 15,
   word_within: 20,
   /** Fallback duration for unknown question types. */
   default: 10,
} as const;

/** Confetti particle burst configuration. */
export const CONFETTI = {
   /** Number of particles spawned on correct answer. */
   PARTICLE_COUNT: 30,
   /** Minimum radial travel distance (px). */
   MIN_DISTANCE: 90,
   /** Maximum radial travel distance variance (px). */
   MAX_DISTANCE: 140,
   /** Minimum particle diameter (px). */
   MIN_SIZE: 6,
   /** Maximum particle diameter variance (px). */
   MAX_SIZE: 12,
   /** Minimum animation duration (s). */
   MIN_DURATION: 0.8,
   /** Maximum animation duration variance (s). */
   MAX_DURATION: 0.4,
   /** Available particle colors. */
   COLORS: ["#4ade80", "#2ec871", "#facc15", "#38bdf8", "#ec4899", "#a855f7"],
   /** Available particle shapes. */
   SHAPES: ["circle", "square", "triangle"],
} as const;

/** Floating chat bubble layout and timing. */
export const CHAT_BUBBLE = {
   /** How long (ms) a bubble stays visible. */
   DURATION: 2500,
   /** Fade-out animation duration (s). */
   FADE_DURATION: 2.2,
   /** Horizontal position base for player-1 bubbles (%). */
   POSITION_X_BASE: 15,
   /** Horizontal position variance for player-1 bubbles (%). */
   POSITION_X_VARIANCE: 30,
   /** Horizontal position base for opponent bubbles (%). */
   POSITION_X_OPP_BASE: 55,
   /** Horizontal position variance for opponent bubbles (%). */
   POSITION_X_OPP_VARIANCE: 30,
   /** Vertical position base for all bubbles (%). */
   POSITION_Y_BASE: 70,
   /** Vertical position variance for all bubbles (%). */
   POSITION_Y_VARIANCE: 15,
} as const;

/** Character-length thresholds that control question-prompt font size. */
export const PROMPT_FONT_SIZE = {
   /** Prompts above this length get the smallest font class. */
   LONG_THRESHOLD: 80,
   /** Prompts above this length (but below LONG) get a medium font class. */
   MEDIUM_THRESHOLD: 50,
} as const;

/** Character-length thresholds that control answer-choice font size. */
export const CHOICE_FONT_SIZE = {
   /** Choices above this length get the smallest font class. */
   LONG_THRESHOLD: 25,
   /** Choices above this length (but below LONG) get a medium font class. */
   MEDIUM_THRESHOLD: 15,
} as const;

/** Delay (ms) before recovering an active game after a page refresh. */
export const RECOVERY_DELAY = 100;
