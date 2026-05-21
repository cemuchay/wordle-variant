/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lightbulb, RefreshCw, AlertTriangle } from 'lucide-react';
import { memo, useEffect } from 'react';
import { useChallengeGameEngine } from '../../hooks/useChallengeGameEngine';
import { useKeyboard } from '../../hooks/useKeyboard';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { useChallengeContext } from '../../context/ChallengeContext';
import { NetworkLog } from './ChallengeUIElements';
import { getHandicapStarter } from '../../utils/marathon';

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

    const { state, actions, isSaving, syncFailed, retryCount, wordLength, networkLogs } = useChallengeGameEngine({
        challenge,
        participation,
        triggerToast,
        submitChallengeResult,
        onFinish,
        gameIndex,
        onLengthComplete: onBack
    });

    const { guesses, currentGuess, letterStatuses, isGameOver, isShake, usedHint, hintRecord } = state;

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

    return (
        <div className="flex-1 flex flex-col p-4 gap-6 relative">
            <NetworkLog logs={networkLogs} />
            
            {/* Sync Status Overlay */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
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

            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    {guesses.length >= 2 && !isGameOver && (
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

                {/* Handicap Recommendation */}
                {(() => {
                    const starterWord = (gameIndex !== undefined && gameIndex !== null)
                        ? getHandicapStarter(challenge, gameIndex, wordLength)
                        : challenge.handicap_starter;
                    if (starterWord && !challenge.handicap_enforced && guesses.length === 0 && !isGameOver) {
                        return (
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
                                className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 animate-in fade-in duration-300"
                            >
                                💡 Recommended Starter: {starterWord.toUpperCase()}
                            </button>
                        );
                    }
                    return null;
                })()}


            </div>

            <div className="flex-1 flex items-center justify-center min-h-0">
                <div className="scale-[0.8] sm:scale-100 origin-center">
                    <Grid
                        wordLength={wordLength}
                        maxAttempts={6}
                        guesses={guesses}
                        currentGuess={currentGuess}
                        hintRecord={hintRecord}
                        isChallengeMode={true}
                        isShake={isShake}
                        isSaving={isSaving}
                    />
                </div>
            </div>

            {!isGameOver && (
                <div className="w-full max-w-lg mx-auto pb-1">
                    <Keyboard
                        onChar={actions.onChar}
                        onDelete={actions.onDelete}
                        onEnter={actions.onEnter}
                        letterStatuses={letterStatuses}
                    />
                </div>
            )}
        </div>
    );
});
