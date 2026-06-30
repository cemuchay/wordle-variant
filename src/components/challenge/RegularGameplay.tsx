/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { ANIMATION_DURATION } from '../../constants/ui';
import { ANIMATION } from '../../constants/game';
import { useApp } from '../../context/AppContext';
import { useChallengeContext } from '../../context/ChallengeContext';
import { useChallengeGameEngine } from '../../hooks/useChallengeGameEngine';
import { useKeyboard } from '../../hooks/useKeyboard';
import { getHandicapStarter, parseMarathonGames } from '../../utils/marathon';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { NetworkLog } from './ChallengeUIElements';
import { useMemo } from 'react';

interface RegularGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any, wordLength?: number, gameIndex?: number) => Promise<boolean>;
    onFinish: () => void;
    gameIndex?: number | null; // Optional override for Marathon mode
    onBack?: () => void; // Optional back handler
}

export const RegularGameplay = memo(function RegularGameplay({
    challenge, participation, triggerToast, submitChallengeResult, onFinish, gameIndex, onBack
}: RegularGameplayProps) {
    const { setBackAction } = useChallengeContext();
    const { isDynamicIslandVisible } = useApp();

    const { state, actions, isSaving, syncFailed, retryCount, wordLength, maxAttempts, networkLogs } = useChallengeGameEngine({
        challenge,
        participation,
        triggerToast,
        submitChallengeResult,
        onFinish,
        gameIndex,
        onLengthComplete: onBack || onFinish
    });

    const { guesses, currentGuess, cursorIndex, editIndex, letterStatuses, isGameOver, isShake, usedHint, hintRecord } = state;

    // Stabilize UI state to wait for reveal animations
    const [stableGuessesCount, setStableGuessesCount] = useState(guesses.length);
    const [stableIsHintDisabled, setStableIsHintDisabled] = useState(state.isHintDisabled);

    useEffect(() => {
        if (!state.isRevealing) {
            setStableGuessesCount(guesses.length);
            setStableIsHintDisabled(state.isHintDisabled);
        }
    }, [guesses.length, state.isRevealing, state.isHintDisabled]);

    const wasGameOverOnMount = useRef(isGameOver);
    const [hideKeyboard, setHideKeyboard] = useState(wasGameOverOnMount.current);
    const [keyboardStatuses, setKeyboardStatuses] = useState(letterStatuses);

    useEffect(() => {
        if (guesses.length === 0) {
            setKeyboardStatuses(letterStatuses);
            return;
        }
        const timer = setTimeout(() => {
            setKeyboardStatuses(letterStatuses);
        }, wordLength * ANIMATION_DURATION.TILE_REVEAL + 400);
        return () => clearTimeout(timer);
    }, [guesses.length, letterStatuses, wordLength]);

    useEffect(() => {
        if (isGameOver) {
            if (wasGameOverOnMount.current) {
                setHideKeyboard(true);
            } else {
                const hideDelay = wordLength * ANIMATION_DURATION.TILE_REVEAL + ANIMATION.REVEAL_BUFFER;
                const timer = setTimeout(() => {
                    setHideKeyboard(true);
                }, hideDelay);
                return () => clearTimeout(timer);
            }
        } else {
            setHideKeyboard(false);
            wasGameOverOnMount.current = false;
        }
    }, [isGameOver, wordLength]);

    // Physical Keyboard Support
    useKeyboard(actions, isGameOver);

    useEffect(() => {
        // Ensure window has focus to capture keyboard events when game starts
        window.focus();

        const back = onBack || onFinish;
        setBackAction(() => back);
        return () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            setBackAction((prev: any) => prev === back ? null : prev);
        };
    }, [onBack, onFinish, setBackAction]);

    const starterWord = (gameIndex !== undefined && gameIndex !== null)
        ? getHandicapStarter(challenge, gameIndex, wordLength)
        : challenge.handicap_starter;
    const showStarter = starterWord && !challenge.handicap_enforced && guesses.length === 0 && !isGameOver;
    const showHint = stableGuessesCount >= ANIMATION.HINT_MIN_GUESSES && (!isGameOver || state.isRevealing) && !challenge.disable_hints;

    const sentenceGames = useMemo(() => {
        if (!challenge.salt?.endsWith('_sentence')) return null;
        return parseMarathonGames(challenge.target_word, challenge.salt);
    }, [challenge.target_word, challenge.salt]);

    const lastGuess = guesses[guesses.length - 1];

    if (lastGuess) {
        const charCounts: Record<string, number> = {};
        for (const res of lastGuess) {
            if (res.letter) {
                const char = res.letter.toUpperCase();
                charCounts[char] = (charCounts[char] || 0) + 1;
                if (charCounts[char] >= 3) {

                    break;
                }
            }
        }
    }


    return (
        <div className="gameplay-container flex-1 flex flex-col p-2 sm:p-3 gap-2 sm:gap-3 relative overflow-hidden min-h-0">
            <NetworkLog logs={networkLogs} />

            {/* Sync Status Overlay */}
            <div className={`absolute left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 ${isDynamicIslandVisible ? 'top-12' : 'top-2'}`}>
                {isSaving && (retryCount > 0 || syncFailed) && (
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                        <RefreshCw size={10} className="animate-spin text-red-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                            {syncFailed ? 'Retrying sync...' : `Retrying ${retryCount}/3...`}
                        </span>
                    </div>
                )}

                {syncFailed && !isSaving && (
                    <button
                        onClick={actions.retrySync}
                        className="bg-red-500/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-red-400/50 flex items-center gap-2 animate-bounce shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                    >
                        <AlertTriangle size={12} className="text-white" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">
                            Sync Failed - Retry?
                        </span>
                    </button>
                )}
            </div>

            {(showHint || showStarter) && (
                <div className={`absolute left-4 right-4 flex items-center justify-between pointer-events-none z-45 ${isDynamicIslandVisible ? 'top-12' : 'top-3'}`}>
                    <div className="flex items-center gap-3 pointer-events-auto">
                        {showHint && (
                            <button
                                onClick={actions.handleHint}
                                disabled={usedHint || stableGuessesCount >= maxAttempts - 1 || stableIsHintDisabled}
                                className={`p-2 transition-all rounded-xl relative ${usedHint ? 'text-yellow-500/30 cursor-not-allowed' : ((stableGuessesCount >= maxAttempts - 1 || stableIsHintDisabled) ? 'text-gray-600 cursor-not-allowed opacity-50' : 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95 animate-pulse')}`}
                                title={usedHint ? "Hint Used" : (stableGuessesCount >= maxAttempts - 1 || stableIsHintDisabled) ? "Hint Unavailable" : "Get Hint"}
                            >
                                <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
                                {(stableGuessesCount >= maxAttempts - 1 || stableIsHintDisabled) && !usedHint && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-[80%] h-[2px] bg-red-600/60 rotate-45" />
                                    </div>
                                )}
                            </button>
                        )}
                    </div>

                    {showStarter && (
                        <button
                            onClick={() => {
                                const starter = starterWord.toUpperCase();
                                // Clear current input first
                                for (let i = 0; i < currentGuess.length; i++) {
                                    actions.onDelete();
                                }
                                // Type it letter by letter
                                starter.split('').forEach((char: string) => actions.onChar(char));
                            }}
                            className="pointer-events-auto bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 animate-in fade-in duration-300"
                        >
                            💡 Recommended Starter: {starterWord.toUpperCase()}
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden gap-3">
                {sentenceGames && (
                    <div className="bg-indigo-950/30 border border-indigo-500/25 p-3 rounded-xl max-w-md w-full shrink-0 flex flex-wrap gap-x-2.5 gap-y-1.5 items-center justify-center text-center">
                        {sentenceGames.map((g, idx) => {
                            const prog = participation?.marathon_progress?.find((p: any) => p.game_index === idx);
                            const isCompleted = prog?.status === 'completed' || (idx < (gameIndex ?? 0));
                            const isActive = idx === gameIndex;

                            if (isCompleted) {
                                return (
                                    <span key={idx} className="text-xs font-black text-correct uppercase border-b-2 border-correct/30 px-1 py-0.5 animate-in fade-in duration-200">
                                        {g.word}
                                    </span>
                                );
                            } else if (isActive) {
                                return (
                                    <span key={idx} className="text-[10px] font-black text-indigo-300 tracking-wider px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/40 rounded-md">
                                        {Array(g.wordLength).fill('_').join(' ')}
                                    </span>
                                );
                            } else {
                                return (
                                    <span key={idx} className="text-[9px] font-black text-white/30 uppercase border-b border-dashed border-white/10 px-1 py-0.5">
                                        {g.wordLength}L
                                    </span>
                                );
                            }
                        })}
                    </div>
                )}

                <Grid
                    wordLength={wordLength}
                    maxAttempts={maxAttempts}
                    guesses={guesses}
                    currentGuess={currentGuess}
                    cursorIndex={cursorIndex}
                    editIndex={editIndex}
                    hintRecord={hintRecord}
                    isChallengeMode={true}
                    isShake={isShake}
                    isSaving={isSaving}
                    compact={true}
                    gameplayType="challenge"
                    onSetCursor={actions.onSetCursor}
                    onSetEditIndex={actions.onSetEditIndex}
                />
            </div>

            {!hideKeyboard && (
                <div className="w-full max-w-lg mx-auto pb-[calc(0.75rem+env(safe-area-inset-bottom,0))] shrink-0 px-2">
                    <Keyboard
                        onChar={actions.onChar}
                        onDelete={actions.onDelete}
                        onEnter={actions.onEnter}
                        letterStatuses={keyboardStatuses}
                        gameplayType="challenge"
                    />
                </div>
            )}
        </div>
    );
});
