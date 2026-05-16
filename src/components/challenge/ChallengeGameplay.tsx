/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, Lightbulb, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useReducer, useState, useMemo } from 'react';
import { getWordLists } from '../../data/words';
import { calculateSkillIndex, checkGuess, getHint, getLetterStatuses } from '../../lib/game-logic';
import { challengeGameReducer, initialChallengeState } from '../../reducers/challengeReducer';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { AudioChatControls } from './AudioChatControls';

interface ChallengeGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (participationId: string, result: any) => Promise<boolean>;
    onFinish: () => void;
}

export const ChallengeGameplay = memo(({
    challenge, participation, triggerToast, submitChallengeResult, onFinish
}: ChallengeGameplayProps) => {
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

    const [selectedLength, setSelectedLength] = useState<number | null>(null);

    // Initial state based on current participation data
    const [state, dispatch] = useReducer(challengeGameReducer, {
        ...initialChallengeState,
        guesses: [],
        letterStatuses: {},
        usedHint: false,
        hintRecord: null,
        status: participation.status
    });

    const [isSaving, setIsSaving] = useState(false);

    const { guesses, currentGuess, letterStatuses, isGameOver, isShake, usedHint, hintRecord, timeLeft } = state;

    // Load sub-game state if marathon and length selected
    useEffect(() => {
        if (isMarathon && selectedLength) {
            const lengthGuesses = participation.guesses?.[selectedLength] || [];
            const lengthHintsUsed = participation.hint_record?.[selectedLength]?.used || false;
            const lengthHintRecord = participation.hint_record?.[selectedLength]?.record || null;
            const lengthFinished = lengthGuesses.some((g: any) =>
                g.every((r: any) => r.status === 'correct')) || lengthGuesses.length >= 6;

            // Handle Per-Game Timer for Marathon LIVE mode
            let subGameTimeLeft: number | null = null;
            if (challenge.mode === 'LIVE' && challenge.max_time) {
                const subGameStart = participation.hint_record?.[selectedLength]?.started_at;
                if (subGameStart) {
                    const elapsed = Math.floor((Date.now() - new Date(subGameStart).getTime()) / 1000);
                    subGameTimeLeft = Math.max(0, (challenge.max_time * 60) - elapsed);
                } else {
                    // First time entering this length, timer starts now
                    subGameTimeLeft = challenge.max_time * 60;
                    // Persist start time immediately to DB
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
        } else if (!isMarathon) {
            // ... (rest of fixed length logic)
            dispatch({
                type: 'START_GAME', payload: {
                    ...state,
                    guesses: participation.guesses || [],
                    letterStatuses: getLetterStatuses(participation.guesses || []),
                    usedHint: participation.hints_used || false,
                    hintRecord: participation.hint_record || null,
                    isGameOver: participation.status === 'completed' || participation.status === 'timed_out',
                    status: participation.status,
                    timeLeft: null // Will be set by global timer effect below
                }
            });
        }
    }, [selectedLength, isMarathon, participation.id]); // Removed participation dependency to prevent loops, using ID instead

    // Initialize timer for non-marathon LIVE mode (Global Timer)
    useEffect(() => {
        if (!isMarathon && challenge.mode === 'LIVE' && challenge.max_time) {
            const startedAt = participation.started_at ? new Date(participation.started_at).getTime() : Date.now();
            const endTime = startedAt + challenge.max_time * 60 * 1000;
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

            dispatch({ type: 'START_GAME', payload: { ...state, timeLeft: remaining, isGameOver: participation.status === 'completed' || participation.status === 'timed_out' || remaining <= 0 } });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        dispatch({ type: 'TIME_UP' });
        triggerToast("Time's up!", 3000);
        setIsSaving(true);

        if (isMarathon) {
            // Just fail this specific word, but keep marathon playing
            const updatedGuesses = { ...(participation.guesses || {}) };
            // If they haven't made any guesses, we still need to mark it as failed (empty guesses)
            if (!updatedGuesses[selectedLength!]) updatedGuesses[selectedLength!] = [];

            const success = await submitChallengeResult(participation.id, {
                status: 'playing',
                guesses: updatedGuesses,
                attempts: participation.attempts || 0
            });
            setIsSaving(false);
            if (!success) triggerToast("Failed to save progress.", 3000);
            setTimeout(() => setSelectedLength(null), 2000);
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
            if (!success) triggerToast("Failed to save result. Please check your connection.", 4000);
            setTimeout(onFinish, 2000);
        }
    }, [participation, isMarathon, selectedLength, guesses, usedHint, hintRecord, submitChallengeResult, triggerToast, onFinish]);

    // Expiration Handler
    useEffect(() => {
        if (timeLeft === 0 && !isGameOver) {
            handleTimeExpired();
        }
    }, [timeLeft, isGameOver, handleTimeExpired]);

    const handleHint = async () => {
        if (isGameOver) return;

        if (usedHint && hintRecord) {
            triggerToast(`Reminder: "${hintRecord.letter}" is at position ${hintRecord.index + 1}.`, 3000);
            return;
        }

        if (guesses.length < 3) {
            triggerToast("Hint unlocks after 3 attempts.", 3000);
            return;
        }

        const targetWord = isMarathon ? marathonWords[selectedLength!] : challenge.target_word;
        const hint = getHint(targetWord, guesses);
        if (hint) {
            const hintWithRow = { ...hint, row: guesses.length };
            dispatch({ type: 'SET_HINT', hint: hintWithRow });
            triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`, 5000);

            setIsSaving(true);
            let resultPayload: any;
            if (isMarathon) {
                const updatedHints = { ...(participation.hint_record || {}) };
                updatedHints[selectedLength!] = { used: true, record: hintWithRow };
                resultPayload = {
                    status: 'playing',
                    hint_record: updatedHints,
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

    const onChar = useCallback((char: string) => {
        const wordLength = isMarathon ? selectedLength! : challenge.word_length;
        dispatch({ type: 'TYPE_CHAR', char, wordLength });
    }, [challenge.word_length, isMarathon, selectedLength]);

    const onDelete = useCallback(() => {
        dispatch({ type: 'DELETE_CHAR' });
    }, []);

    const onEnter = useCallback(async () => {
        const wordLength = isMarathon ? selectedLength! : challenge.word_length;
        const targetWord = isMarathon ? marathonWords[selectedLength!] : challenge.target_word;

        if (isGameOver || currentGuess.length !== wordLength) return;

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
            const skillScore = calculateSkillIndex(newGuesses.length, 6, usedHint, newGuesses);

            let resultPayload: any;
            if (isMarathon) {
                const updatedGuesses = { ...(participation.guesses || {}) };
                updatedGuesses[wordLength] = newGuesses;

                const updatedHintRecord = { ...(participation.hint_record || {}) };
                updatedHintRecord[wordLength] = { used: usedHint, record: hintRecord };

                const allLengths = [3, 4, 5, 6, 7];
                const isAllCompleted = allLengths.every(l =>
                    (updatedGuesses[l]?.some((g: any) =>
                        g.every((r: any) => r.status === 'correct') || g.length >= 6
                    )) || (l === wordLength && (won || lost))
                );

                const totalScore = (participation.score || 0) + skillScore;

                resultPayload = {
                    status: isAllCompleted ? 'completed' : 'playing',
                    score: totalScore,
                    guesses: updatedGuesses,
                    hint_record: updatedHintRecord,
                    attempts: (participation.attempts || 0) + newGuesses.length
                };
            } else {
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
                    setSelectedLength(null);
                } else {
                    onFinish();
                }
            }, 2000);
        } else {
            let resultPayload: any;
            if (isMarathon) {
                const updatedGuesses = { ...(participation.guesses || {}) };
                updatedGuesses[wordLength] = newGuesses;
                resultPayload = {
                    status: 'playing',
                    guesses: updatedGuesses,
                    attempts: (participation.attempts || 0) + 1
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
            if (!success) triggerToast("Progress not saved. Check connection.", 3000);
        }
    }, [isGameOver, currentGuess, challenge, guesses, usedHint, hintRecord, participation, submitChallengeResult, triggerToast, onFinish, isMarathon, marathonWords, selectedLength]);

    // Physical Keyboard
    useEffect(() => {
        if (isGameOver || (isMarathon && !selectedLength)) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) return;
            const key = e.key.toUpperCase();
            if (key === 'ENTER') onEnter();
            else if (key === 'BACKSPACE') onDelete();
            else if (/^[A-Z]$/.test(key)) onChar(key);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isGameOver, onEnter, onDelete, onChar, isMarathon, selectedLength]);

    if (isMarathon && !selectedLength) {
        const allLengths = [3, 4, 5, 6, 7];
        return (
            <div className="flex-1 p-6 flex flex-col gap-8">
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-tighter">Marathon Mode</h3>
                    <p className="text-gray-500 text-xs">Complete all lengths to finish the challenge.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {allLengths.map(l => {
                        const lengthGuesses = participation.guesses?.[l] || [];
                        const isCompleted = lengthGuesses.some((g: any) => g.every((r: any) => r.status === 'correct'));
                        const isFailed = !isCompleted && lengthGuesses.length >= 6;
                        const isFinished = isCompleted || isFailed;

                        return (
                            <button
                                key={l}
                                onClick={() => setSelectedLength(l)}
                                disabled={isFinished}
                                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isFinished ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-yellow-500 hover:bg-yellow-500/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isCompleted ? 'bg-correct text-black' : isFailed ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}>
                                        {l}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-black uppercase">{l} Letters</p>
                                        <p className="text-[10px] text-gray-500">{isFinished ? (isCompleted ? 'Completed' : 'Failed') : 'Not Started'}</p>
                                    </div>
                                </div>
                                {isFinished && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-gray-400">{lengthGuesses.length}/6 Tries</p>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black">Total Score</p>
                        <p className="text-2xl font-black text-correct">{participation.score || 0}</p>
                    </div>
                    <button
                        onClick={onFinish}
                        className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                        Exit to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-6 relative">
            {/* Saving Indicator */}
            {isSaving && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <RefreshCw size={10} className="animate-spin text-correct" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Syncing...</span>
                </div>
            )}

            {/* Gameplay Header (Timer & Hint) */}
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={isMarathon ? () => setSelectedLength(null) : onFinish}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
                        title={isMarathon ? "Back to Marathon List" : "Back to Lobby"}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    {timeLeft !== null && (
                        <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
                            <span className="text-xs font-black text-red-500 tabular-nums">
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    <AudioChatControls challengeId={challenge.id} userId={participation.user_id} />
                </div>
                {isMarathon && (
                    <div className="bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">
                        <span className="text-xs font-black text-yellow-500 uppercase tracking-widest">
                            {selectedLength} Letters
                        </span>
                    </div>
                )}
                {guesses.length >= 3 && !isGameOver && (
                    <button
                        onClick={handleHint}
                        className={`p-2 transition-all rounded-xl ${usedHint ? 'text-yellow-500/30' : 'text-yellow-500 bg-yellow-500/10 animate-pulse'}`}
                    >
                        <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
                    </button>
                )}
            </div>

            <div className="flex-1 flex items-center justify-center min-h-0">
                <div className="scale-[0.8] sm:scale-100 origin-center">
                    <Grid
                        wordLength={isMarathon ? selectedLength! : challenge.word_length}
                        maxAttempts={6}
                        guesses={guesses}
                        currentGuess={currentGuess}
                        hintRecord={hintRecord}
                        isChallengeMode={true}
                        isShake={isShake}
                    />
                </div>
            </div>

            {!isGameOver && (
                <div className="w-full max-w-lg mx-auto pb-1">
                    <Keyboard
                        onChar={onChar}
                        onDelete={onDelete}
                        onEnter={onEnter}
                        letterStatuses={letterStatuses}
                    />
                </div>
            )}
            {isGameOver && isMarathon && (
                <div className="p-6 text-center">
                    <button
                        onClick={() => setSelectedLength(null)}
                        className="bg-correct text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                        Back to Marathon
                    </button>
                </div>
            )}
        </div>
    );
});
