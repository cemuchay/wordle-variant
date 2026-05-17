/* eslint-disable @typescript-eslint/no-unused-vars */
import { useReducer, useCallback, useMemo } from 'react';
import { gameReducer, initialState } from '../reducers/gameReducer';
import { checkGuess, getDailyConfig, getHint, getLetterStatuses, syncGameState, syncWithRetry, updateStats } from '../lib/game-logic';
import { getWordLists } from '../data/words';
import { getLossMessage, getWinMessage } from '../lib/messages';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { useWordleStats } from './useStats';

export const useGameEngine = (date: string) => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const { user } = useAuth();
    const { triggerToast, preferences } = useApp();
    const config = useMemo(() => getDailyConfig(date), [date]);
    const { refresh, updateOptimistically } = useWordleStats(user, false, date);

    const onChar = useCallback((char: string) => {
        dispatch({ type: 'ADD_LETTER', char, maxLength: config.length });
    }, [config.length]);

    const onDelete = useCallback(() => {
        dispatch({ type: 'DELETE_LETTER' });
    }, []);

    const onEnter = useCallback(async () => {
        if (state.isGameOver || state.currentGuess.length !== config.length) return;

        const upperGuess = state.currentGuess.toUpperCase();
        const { valid } = getWordLists(config.length);

        if (!valid.has(upperGuess)) {
            triggerToast("Not in word list.");
            dispatch({ type: 'SHAKE_GUESS' });
            setTimeout(() => dispatch({ type: 'STOP_SHAKE' }), 500);
            return;
        }

        const result = checkGuess(upperGuess, config.word);
        const won = upperGuess === config.word;
        const lost = (state.guesses.length + 1) === config.maxAttempts;
        const message = preferences.allowRoasts ? (won ? getWinMessage(state.guesses.length + 1) : lost ? getLossMessage() : "") : "";

        const newGuesses = [...state.guesses, result];
        const newStatus = won ? 'won' : (lost ? 'lost' : 'playing');
        const payload = {
            date,
            guesses: newGuesses,
            letterStatuses: getLetterStatuses(newGuesses),
            status: newStatus,
            usedHint: state.usedHint,
            hintRecord: state.hintRecord,
            config,
            gameMessage: message
        };

        // 1. Save locally FIRST to ensure data integrity
        localStorage.setItem(`wordle-${date}`, JSON.stringify(payload));

        // 2. Update UI (flips row)
        dispatch({
            type: 'SUBMIT_GUESS',
            result,
            isWon: won,
            isLost: lost,
            message
        });

        if (user) {
            dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
            try {
                await syncWithRetry(user.id, date, payload);
                dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
                setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', status: 'idle' }), 3000);
            } catch (error) {
                dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
                triggerToast("Connection lost. Progress saved locally.", 5000);
            }
        }

        if (won || lost) {
            const updatedStats = updateStats(won, newGuesses.length);
            updateOptimistically(updatedStats);
            await refresh();

            // Only show reveal after sync attempt (successful or failed-but-locally-saved)
            if (lost) triggerToast(`The word is: ${config.word}`, 5000);

            // Calculate delay: wordLength * 150ms + 600ms (last tile flip) + padding
            const revealDelay = (config.length - 1) * 150 + 600 + 500;

            setTimeout(() => {
                dispatch({ type: 'SET_GAME_OVER_MODAL', isOpen: true });
                triggerToast(message || state.gameMessage, 8500);
            }, revealDelay);
        }
    }, [state.isGameOver, state.currentGuess, state.guesses, state.usedHint, state.hintRecord, state.gameMessage, config, date, user, preferences.allowRoasts, triggerToast, updateOptimistically, refresh]);

    const handleHint = useCallback(async () => {
        if (state.guesses.length < 3 || state.isGameOver) return;
        if (state.usedHint && state.hintRecord) {
            triggerToast(`Reminder: "${state.hintRecord.letter}" is at position ${state.hintRecord.index + 1}.`, 3000);
            return;
        }
        const hint = getHint(config.word, state.guesses);
        if (hint) {
            const hintWithRow = { ...hint, row: state.guesses.length };

            const payload = {
                date,
                guesses: state.guesses,
                letterStatuses: getLetterStatuses(state.guesses),
                status: 'playing',
                usedHint: true,
                hintRecord: hintWithRow,
                config
            };

            // 1. Save locally FIRST
            localStorage.setItem(`wordle-${date}`, JSON.stringify(payload));

            // 2. Update UI
            dispatch({ type: 'SET_HINT', hint: hintWithRow });

            if (user) {
                dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
                try {
                    await syncGameState(user.id, date, payload);
                    dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
                    setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', status: 'idle' }), 3000);
                } catch (error) {
                    dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
                }
            }
            triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`);
        }
    }, [state.guesses, state.isGameOver, state.usedHint, state.hintRecord, config, date, user, triggerToast]);

    const setGameOverModalOpen = useCallback((isOpen: boolean) => {
        dispatch({ type: 'SET_GAME_OVER_MODAL', isOpen });
    }, []);

    const loadState = useCallback((payload: Partial<typeof initialState>) => {
        dispatch({ type: 'LOAD_STATE', payload });
    }, []);

    const letterStatuses = useMemo(() => getLetterStatuses(state.guesses), [state.guesses]);

    return {
        state: { ...state, letterStatuses },
        actions: {
            onChar,
            onDelete,
            onEnter,
            handleHint,
            setGameOverModalOpen,
            loadState
        },
        config
    };
};
