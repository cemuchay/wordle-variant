/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useReducer, useState, useMemo } from 'react';
import { getWordLists } from '../data/words';
import { calculateSkillIndex, checkGuess, getHint, getLetterStatuses } from '../lib/game-logic';
import { challengeGameReducer, initialChallengeState } from '../reducers/challengeReducer';

interface UseChallengeGameEngineProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any) => Promise<boolean>;
    onFinish: () => void;
    selectedLength?: number | null; // For Marathon mode
    onLengthComplete?: () => void; // Callback for Marathon mode
    setTimeLeftGlobal?: (t: number | null) => void; // From context
}

export const useChallengeGameEngine = ({
    challenge, participation, triggerToast, submitChallengeResult, onFinish, selectedLength, onLengthComplete, setTimeLeftGlobal
}: UseChallengeGameEngineProps) => {
    const isMarathon = challenge.word_length === 1;
    const marathonWords = useMemo(() => {
        if (!isMarathon) return null;
        try {
            return JSON.parse(challenge.target_word);
        } catch (e) {
            console.error("Failed to parse marathon words", e);
            return null;
        }
    }, [challenge.target_word, isMarathon]);

    const [state, dispatch] = useReducer(challengeGameReducer, {
        ...initialChallengeState,
        guesses: [],
        letterStatuses: {},
        usedHint: false,
        hintRecord: null,
        status: participation.status,
        isGameOver: false
    });

    const [isSaving, setIsSaving] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const { guesses, currentGuess, isGameOver, usedHint, hintRecord, timeLeft } = state;

    // Sync timeLeft with Global Context
    useEffect(() => {
        if (setTimeLeftGlobal) {
            setTimeLeftGlobal(timeLeft);
        }
        return () => {
            if (setTimeLeftGlobal) setTimeLeftGlobal(null);
        };
    }, [timeLeft, setTimeLeftGlobal]);

    // Word Length & Target Word Resolution
    const wordLength = isMarathon ? selectedLength! : challenge.word_length;
    const targetWord = isMarathon ? marathonWords[selectedLength!] : challenge.target_word;

    // Helper to extract guesses for current word with extreme defensiveness
    const getIncomingGuesses = useCallback(() => {
        if (!participation) return [];
        
        if (isMarathon) {
            if (!selectedLength) return [];
            const progress = participation.marathon_progress?.find((p: any) => p.word_length === selectedLength);
            return Array.isArray(progress?.guesses) ? progress.guesses : [];
        }
        
        let g = participation.guesses;
        // Handle potential stringified JSON from some DB responses
        if (typeof g === 'string') {
            try { g = JSON.parse(g); } catch (e) { return []; }
        }
        return Array.isArray(g) ? g : [];
    }, [participation, isMarathon, selectedLength]);

    // Initialization & State Sync
    useEffect(() => {
        if (isMarathon && !selectedLength) return;

        const incoming = getIncomingGuesses();
        const progress = isMarathon ? participation.marathon_progress?.find((p: any) => p.word_length === selectedLength) : null;
        
        console.log(`[Engine] Initializing length ${wordLength}. Found ${incoming.length} incoming guesses.`);
        
        const isFinishedStatus = isMarathon 
            ? (progress?.status === 'completed' || progress?.status === 'timed_out')
            : (participation.status === 'completed' || participation.status === 'timed_out');

        let initialTimeLeft = null;
        if (challenge.mode === 'LIVE' && challenge.max_time) {
            const startTime = isMarathon ? progress?.started_at : participation.started_at;
            if (startTime) {
                const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
                initialTimeLeft = Math.max(0, (challenge.max_time * 60) - elapsed);
            } else {
                initialTimeLeft = challenge.max_time * 60;
            }
        }

        dispatch({
            type: 'START_GAME', payload: {
                guesses: incoming,
                letterStatuses: getLetterStatuses(incoming),
                usedHint: isMarathon ? (progress?.hints_used || false) : (participation.hints_used || false),
                hintRecord: isMarathon ? (progress?.hint_record || null) : (participation.hint_record || null),
                isGameOver: isFinishedStatus || (initialTimeLeft !== null && initialTimeLeft <= 0) || incoming.some((g: any) => g.every((r: any) => r.status === 'correct')) || incoming.length >= 6,
                status: isMarathon ? (progress?.status || 'playing') : participation.status,
                timeLeft: initialTimeLeft
            }
        });
        
        // Handle Per-Game Timer Start for LIVE mode
        if (challenge.mode === 'LIVE' && challenge.max_time && !isSaving) {
            const startTime = isMarathon ? progress?.started_at : participation.started_at;
            if (!startTime) {
                // First time entry timer start
                submitChallengeResult({
                    status: 'playing',
                    started_at: new Date().toISOString()
                }, isMarathon ? selectedLength! : undefined);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLength, participation.id]); 

    // Sync guesses if they update in props while engine is mounted
    useEffect(() => {
        if (isSaving || (isMarathon && !selectedLength)) return;

        const incoming = getIncomingGuesses();
        
        // Robust Sync Strategy:
        // Only sync from props if:
        // 1. We have no local guesses yet (first fetch arrived after mount)
        // 2. The incoming data is MORE complete than our local state (sync from another device)
        const shouldSync = (guesses.length === 0 && incoming.length > 0) || incoming.length > guesses.length;

        if (shouldSync && JSON.stringify(incoming) !== JSON.stringify(guesses)) {
             console.log(`[Engine] Syncing background update. Incoming: ${incoming.length}, Local: ${guesses.length}`);
             dispatch({
                type: 'SWITCH_LENGTH', payload: {
                    guesses: incoming,
                    letterStatuses: getLetterStatuses(incoming),
                    isGameOver: incoming.some((g: any) => g.every((r: any) => r.status === 'correct')) || incoming.length >= 6,
                }
            });
        }
    }, [participation.guesses, getIncomingGuesses, guesses.length, isSaving, isMarathon, selectedLength]);

    // Timer Interval Management
    useEffect(() => {
        if (timeLeft !== null && timeLeft > 0 && !isGameOver) {
            const interval = window.setInterval(() => {
                dispatch({ type: 'TICK_TIMER' });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isGameOver, timeLeft]);

    const handleTimeExpired = useCallback(async () => {
        if (isSaving) return;
        dispatch({ type: 'TIME_UP' });
        triggerToast("Time's up!", 3000);
        setIsSaving(true);

        if (isMarathon) {
            // Just fail this specific word, but keep marathon playing
            const success = await submitChallengeResult({
                status: 'timed_out',
                attempts: guesses.length,
                guesses: guesses,
                score: 0,
                hints_used: usedHint,
                hint_record: hintRecord
            }, selectedLength!);
            setIsSaving(false);
            if (!success) triggerToast("Failed to save progress.", 3000);
            if (onLengthComplete) onLengthComplete();
        } else {
            const success = await submitChallengeResult({
                status: 'timed_out',
                score: 0,
                attempts: guesses.length,
                guesses: guesses,
                hints_used: usedHint,
                hint_record: hintRecord
            });
            setIsSaving(false);
            if (!success) triggerToast("Failed to save result.", 4000);
            onFinish();
        }
    }, [isMarathon, selectedLength, guesses, usedHint, hintRecord, submitChallengeResult, triggerToast, onFinish, onLengthComplete, isSaving]);

    useEffect(() => {
        if (timeLeft === 0 && !isGameOver) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            handleTimeExpired();
        }
    }, [timeLeft, isGameOver, handleTimeExpired]);

    const onChar = useCallback((char: string) => {
        if (isGameOver || isSaving) return;
        dispatch({ type: 'TYPE_CHAR', char, wordLength });
    }, [isGameOver, isSaving, wordLength]);

    const onDelete = useCallback(() => {
        if (isGameOver || isSaving) return;
        dispatch({ type: 'DELETE_CHAR' });
    }, [isGameOver, isSaving]);

    const onEnter = useCallback(async () => {
        if (isGameOver || isSaving || currentGuess.length !== wordLength) return;

        const upperGuess = currentGuess.toUpperCase();
        const { valid } = getWordLists(wordLength);

        if (!valid.has(upperGuess)) {
            triggerToast("Not in word list.");
            dispatch({ type: 'SHAKE_GUESS' });
            setTimeout(() => dispatch({ type: 'STOP_SHAKE' }), 500);
            return;
        }

        const result = checkGuess(upperGuess, targetWord);
        const newGuesses = [...guesses, result];
        const newStatuses = getLetterStatuses(newGuesses);
        const won = upperGuess === targetWord;
        const lost = newGuesses.length === 6;

        setIsSaving(true);
        setRetryCount(0);
        
        let resultPayload: any;
        if (isMarathon) {
            if (won || lost) {
                const skillScore = calculateSkillIndex(newGuesses.length, 6, usedHint, newGuesses);
                resultPayload = {
                    status: 'completed',
                    score: skillScore,
                    attempts: newGuesses.length,
                    guesses: newGuesses,
                    hints_used: usedHint,
                    hint_record: hintRecord
                };
            } else {
                resultPayload = {
                    status: 'playing',
                    guesses: newGuesses,
                    attempts: newGuesses.length
                };
            }
        } else {
            if (won || lost) {
                const skillScore = calculateSkillIndex(newGuesses.length, 6, usedHint, newGuesses);
                resultPayload = {
                    status: 'completed',
                    score: skillScore,
                    attempts: newGuesses.length,
                    guesses: newGuesses,
                    hints_used: usedHint,
                    hint_record: hintRecord
                };
            } else {
                resultPayload = {
                    status: 'playing',
                    score: 0,
                    attempts: newGuesses.length,
                    guesses: newGuesses,
                    hints_used: usedHint,
                    hint_record: hintRecord
                };
            }
        }

        // Retry logic: 3 attempts
        let success = false;
        let attempt = 0;
        const maxAttempts = 3;

        while (attempt < maxAttempts && !success) {
            if (attempt > 0) {
                setRetryCount(attempt);
                // Wait 1.5s before retry
                await new Promise(r => setTimeout(r, 1500));
            }
            
            success = await submitChallengeResult(resultPayload, isMarathon ? wordLength : undefined);
            attempt++;
        }

        setIsSaving(false);
        setRetryCount(0);

        if (!success) {
            triggerToast("Sync failed after multiple retries. Check connection.", 5000);
            return;
        }

        // ONLY NOW we update the UI, triggering the reveal animation
        dispatch({ type: 'SUBMIT_GUESS', newGuesses, newStatuses, isWon: won, isLost: lost });

        if (won || lost) {
            setTimeout(() => {
                triggerToast(won ? "Completed! 🎉" : `The word was ${targetWord}`, 5000);
                if (isMarathon) {
                    if (onLengthComplete) onLengthComplete();
                } else {
                    onFinish();
                }
            }, 2000);
        }
    }, [isGameOver, isSaving, currentGuess, wordLength, targetWord, guesses, usedHint, hintRecord, submitChallengeResult, triggerToast, onFinish, isMarathon, onLengthComplete]);

    const handleHint = async () => {
        if (isGameOver || isSaving) return;
        if (usedHint && hintRecord) {
            triggerToast(`Reminder: "${hintRecord.letter}" is at position ${hintRecord.index + 1}.`, 3000);
            return;
        }
        if (guesses.length < 3) {
            triggerToast("Hint unlocks after 3 attempts.", 3000);
            return;
        }

        const hint = getHint(targetWord, guesses);
        if (hint) {
            const hintWithRow = { ...hint, row: guesses.length };
            dispatch({ type: 'SET_HINT', hint: hintWithRow });
            triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`, 5000);

            setIsSaving(true);
            let resultPayload: any;
            if (isMarathon) {
                resultPayload = {
                    status: 'playing',
                    hints_used: true,
                    hint_record: hintWithRow
                };
            } else {
                resultPayload = {
                    status: 'playing',
                    score: 0,
                    attempts: guesses.length,
                    guesses: guesses,
                    hints_used: true,
                    hint_record: hintWithRow
                };
            }
            const success = await submitChallengeResult(resultPayload, isMarathon ? selectedLength! : undefined);
            setIsSaving(false);
            if (!success) triggerToast("Failed to save hint usage.", 3000);
        }
    };

    return {
        state,
        actions: { onChar, onDelete, onEnter, handleHint },
        isSaving,
        retryCount,
        wordLength,
        targetWord,
        timeLeft
    };
};
