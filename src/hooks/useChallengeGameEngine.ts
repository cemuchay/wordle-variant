/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useReducer, useState, useMemo, useRef } from 'react';
import { getWordLists } from '../data/words';
import { calculateSkillIndex, checkGuess, deobfuscateWord, getHint, getLetterStatuses, isHintDisabled } from '../lib/game-logic';
import { challengeGameReducer, initialChallengeState } from '../reducers/challengeReducer';
import { useChallengeStore } from '../store/useChallengeStore';

interface UseChallengeGameEngineProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any, wordLength?: number) => Promise<boolean>;
    onFinish: () => void;
    selectedLength?: number | null; // For Marathon mode
    onLengthComplete?: () => void; // Callback for Marathon mode
}

export const useChallengeGameEngine = ({
    challenge, participation, triggerToast, submitChallengeResult, onFinish, selectedLength, onLengthComplete
}: UseChallengeGameEngineProps) => {
    const setTimeLeftStore = useChallengeStore(state => state.setTimeLeft);
    const isMarathon = challenge.word_length === 1;
    const marathonWords = useMemo(() => {
        if (!isMarathon) return null;
        try {
            const words = JSON.parse(challenge.target_word);
            const decrypted: Record<number, string> = {};
            Object.entries(words).forEach(([len, word]) => {
                decrypted[Number(len)] = deobfuscateWord(word as string, challenge.salt);
            });
            return decrypted;
        } catch (e) {
            console.error("Failed to parse marathon words", e);
            return null;
        }
    }, [challenge.target_word, isMarathon, challenge.salt]);

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
    const [networkLogs, setNetworkLogs] = useState<Array<{ id: string, msg: string, duration?: number }>>([]);
    const startTimerRef = useRef(false);
    const initializedRef = useRef<string>("");
    const { guesses, currentGuess, isGameOver, usedHint, hintRecord, timeLeft } = state;

    const addLog = useCallback((msg: string, duration?: number) => {
        setNetworkLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), msg, duration }]);
    }, []);

    const wrappedSubmitResult = useCallback(async (payload: any, wordLen?: number) => {
        const start = Date.now();
        addLog(`Sync Start: ${payload.status}`);
        const success = await submitChallengeResult(payload, wordLen);
        const duration = Date.now() - start;
        addLog(`Sync End: ${success ? 'Success' : 'Failed'}`, duration);
        return success;
    }, [submitChallengeResult, addLog]);

    const currentKey = isMarathon ? `m-${selectedLength}` : `r-${challenge.id}`;



    const handleTimeExpired = useCallback(async () => {
        if (isSaving) return;
        dispatch({ type: 'TIME_UP' });
        triggerToast("Time's up!", 3000);
        setIsSaving(true);

        let timeTaken: number | null = null;
        if (challenge.mode === 'LIVE' && challenge.max_time) {
            timeTaken = challenge.max_time * 60; // Max time used if expired
        }

        if (isMarathon) {
            // Just fail this specific word, but keep marathon playing
            const success = await wrappedSubmitResult({
                status: 'timed_out',
                attempts: guesses.length,
                guesses: guesses,
                score: 0,
                hints_used: usedHint,
                hint_record: hintRecord,
                time_taken: timeTaken
            }, selectedLength!);
            setIsSaving(false);
            if (!success) triggerToast("Failed to save progress.", 3000);
            if (onLengthComplete) onLengthComplete();
        } else {
            const success = await wrappedSubmitResult({
                status: 'timed_out',
                score: 0,
                attempts: guesses.length,
                guesses: guesses,
                hints_used: usedHint,
                hint_record: hintRecord,
                time_taken: timeTaken
            });
            setIsSaving(false);
            if (!success) triggerToast("Failed to save result.", 4000);
            onFinish();
        }
    }, [isSaving, challenge.mode, challenge.max_time, isMarathon, wrappedSubmitResult, guesses, usedHint, hintRecord, selectedLength, onLengthComplete, onFinish, triggerToast]);

    // Sync timeLeft with Global Store
    useEffect(() => {
        setTimeLeftStore(timeLeft);
        return () => setTimeLeftStore(null);
    }, [timeLeft, setTimeLeftStore]);

    // Word Length & Target Word Resolution
    const wordLength = isMarathon ? selectedLength! : challenge.word_length;
    const targetWord = useMemo(() => {
        const word = isMarathon ? (marathonWords?.[selectedLength!] || "") : deobfuscateWord(challenge.target_word, challenge.salt);
        if (word) addLog("Word Resolved");
        return word;
    }, [isMarathon, marathonWords, selectedLength, challenge.target_word, challenge.salt, addLog]);

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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            try { g = JSON.parse(g); } catch (e) { return []; }
        }
        return Array.isArray(g) ? g : [];
    }, [participation, isMarathon, selectedLength]);

    // Initialization & State Sync
    useEffect(() => {
        if (isMarathon && !selectedLength) return;
        if (initializedRef.current === currentKey) return;

        const incoming = getIncomingGuesses();
        const progress = isMarathon ? participation.marathon_progress?.find((p: any) => p.word_length === selectedLength) : null;

        console.log(`[Engine] Initializing length ${wordLength}. Key: ${currentKey}`);
        addLog(`Game Initialized: ${wordLength}L`);

        const serverStatus = isMarathon ? (progress?.status || 'playing') : participation.status;
        const isFinishedStatus = serverStatus === 'completed' || serverStatus === 'timed_out';

        let initialTimeLeft = null;
        let hasTimedOutOffline = false;

        if (challenge.mode === 'LIVE' && challenge.max_time) {
            // Marathon: use per-word startTime ONLY. Regular: use participation startTime.
            const startTime = isMarathon ? progress?.started_at : participation.started_at;

            if (isMarathon && !progress?.started_at) {
                // Word hasn't started yet, give full time
                initialTimeLeft = challenge.max_time * 60;
            } else if (startTime) {
                const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
                initialTimeLeft = Math.max(0, (challenge.max_time * 60) - elapsed);
                if (initialTimeLeft <= 0 && !isFinishedStatus) {
                    hasTimedOutOffline = true;
                }
            } else {
                initialTimeLeft = challenge.max_time * 60;
            }
        }

        initializedRef.current = currentKey;
        dispatch({
            type: 'START_GAME', payload: {
                guesses: incoming,
                letterStatuses: getLetterStatuses(incoming),
                usedHint: isMarathon ? (progress?.hints_used || false) : (participation.hints_used || false),
                hintRecord: isMarathon ? (progress?.hint_record || null) : (participation.hint_record || null),
                isGameOver: isFinishedStatus || (initialTimeLeft !== null && initialTimeLeft <= 0) || incoming.some((g: any) => g.every((r: any) => r.status === 'correct')) || incoming.length >= 6,
                status: serverStatus,
                timeLeft: initialTimeLeft
            }
        });

        // Side Effects (Timer Start / Timeout Sync)
        const runSideEffects = async () => {
            // Handle Offline Timeout Sync
            if (hasTimedOutOffline && !isSaving && !startTimerRef.current) {
                console.log("[Engine] Offline timeout detected, syncing...");
                startTimerRef.current = true;
                await handleTimeExpired();
            }

            // Handle Per-Game Timer Start for LIVE mode
            if (challenge.mode === 'LIVE' && challenge.max_time && !isSaving && !hasTimedOutOffline && !startTimerRef.current) {
                const startTime = isMarathon ? progress?.started_at : participation.started_at;
                if (!startTime) {
                    console.log("[Engine] Starting LIVE timer...");
                    startTimerRef.current = true;
                    await wrappedSubmitResult({
                        status: 'playing',
                        started_at: new Date().toISOString()
                    }, isMarathon ? selectedLength! : undefined);
                }
            }
        };

        runSideEffects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentKey, isMarathon, selectedLength, challenge, isSaving]);

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
            addLog(`Background Sync: +${incoming.length - guesses.length}`);
            dispatch({
                type: 'SWITCH_LENGTH', payload: {
                    guesses: incoming,
                    letterStatuses: getLetterStatuses(incoming),
                    isGameOver: incoming.some((g: any) => g.every((r: any) => r.status === 'correct')) || incoming.length >= 6,
                }
            });
        }
    }, [participation.guesses, getIncomingGuesses, guesses.length, isSaving, isMarathon, selectedLength, guesses, addLog]);

    // Timer Interval Management
    useEffect(() => {
        if (timeLeft !== null && timeLeft > 0 && !isGameOver) {
            const interval = window.setInterval(() => {
                dispatch({ type: 'TICK_TIMER' });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isGameOver, timeLeft]);



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
        const lost = newGuesses.length === 6; // Restore 6th attempt

        setIsSaving(true);
        setRetryCount(0);

        let timeTaken: number | null = null;
        if (challenge.mode === 'LIVE' && challenge.max_time && timeLeft !== null) {
            timeTaken = (challenge.max_time * 60) - timeLeft;
        }

        let resultPayload: any;
        if (isMarathon) {
            if (won || lost) {
                const skillScore = calculateSkillIndex({
                    attempts: newGuesses.length,
                    maxAttempts: 6,
                    usedHint: usedHint,
                    guesses: newGuesses,
                    gameDate: new Date().toISOString().split('T')[0],
                    hintRecord: hintRecord
                }).finalScore;
                resultPayload = {
                    status: 'completed',
                    score: skillScore,
                    attempts: newGuesses.length,
                    guesses: newGuesses,
                    hints_used: usedHint,
                    hint_record: hintRecord,
                    time_taken: timeTaken
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
                const skillScore = calculateSkillIndex({
                    attempts: newGuesses.length,
                    maxAttempts: 6,
                    usedHint: usedHint,
                    guesses: newGuesses,
                    gameDate: new Date().toISOString().split('T')[0],
                    hintRecord: hintRecord
                }).finalScore;
                resultPayload = {
                    status: 'completed',
                    score: skillScore,
                    attempts: newGuesses.length,
                    guesses: newGuesses,
                    hints_used: usedHint,
                    hint_record: hintRecord,
                    time_taken: timeTaken
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

            success = await wrappedSubmitResult(resultPayload, isMarathon ? wordLength : undefined);
            attempt++;
        }

        setIsSaving(false);
        setRetryCount(0);

        if (!success) {
            triggerToast("Sync failed after multiple retries. Check connection.", 5000);
            return;
        }

        // Stabilization Delay: Wait 300ms after sync succeeds before triggering reveal
        // This prevents the browser from being overwhelmed by simultaneous re-renders and animations
        await new Promise(r => setTimeout(r, 300));

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
    }, [isGameOver, isSaving, currentGuess, wordLength, targetWord, guesses, challenge.mode, challenge.max_time, timeLeft, isMarathon, triggerToast, usedHint, hintRecord, wrappedSubmitResult, onLengthComplete, onFinish]);

    const handleHint = useCallback(async () => {
        if (isGameOver || isSaving) return;
        if (usedHint && hintRecord) {
            triggerToast(`Reminder: "${hintRecord.letter}" is at position ${hintRecord.index + 1}.`, 3000);
            return;
        }
        if (guesses.length >= 5 && !usedHint) {
            triggerToast("Hint locked on last available guess.");
            return;
        }
        if (isHintDisabled(targetWord, guesses) && !usedHint) {
            triggerToast("Hint disabled: Only one letter remains!");
            return;
        }
        if (guesses.length < 2) {
            triggerToast("Hint unlocks after 2 attempts.", 3000);
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
            const success = await wrappedSubmitResult(resultPayload, isMarathon ? selectedLength! : undefined);
            setIsSaving(false);
            if (!success) triggerToast("Failed to save hint usage.", 3000);
        }
    }, [isGameOver, isSaving, usedHint, hintRecord, triggerToast, guesses, targetWord, isMarathon, selectedLength, wrappedSubmitResult]);


    const actions = useMemo(() => ({
        onChar,
        onDelete,
        onEnter,
        handleHint
    }), [onChar, onDelete, onEnter, handleHint]);

    const isHintBar1Restricted = useMemo(() => isHintDisabled(targetWord, guesses), [targetWord, guesses]);

    return {
        state: { ...state, isHintDisabled: isHintBar1Restricted },
        actions,
        isSaving,
        retryCount,
        wordLength,
        targetWord,
        timeLeft,
        networkLogs
    };
};
