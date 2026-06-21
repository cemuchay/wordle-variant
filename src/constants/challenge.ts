/** Configuration for challenge-mode game parameters. */
export const CHALLENGE_CONFIG = {
    /** Default timer (minutes) for LIVE challenge matches. */
    DEFAULT_LIVE_MAX_TIME: 5,
    /** Buffer (minutes) added to LIVE match timers. */
    TIME_BUFFER: 2,
    /** Word lengths used in marathon challenges. */
    MARATHON_LENGTHS: [3, 4, 5, 6, 7] as const,
} as const;

/** Constraints on user input and display within challenges. */
export const CHALLENGE_LIMITS = {
   /** Maximum characters for a challenge nickname. */
   MAX_NICKNAME_LENGTH: 15,
   /** Minimum characters required for a challenge nickname. */
   MIN_NICKNAME_LENGTH: 3,
   /** Maximum characters in a chat message. */
   MAX_MESSAGE_LENGTH: 300,
   /** Maximum opponent avatars shown in the facepile. */
   MAX_OPPONENT_AVATARS: 3,
   /** Maximum connection-log entries displayed. */
   MAX_CONNECTION_LOGS: 5,
} as const;

/** Timeout and duration values for challenge interactions. */
export const CHALLENGE_TIMEOUT = {
   /** Time window (ms) during which a message can be edited. */
   EDIT_TIME_LIMIT: 5 * 60 * 1000,
   /** Duration (ms) for mode-description toasts. */
   TOAST_MODE_DESCRIPTION: 12000,
} as const;
