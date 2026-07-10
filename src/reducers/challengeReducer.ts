/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ChallengeGameState {
    guesses: any[];
    currentGuess: string;
    cursorIndex: number;
    editIndex: number | null;
    letterStatuses: Record<string, any>;
    isGameOver: boolean;
    isRevealing: boolean;
    isShake: boolean;
    usedHint: boolean;
    hintRecord: { letter: string; index: number; row?: number } | null;
    timeLeft: number | null;
    status: 'pending' | 'playing' | 'completed' | 'timed_out';
    isSaving: boolean;
    retryCount: number;
}

export type ChallengeGameAction =
    | { type: 'START_GAME'; payload: { guesses: any[], letterStatuses: any, usedHint: boolean, hintRecord: any, timeLeft: number | null, isGameOver: boolean, status: any, currentGuess?: string, cursorIndex?: number } }
    | { type: 'TICK_TIMER' }
    | { type: 'TYPE_CHAR'; char: string; wordLength: number }
    | { type: 'DELETE_CHAR' }
    | { type: 'SUBMIT_GUESS'; newGuesses: any[]; newStatuses: any; isWon: boolean; isLost: boolean }
    | { type: 'STOP_REVEALING' }
    | { type: 'SET_HINT'; hint: { letter: string, index: number, row?: number } }
    | { type: 'SET_CURSOR'; index: number }
    | { type: 'SET_EDIT_INDEX'; index: number | null }
    | { type: 'TIME_UP' }
    | { type: 'SHAKE_GUESS' }
    | { type: 'STOP_SHAKE' }
    | { type: 'SWITCH_LENGTH'; payload: any }
    | { type: 'SET_SAVING'; isSaving: boolean }
    | { type: 'SET_RETRY'; count: number };

export const initialChallengeState: ChallengeGameState = {
    guesses: [],
    currentGuess: '',
    cursorIndex: 0,
    editIndex: null,
    letterStatuses: {},
    isGameOver: false,
    isRevealing: false,
    isShake: false,
    usedHint: false,
    hintRecord: null,
    timeLeft: null,
    status: 'pending',
    isSaving: false,
    retryCount: 0
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
            if (state.isGameOver) return state;
            if (state.editIndex !== null) {
                const ei = state.editIndex;
                const filled = state.currentGuess.substring(0, ei) + action.char + state.currentGuess.substring(ei + 1);
                return {
                    ...state,
                    currentGuess: filled,
                    editIndex: null,
                };
            }
            if (state.currentGuess.length >= action.wordLength) return state;
            const cursorAtEnd = state.cursorIndex >= state.currentGuess.length;
            const newGuess = cursorAtEnd
                ? state.currentGuess + action.char
                : state.currentGuess.substring(0, state.cursorIndex) + action.char + state.currentGuess.substring(state.cursorIndex + 1);
            return {
                ...state,
                currentGuess: newGuess,
                cursorIndex: Math.min(state.cursorIndex + 1, newGuess.length),
            };

        case 'DELETE_CHAR':
            if (state.isGameOver) return state;
            if (state.currentGuess.length === 0) return state;
            if (state.editIndex !== null) {
                const ei = state.editIndex;
                const cleared = state.currentGuess.substring(0, ei) + '\0' + state.currentGuess.substring(ei + 1);
                return {
                    ...state,
                    currentGuess: cleared,
                    editIndex: ei,
                };
            }
            const atEnd = state.cursorIndex >= state.currentGuess.length;
            const afterDelete = atEnd
                ? state.currentGuess.slice(0, -1)
                : state.currentGuess.substring(0, state.cursorIndex) + state.currentGuess.substring(state.cursorIndex + 1);
            return {
                ...state,
                currentGuess: afterDelete,
                cursorIndex: Math.min(state.cursorIndex, afterDelete.length),
            };

        case 'SET_CURSOR':
            return {
                ...state,
                cursorIndex: Math.max(0, Math.min(action.index, state.currentGuess.length)),
                editIndex: null,
            };

        case 'SET_EDIT_INDEX':
            return {
                ...state,
                editIndex: action.index,
            };

        case 'SUBMIT_GUESS': {
            const isFinished = action.isWon || action.isLost;
            return {
                ...state,
                guesses: action.newGuesses,
                letterStatuses: action.newStatuses,
                currentGuess: '',
                cursorIndex: 0,
                editIndex: null,
                isGameOver: isFinished,
                isRevealing: true,
                status: action.isWon || action.isLost ? 'completed' : 'playing'
            };
        }

        case 'STOP_REVEALING':
            return {
                ...state,
                isRevealing: false,
            };

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

        case 'SET_SAVING':
            return {
                ...state,
                isSaving: action.isSaving
            };

        case 'SET_RETRY':
            return {
                ...state,
                retryCount: action.count
            };

        case 'SWITCH_LENGTH':
            return {
                ...state,
                guesses: action.payload.guesses,
                letterStatuses: action.payload.letterStatuses,
                isGameOver: action.payload.isGameOver,
                currentGuess: '',
                cursorIndex: 0,
                editIndex: null,
                isRevealing: false,
                isShake: false,
            };

        default:
            return state;
    }
}
