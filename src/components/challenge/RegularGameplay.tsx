/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { ANIMATION_DURATION } from '../../constants/ui';
import { useApp } from '../../context/AppContext';
import { useChallengeContext } from '../../context/ChallengeContext';
import { useChallengeGameEngine } from '../../hooks/useChallengeGameEngine';
import { useKeyboard } from '../../hooks/useKeyboard';
import { getHandicapStarter } from '../../utils/marathon';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { NetworkLog } from './ChallengeUIElements';

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

    const { state, actions, isSaving, syncFailed, retryCount, wordLength, networkLogs } = useChallengeGameEngine({
        challenge,
        participation,
        triggerToast,
        submitChallengeResult,
        onFinish,
        gameIndex,
        onLengthComplete: onBack || onFinish
    });

    const { guesses, currentGuess, letterStatuses, isGameOver, isShake, usedHint, hintRecord } = state;

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
                const hideDelay = wordLength * 400 + 400; // Match TILE_REVEAL + padding
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
    useKeyboard(actions, isGameOver || isSaving);

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
    const showHint = guesses.length >= 2 && !isGameOver && !challenge.disable_hints;

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
                {isSaving && (
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                        <RefreshCw size={10} className={`animate-spin ${retryCount > 0 ? 'text-red-500' : 'text-correct'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                            {retryCount > 0 ? `Retrying ${retryCount}/3...` : 'Syncing...'}
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
                                disabled={usedHint || guesses.length >= 5 || state.isHintDisabled}
                                className={`p-2 transition-all rounded-xl relative ${usedHint ? 'text-yellow-500/30 cursor-not-allowed' : ((guesses.length >= 5 || state.isHintDisabled) ? 'text-gray-600 cursor-not-allowed opacity-50' : 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95 animate-pulse')}`}
                                title={usedHint ? "Hint Used" : (guesses.length >= 5 || state.isHintDisabled) ? "Hint Unavailable" : "Get Hint"}
                            >
                                <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
                                {(guesses.length >= 5 || state.isHintDisabled) && !usedHint && (
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

            <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
                <Grid
                    wordLength={wordLength}
                    maxAttempts={6}
                    guesses={guesses}
                    currentGuess={currentGuess}
                    hintRecord={hintRecord}
                    isChallengeMode={true}
                    isShake={isShake}
                    isSaving={isSaving}
                    compact={true}
                    gameplayType="challenge"
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
