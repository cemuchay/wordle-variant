export const CHALLENGE_CONFIG = {
    DEFAULT_LIVE_MAX_TIME: 5, // minutes
    TIME_BUFFER: 2, // minutes buffer for LIVE matches
    MARATHON_LENGTHS: [3, 4, 5, 6, 7] as const,
} as const;
