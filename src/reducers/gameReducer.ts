import type { GuessResult, LetterStatus } from '../types/game';

export interface GameState {
    guesses: GuessResult[][];
    currentGuess: string;
    cursorIndex: number;
    editIndex: number | null;
    letterStatuses: Record<string, LetterStatus>;
    status: 'playing' | 'won' | 'lost';
    usedHint: boolean;
    hintRecord: { letter: string; index: number; row?: number } | null;
    gameMessage: string;
    isGameOver: boolean;
    isGameOverModalOpen: boolean;
    isRevealing: boolean;
    isShake: boolean;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

export type GameAction =
    | { type: 'ADD_LETTER'; char: string; maxLength: number }
    | { type: 'DELETE_LETTER' }
    | { type: 'SUBMIT_GUESS'; result: GuessResult[]; isWon: boolean; isLost: boolean; message: string }
    | { type: 'STOP_REVEALING' }
    | { type: 'SET_HINT'; hint: { letter: string; index: number; row?: number } }
    | { type: 'SET_CURSOR'; index: number }
    | { type: 'SET_EDIT_INDEX'; index: number | null }
    | { type: 'LOAD_STATE'; payload: Partial<GameState> }
    | { type: 'SET_GAME_OVER_MODAL'; isOpen: boolean }
    | { type: 'RESET_CURRENT_GUESS' }
    | { type: 'SET_SYNC_STATUS'; status: 'idle' | 'syncing' | 'synced' | 'error'; error?: unknown }
    | { type: 'SHAKE_GUESS' }
    | { type: 'STOP_SHAKE' };

export const initialState: GameState = {
    guesses: [],
    currentGuess: '',
    cursorIndex: 0,
    editIndex: null,
    letterStatuses: {},
    status: 'playing',
    usedHint: false,
    hintRecord: null,
    gameMessage: '',
    isGameOver: false,
    isGameOverModalOpen: false,
    isRevealing: false,
    isShake: false,
    syncStatus: 'idle',
};

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'SET_SYNC_STATUS':
            return {
                ...state,
                syncStatus: action.status,
            };
        case 'ADD_LETTER':
            if (state.isGameOver || state.currentGuess.length >= action.maxLength) return state;
            if (state.editIndex !== null) {
                const ei = state.editIndex;
                const filled = state.currentGuess.substring(0, ei) + action.char + state.currentGuess.substring(ei + 1);
                return {
                    ...state,
                    currentGuess: filled,
                    editIndex: null,
                };
            }
            const cursorAtEnd = state.cursorIndex >= state.currentGuess.length;
            const newGuess = cursorAtEnd
                ? state.currentGuess + action.char
                : state.currentGuess.substring(0, state.cursorIndex) + action.char + state.currentGuess.substring(state.cursorIndex + 1);
            return {
                ...state,
                currentGuess: newGuess,
                cursorIndex: Math.min(state.cursorIndex + 1, newGuess.length),
            };

        case 'DELETE_LETTER':
            if (state.isGameOver) return state;
            if (state.currentGuess.length === 0) return state;
            if (state.editIndex !== null) {
                const ei = state.editIndex;
                const cleared = state.currentGuess.substring(0, ei) + '\0' + state.currentGuess.substring(ei + 1);
                return {
                    ...state,
                    currentGuess: cleared,
                    editIndex: null,
                };
            }
            const afterDelete = state.currentGuess.substring(0, state.cursorIndex) + state.currentGuess.substring(state.cursorIndex + 1);
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
            const newGuesses = [...state.guesses, action.result];
            const newStatus = action.isWon ? 'won' : (action.isLost ? 'lost' : 'playing');
            const isFinished = newStatus !== 'playing';

            return {
                ...state,
                guesses: newGuesses,
                currentGuess: '',
                cursorIndex: 0,
                editIndex: null,
                status: newStatus,
                isGameOver: isFinished,
                isRevealing: true,
                isGameOverModalOpen: false, // Delay modal until animation finishes
                gameMessage: action.message,
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

        case 'LOAD_STATE':
            return {
                ...state,
                ...action.payload,
                isGameOver: action.payload.status === 'won' || action.payload.status === 'lost',
            };

        case 'SET_GAME_OVER_MODAL':
            return {
                ...state,
                isGameOverModalOpen: action.isOpen,
            };

        case 'RESET_CURRENT_GUESS':
            return {
                ...state,
                currentGuess: '',
                cursorIndex: 0,
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
