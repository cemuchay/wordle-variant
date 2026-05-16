/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, Lightbulb, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useReducer, useState } from 'react';
import { getWordLists } from '../../data/words';
import { calculateSkillIndex, checkGuess, getHint, getLetterStatuses } from '../../lib/gameLogic';
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
    const [state, dispatch] = useReducer(challengeGameReducer, {
        ...initialChallengeState,
        guesses: participation.guesses || [],
        letterStatuses: getLetterStatuses(participation.guesses || []),
        usedHint: participation.hints_used || false,
        hintRecord: participation.hint_record || null,
        status: participation.status
    });

    const [isSaving, setIsSaving] = useState(false);

    const { guesses, currentGuess, letterStatuses, isGameOver, isShake, usedHint, hintRecord, timeLeft } = state;

    // Initialize timer
    useEffect(() => {
        if (challenge.mode === 'LIVE' && challenge.max_time) {
            const startedAt = participation.started_at ? new Date(participation.started_at).getTime() : Date.now();
            const endTime = startedAt + challenge.max_time * 60 * 1000;
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

            dispatch({ type: 'START_GAME', payload: { ...state, timeLeft: remaining, isGameOver: participation.status === 'completed' || participation.status === 'timed_out' || remaining <= 0 } });
        } else {
            dispatch({ type: 'START_GAME', payload: { ...state, timeLeft: null, isGameOver: participation.status === 'completed' || participation.status === 'timed_out' } });
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
    }, [participation.id, guesses, usedHint, hintRecord, submitChallengeResult, triggerToast, onFinish]);

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

        const hint = getHint(challenge.target_word, guesses);
        if (hint) {
            const hintWithRow = { ...hint, row: guesses.length };
            dispatch({ type: 'SET_HINT', hint: hintWithRow });
            triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`, 5000);

            setIsSaving(true);
            const success = await submitChallengeResult(participation.id, {
                status: 'playing',
                score: 0,
                attempts: guesses.length,
                guesses: guesses,
                hints_used: true,
                hint_record: hintWithRow
            });
            setIsSaving(false);
            if (!success) triggerToast("Failed to save hint usage.", 3000);
        }
    };

    const onChar = useCallback((char: string) => {
        dispatch({ type: 'TYPE_CHAR', char, wordLength: challenge.word_length });
    }, [challenge.word_length]);

    const onDelete = useCallback(() => {
        dispatch({ type: 'DELETE_CHAR' });
    }, []);

    const onEnter = useCallback(async () => {
        if (isGameOver || currentGuess.length !== challenge.word_length) return;

        const upperGuess = currentGuess.toUpperCase();
        const { valid } = getWordLists(challenge.word_length);

        if (!valid.has(upperGuess)) {
            triggerToast("Not in word list.");
            dispatch({ type: 'SHAKE_GUESS' });
            setTimeout(() => dispatch({ type: 'STOP_SHAKE' }), 500);
            return;
        }

        const result = checkGuess(upperGuess, challenge.target_word);
        const newGuesses = [...guesses, result];
        const newStatuses = getLetterStatuses(newGuesses);
        const won = upperGuess === challenge.target_word;
        const lost = newGuesses.length === 6;

        dispatch({ type: 'SUBMIT_GUESS', newGuesses, newStatuses, isWon: won, isLost: lost });

        setIsSaving(true);
        if (won || lost) {
            const skillScore = calculateSkillIndex(newGuesses.length, 6, usedHint, newGuesses);
            const success = await submitChallengeResult(participation.id, {
                status: 'completed',
                score: skillScore,
                attempts: newGuesses.length,
                guesses: newGuesses,
                hints_used: usedHint,
                hint_record: hintRecord
            });
            setIsSaving(false);
            if (!success) triggerToast("Failed to save final result.", 4000);

            setTimeout(() => {
                triggerToast(won ? "Challenge Completed! 🎉" : `The word was ${challenge.target_word}`, 5000);
                onFinish();
            }, 2000);
        } else {
            const success = await submitChallengeResult(participation.id, {
                status: 'playing',
                score: 0,
                attempts: newGuesses.length,
                guesses: newGuesses,
                hints_used: usedHint,
                hint_record: hintRecord
            });
            setIsSaving(false);
            if (!success) triggerToast("Progress not saved. Check connection.", 3000);
        }
    }, [isGameOver, currentGuess, challenge, guesses, usedHint, hintRecord, participation.id, submitChallengeResult, triggerToast, onFinish]);

    // Physical Keyboard
    useEffect(() => {
        if (isGameOver) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) return;
            const key = e.key.toUpperCase();
            if (key === 'ENTER') onEnter();
            else if (key === 'BACKSPACE') onDelete();
            else if (/^[A-Z]$/.test(key)) onChar(key);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isGameOver, onEnter, onDelete, onChar]);

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
                        onClick={onFinish}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
                        title="Back to Lobby"
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
                        wordLength={challenge.word_length}
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
        </div>
    );
});
