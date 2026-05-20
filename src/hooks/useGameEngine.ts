import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getWordLists } from '../data/words';
import { useAuth } from '../hooks/useAuth';
import { checkGuess, getDailyConfig, getHint, getLetterStatuses, isHintDisabled, syncWithRetry, updateStats } from '../lib/game-logic';
import { supabase } from '../lib/supabaseClient';
import { getLossMessage, getWinMessage } from '../lib/messages';
import { gameReducer, initialState } from '../reducers/gameReducer';
import { useWordleStats } from './useStats';
import { useConfirmation } from '../context/ConfirmationContext';

import { logger } from '../lib/logger';
import { TOAST_DURATION } from '../constants/ui';

export const useGameEngine = (date: string) => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const [isHydrated, setIsHydrated] = useState(false);
    const { user, loading: isAuthLoading } = useAuth();
    const { triggerToast, preferences } = useApp();
    const { ask } = useConfirmation();
    const config = useMemo(() => getDailyConfig(!!user, date), [date, user]);
    const { refresh, updateOptimistically } = useWordleStats(user, false, date);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const performSync = useCallback(async (gamePayload: any) => {
        if (!user || !date) return;
        dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
        try {
            await syncWithRetry(user.id, date, gamePayload);
            dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });

            // Clear needsSync flag in localStorage
            const saved = localStorage.getItem(`wordle-${date}`);
            if (saved) {
                const current = JSON.parse(saved);
                if (current.needsSync) {
                    delete current.needsSync;
                    localStorage.setItem(`wordle-${date}`, JSON.stringify(current));
                }
            }

            setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', status: 'idle' }), TOAST_DURATION.DEFAULT);
            return true;
        } catch (error: unknown) {
            const err = error as Error;
            dispatch({ type: 'SET_SYNC_STATUS', status: 'error', error: err });
            logger.error('Cloud Sync Failure', {
                date,
                userId: user.id,
                error: err?.message || err,
                payload: gamePayload
            });
            // Ensure needsSync flag is set in localStorage
            const saved = localStorage.getItem(`wordle-${date}`);
            if (saved) {
                const current = JSON.parse(saved);
                current.needsSync = true;
                localStorage.setItem(`wordle-${date}`, JSON.stringify(current));
            }
            return false;
        }
    }, [user, date]);

    // Hydration & Authentication Swap Logic
    useEffect(() => {
        if (!date || isAuthLoading) return;

        const saved = localStorage.getItem(`wordle-${date}`);

        const loadFromCloud = async () => {
            if (!user) return null;
            try {
                const { data, error } = await supabase
                    .from('scores')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('game_date', date)
                    .single();

                if (!error && data) {
                    return {
                        guesses: data.guesses,
                        letterStatuses: getLetterStatuses(data.guesses),
                        status: data.status,
                        usedHint: data.hints_used,
                        hintRecord: data.hint_record,
                        config: { ...config, word: config.word }, // Use current config
                        gameMessage: data.game_message
                    };
                }
            } catch (e) {
                console.error("Cloud fetch failed:", e);
            }
            return null;
        };

        const hydrate = async () => {
            if (saved) {
                try {
                    const payload = JSON.parse(saved);

                    // AUTH SWAP PROTECTION & BACKWARD COMPATIBILITY: 
                    // Only perform mismatch check once auth state is stable.
                    if (payload.config && payload.config.word !== config.word) {
                        console.log("[Engine] Target word mismatch (Auth status changed), wiping today's progress.");
                        localStorage.removeItem(`wordle-${date}`);

                        // If moving from Guest -> Auth (they are logged in now, but previous game was explicitly a guest game)
                        if (user && payload.isGuest) {
                            localStorage.removeItem("wordle-statistics");
                            triggerToast("Logged in: Starting today's official word fresh.");
                        }

                        dispatch({ type: 'LOAD_STATE', payload: initialState });
                    } else {
                        dispatch({ type: 'LOAD_STATE', payload });

                        // Auto-sync if data was left unsynced
                        if (payload.needsSync && user) {
                            console.log("[Engine] Unsynced local data found, attempting background sync...");
                            performSync(payload);
                        }
                    }
                } catch (e) {
                    console.error("Failed to hydrate game state:", e);
                }
            } else if (user) {
                // No local state but authenticated: try to fetch from cloud
                const cloudPayload = await loadFromCloud();
                if (cloudPayload) {
                    dispatch({ type: 'LOAD_STATE', payload: cloudPayload });
                    localStorage.setItem(`wordle-${date}`, JSON.stringify(cloudPayload));
                } else {
                    dispatch({ type: 'LOAD_STATE', payload: initialState });
                }
            } else {
                dispatch({ type: 'LOAD_STATE', payload: initialState });
            }

            setIsHydrated(true);
        };

        hydrate();
    }, [date, user, isAuthLoading, config, triggerToast, performSync]);

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

        const alreadyGuessed = state.guesses.some((guess: any) => {
            const word = guess.map((charObj: any) => charObj.letter).join('').toUpperCase();
            return word === upperGuess;
        });

        if (alreadyGuessed) {
            const confirmSubmit = await ask({
                title: "Duplicate Guess",
                message: `You already guessed "${upperGuess}". Are you sure you want to submit it again?`,
                confirmLabel: "Yes, submit",
                cancelLabel: "No, cancel",
                type: "info"
            });
            if (!confirmSubmit) return;
        }

        const result = checkGuess(upperGuess, config.word);
        const won = upperGuess === config.word;
        const lost = (state.guesses.length + 1) === config.maxAttempts;
        const message = preferences.allowRoasts ? (won ? getWinMessage(state.guesses.length + 1) : lost ? getLossMessage() : "") : "";

        const newGuesses = [...state.guesses, result];
        const newStatus = won ? 'won' : (lost ? 'lost' : 'playing');
        const payload = {
            date,
            isGuest: !user,
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

        if (user) {
            const success = await performSync(payload);
            if (!success) {
                triggerToast("Cloud sync failed after 3 attempts. Progress saved locally.", TOAST_DURATION.LONG + 1000);
            }
        }

        // Stabilization Delay: Wait 300ms after sync attempt before triggering reveal
        await new Promise(r => setTimeout(r, 300));

        // 2. Update UI (flips row)
        dispatch({
            type: 'SUBMIT_GUESS',
            result,
            isWon: won,
            isLost: lost,
            message
        });

        if (won || lost) {
            const updatedStats = updateStats(won, newGuesses.length);
            updateOptimistically(updatedStats);
            await refresh();

            // Only show reveal after sync attempt (successful or failed-but-locally-saved)
            if (lost) triggerToast(`The word is: ${config.word}`, TOAST_DURATION.LONG + 1000);

            // Calculate delay: wordLength * 150ms + 600ms (last tile flip) + padding
            const revealDelay = (config.length - 1) * 150 + 600 + 500;

            setTimeout(() => {
                dispatch({ type: 'SET_GAME_OVER_MODAL', isOpen: true });
                triggerToast(message || state.gameMessage, TOAST_DURATION.LONG + 1000);
            }, revealDelay);
        }
    }, [state.isGameOver, state.currentGuess, state.guesses, state.usedHint, state.hintRecord, state.gameMessage, config, date, user, preferences.allowRoasts, triggerToast, updateOptimistically, refresh, performSync, ask]);

    const handleHint = useCallback(async () => {
        if (state.guesses.length < 2 || state.isGameOver) return;
        if (state.guesses.length >= (config.maxAttempts - 1) && !state.usedHint) {
            triggerToast("Hint locked on last available guess.");
            return;
        }
        if (isHintDisabled(config.word, state.guesses) && !state.usedHint) {
            triggerToast("Hint disabled: Only one letter remains!");
            return;
        }

        const hint = getHint(config.word, state.guesses);
        if (hint) {
            const hintWithRow = { ...hint, row: state.guesses.length };

            const payload = {
                date,
                isGuest: !user,
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
                const success = await performSync(payload);
                if (!success) {
                    triggerToast("Sync failed after 3 attempts. Hint saved locally.");
                }
            }
            triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`);
        }
    }, [state.guesses, state.isGameOver, state.usedHint, config, date, user, triggerToast, performSync]);

    const retrySync = useCallback(async () => {
        const saved = localStorage.getItem(`wordle-${date}`);
        if (!saved || !user) return;

        try {
            const payload = JSON.parse(saved);
            const success = await performSync(payload);
            if (success) {
                triggerToast("Sync successful!");
            } else {
                triggerToast("Sync failed again. Please check your connection.");
            }
        } catch (e) {
            console.error("Failed to parse local state for retry:", e);
        }
    }, [date, user, performSync, triggerToast]);

    const setGameOverModalOpen = useCallback((isOpen: boolean) => {
        dispatch({ type: 'SET_GAME_OVER_MODAL', isOpen });
    }, []);

    const loadState = useCallback((payload: Partial<typeof initialState>) => {
        dispatch({ type: 'LOAD_STATE', payload });
    }, []);

    const letterStatuses = useMemo(() => getLetterStatuses(state.guesses), [state.guesses]);
    const isHintBar1Restricted = useMemo(() => isHintDisabled(config.word, state.guesses), [config.word, state.guesses]);

    return {
        state: { ...state, letterStatuses, isHintDisabled: isHintBar1Restricted },
        actions: {
            onChar,
            onDelete,
            onEnter,
            handleHint,
            retrySync,
            setGameOverModalOpen,
            loadState
        },
        config,
        isHydrated
    };
};
