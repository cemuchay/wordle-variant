/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useReducer, useState, useMemo } from 'react';
import { getWordLists } from '../data/words';
import { calculateSkillIndex, checkGuess, getHint, getLetterStatuses } from '../lib/game-logic';
import { challengeGameReducer, initialChallengeState } from '../reducers/challengeReducer';

interface UseChallengeGameEngineProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (id: string, result: any) => Promise<boolean>;
    onFinish: () => void;
    selectedLength?: number | null; // For Marathon mode
    onLengthComplete?: () => void; // Callback for Marathon mode
}

export const useChallengeGameEngine = ({
    challenge, participation, triggerToast, submitChallengeResult, onFinish, selectedLength, onLengthComplete
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
    const { guesses, currentGuess, isGameOver, usedHint, hintRecord, timeLeft } = state;

    // Word Length & Target Word Resolution
    const wordLength = isMarathon ? selectedLength! : challenge.word_length;
    const targetWord = isMarathon ? marathonWords[selectedLength!] : challenge.target_word;

    // Initialization & State Sync
    useEffect(() => {
        if (isMarathon) {
            if (selectedLength) {
                const lengthGuesses = participation.guesses?.[selectedLength] || [];
                const lengthHintsUsed = participation.hint_record?.[selectedLength]?.used || false;
                const lengthHintRecord = participation.hint_record?.[selectedLength]?.record || null;
                const lengthFinished = lengthGuesses.some((g: any) =>
                    g.every((r: any) => r.status === 'correct')) || lengthGuesses.length >= 6;

                let subGameTimeLeft: number | null = null;
                if (challenge.mode === 'LIVE' && challenge.max_time) {
                    const subGameStart = participation.hint_record?.[selectedLength]?.started_at;
                    if (subGameStart) {
                        const elapsed = Math.floor((Date.now() - new Date(subGameStart).getTime()) / 1000);
                        subGameTimeLeft = Math.max(0, (challenge.max_time * 60) - elapsed);
                    } else {
                        subGameTimeLeft = challenge.max_time * 60;
                        const updatedHintRecord = { ...(participation.hint_record || {}) };
                        updatedHintRecord[selectedLength] = { ...(updatedHintRecord[selectedLength] || {}), started_at: new Date().toISOString() };
                        submitChallengeResult(participation.id, {
                            status: 'playing',
                            hint_record: updatedHintRecord
                        });
                    }
                }

                dispatch({
                    type: 'SWITCH_LENGTH', payload: {
                        guesses: lengthGuesses,
                        letterStatuses: getLetterStatuses(lengthGuesses),
                        usedHint: lengthHintsUsed,
                        hintRecord: lengthHintRecord,
                        isGameOver: !!lengthFinished || (subGameTimeLeft !== null && subGameTimeLeft <= 0),
                        status: participation.status,
                        timeLeft: subGameTimeLeft
                    }
                });
            }
        } else {
            const currentGuesses = participation.guesses || [];
            const hasFinished = currentGuesses.some((g: any) =>
                g.every((r: any) => r.status === 'correct')) || currentGuesses.length >= 6;

            let initialTimeLeft: number | null = null;
            if (challenge.mode === 'LIVE' && challenge.max_time) {
                const startedAt = participation.started_at ? new Date(participation.started_at).getTime() : Date.now();
                const endTime = startedAt + challenge.max_time * 60 * 1000;
                initialTimeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            }

            dispatch({
                type: 'START_GAME', payload: {
                    guesses: currentGuesses,
                    letterStatuses: getLetterStatuses(currentGuesses),
                    usedHint: participation.hints_used || false,
                    hintRecord: participation.hint_record || null,
                    isGameOver: hasFinished || participation.status === 'completed' || participation.status === 'timed_out' || (initialTimeLeft !== null && initialTimeLeft <= 0),
                    status: participation.status,
                    timeLeft: initialTimeLeft
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLength, isMarathon, participation.id]);

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
            const success = await submitChallengeResult(participation.id, {
                status: 'playing',
                guesses: { [selectedLength!]: guesses }
            });
            setIsSaving(false);
            if (!success) triggerToast("Failed to save progress.", 3000);
            if (onLengthComplete) onLengthComplete();
        } else {
            const success = await submitChallengeResult(participation.id, {
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
    }, [participation.id, isMarathon, selectedLength, guesses, usedHint, hintRecord, submitChallengeResult, triggerToast, onFinish, onLengthComplete, isSaving]);

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

        dispatch({ type: 'SUBMIT_GUESS', newGuesses, newStatuses, isWon: won, isLost: lost });

        setIsSaving(true);
        if (won || lost) {
            let resultPayload: any;
            if (isMarathon) {
                resultPayload = {
                    guesses: { [wordLength]: newGuesses },
                    hint_record: { [wordLength]: { used: usedHint, record: hintRecord } }
                };
            } else {
                const skillScore = calculateSkillIndex(newGuesses.length, 6, usedHint, newGuesses);
                resultPayload = {
                    status: 'completed',
                    score: skillScore,
                    attempts: newGuesses.length,
                    guesses: newGuesses,
                    hints_used: usedHint,
                    hint_record: hintRecord
                };
            }
            const success = await submitChallengeResult(participation.id, resultPayload);
            setIsSaving(false);
            if (!success) triggerToast("Failed to save result.", 4000);
            setTimeout(() => {
                triggerToast(won ? "Completed! 🎉" : `The word was ${targetWord}`, 5000);
                if (isMarathon) {
                    if (onLengthComplete) onLengthComplete();
                } else {
                    onFinish();
                }
            }, 2000);
        } else {
            let resultPayload: any;
            if (isMarathon) {
                resultPayload = {
                    status: 'playing',
                    guesses: { [wordLength]: newGuesses }
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
            const success = await submitChallengeResult(participation.id, resultPayload);
            setIsSaving(false);
            if (!success) triggerToast("Progress not saved.", 3000);
        }
    }, [isGameOver, isSaving, currentGuess, wordLength, targetWord, guesses, usedHint, hintRecord, participation.id, submitChallengeResult, triggerToast, onFinish, isMarathon, onLengthComplete]);

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
                    hint_record: { [selectedLength!]: { used: true, record: hintWithRow } },
                    hints_used: true
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
            const success = await submitChallengeResult(participation.id, resultPayload);
            setIsSaving(false);
            if (!success) triggerToast("Failed to save hint usage.", 3000);
        }
    };

    return {
        state,
        actions: { onChar, onDelete, onEnter, handleHint },
        isSaving,
        wordLength,
        targetWord
    };
};
