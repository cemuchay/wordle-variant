import type { GuessResult, LetterStatus } from '../types/game';

export interface GameState {
    guesses: GuessResult[][];
    currentGuess: string;
    letterStatuses: Record<string, LetterStatus>;
    status: 'playing' | 'won' | 'lost';
    usedHint: boolean;
    hintRecord: { letter: string; index: number; row?: number } | null;
    gameMessage: string;
    isGameOver: boolean;
    isGameOverModalOpen: boolean;
    isShake: boolean;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

export type GameAction =
    | { type: 'ADD_LETTER'; char: string; maxLength: number }
    | { type: 'DELETE_LETTER' }
    | { type: 'SUBMIT_GUESS'; result: GuessResult[]; isWon: boolean; isLost: boolean; message: string }
    | { type: 'SET_HINT'; hint: { letter: string; index: number; row?: number } }
    | { type: 'LOAD_STATE'; payload: Partial<GameState> }
    | { type: 'SET_GAME_OVER_MODAL'; isOpen: boolean }
    | { type: 'RESET_CURRENT_GUESS' }
    | { type: 'SET_SYNC_STATUS'; status: 'idle' | 'syncing' | 'synced' | 'error' }
    | { type: 'SHAKE_GUESS' }
    | { type: 'STOP_SHAKE' };

export const initialState: GameState = {
    guesses: [],
    currentGuess: '',
    letterStatuses: {},
    status: 'playing',
    usedHint: false,
    hintRecord: null,
    gameMessage: '',
    isGameOver: false,
    isGameOverModalOpen: false,
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
            return {
                ...state,
                currentGuess: state.currentGuess + action.char,
            };

        case 'DELETE_LETTER':
            if (state.isGameOver) return state;
            return {
                ...state,
                currentGuess: state.currentGuess.slice(0, -1),
            };

        case 'SUBMIT_GUESS': {
            const newGuesses = [...state.guesses, action.result];
            const newStatus = action.isWon ? 'won' : (action.isLost ? 'lost' : 'playing');
            const isFinished = newStatus !== 'playing';

            return {
                ...state,
                guesses: newGuesses,
                currentGuess: '',
                status: newStatus,
                isGameOver: isFinished,
                isGameOverModalOpen: false, // Delay modal until animation finishes
                gameMessage: action.message,
            };
        }

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
