/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ChallengeGameState {
    guesses: any[];
    currentGuess: string;
    letterStatuses: Record<string, any>;
    isGameOver: boolean;
    isShake: boolean;
    usedHint: boolean;
    hintRecord: { letter: string; index: number; row?: number } | null;
    timeLeft: number | null;
    status: 'pending' | 'playing' | 'completed' | 'timed_out';
}

export type ChallengeGameAction =
    | { type: 'START_GAME'; payload: { guesses: any[], letterStatuses: any, usedHint: boolean, hintRecord: any, timeLeft: number | null, isGameOver: boolean, status: any } }
    | { type: 'TICK_TIMER' }
    | { type: 'TYPE_CHAR'; char: string; wordLength: number }
    | { type: 'DELETE_CHAR' }
    | { type: 'SUBMIT_GUESS'; newGuesses: any[]; newStatuses: any; isWon: boolean; isLost: boolean }
    | { type: 'SET_HINT'; hint: { letter: string, index: number, row?: number } }
    | { type: 'TIME_UP' }
    | { type: 'SHAKE_GUESS' }
    | { type: 'STOP_SHAKE' }
    | { type: 'SWITCH_LENGTH'; payload: any };

export const initialChallengeState: ChallengeGameState = {
    guesses: [],
    currentGuess: '',
    letterStatuses: {},
    isGameOver: false,
    isShake: false,
    usedHint: false,
    hintRecord: null,
    timeLeft: null,
    status: 'pending'
};

export function challengeGameReducer(state: ChallengeGameState, action: ChallengeGameAction): ChallengeGameState {
    switch (action.type) {
        case 'START_GAME':
            return {
                ...state,
                ...action.payload,
            };

        case 'TICK_TIMER':
            if (state.timeLeft === null || state.timeLeft <= 0 || state.isGameOver) return state;
            return {
                ...state,
                timeLeft: state.timeLeft - 1,
            };

        case 'TYPE_CHAR':
            if (state.isGameOver || state.currentGuess.length >= action.wordLength) return state;
            return {
                ...state,
                currentGuess: state.currentGuess + action.char,
            };

        case 'DELETE_CHAR':
            if (state.isGameOver) return state;
            return {
                ...state,
                currentGuess: state.currentGuess.slice(0, -1),
            };

        case 'SUBMIT_GUESS': {
            const isFinished = action.isWon || action.isLost;
            return {
                ...state,
                guesses: action.newGuesses,
                letterStatuses: action.newStatuses,
                currentGuess: '',
                isGameOver: isFinished,
                status: action.isWon || action.isLost ? 'completed' : 'playing'
            };
        }

        case 'SET_HINT':
            return {
                ...state,
                usedHint: true,
                hintRecord: action.hint,
            };

        case 'TIME_UP':
            return {
                ...state,
                isGameOver: true,
                status: 'timed_out',
                timeLeft: 0
            };

        case 'SHAKE_GUESS':
            return {
                ...state,
                isShake: true,
            };

        case 'STOP_SHAKE':
            return {
                ...state,
                isShake: false,
            };

        default:
            return state;
    }
}
