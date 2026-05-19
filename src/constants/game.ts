export const MAX_ATTEMPTS = 6;
export const WORD_LENGTHS = [3, 4, 5, 6, 7] as const;
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 7;
export const DEFAULT_WORD_LENGTH = 5;

export const SCORING = {
    BASE_SCORE_MAX: 1000,
    POINTS_PER_LETTER: 40,
    POINTS_PER_LETTER_FIRST_TRY: 60,
    POINTS_PER_LETTER_SECOND_TRY: 50,
    YELLOW_PENALTY: 15,
    YELLOW_SCORE: 25,
    ABSENT_PENALTY: 5,
    REPEATED_ABSENT_PENALTY: 20,
    HINT_PENALTY: 100,
} as const;
