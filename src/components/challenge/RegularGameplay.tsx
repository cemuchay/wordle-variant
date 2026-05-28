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

    const { state, actions, isSaving, syncFailed, retryCount, wordLength, targetWord, networkLogs } = useChallengeGameEngine({
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

    const starterWord = (gameIndex !== undefined && gameIndex !== null)
        ? getHandicapStarter(challenge, gameIndex, wordLength)
        : challenge.handicap_starter;
    const showStarter = starterWord && !challenge.handicap_enforced && guesses.length === 0 && !isGameOver;
    const showHint = guesses.length >= 2 && !isGameOver && !challenge.disable_hints;

    return (
        <div className="flex-1 flex flex-col p-2 sm:p-3 gap-2 sm:gap-3 relative overflow-hidden min-h-0">
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

            {(showHint || showStarter) && (
                <div className="flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-3">
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
                            className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 animate-in fade-in duration-300"
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
                />
            </div>

            {!isGameOver ? (
                <div className="w-full max-w-lg mx-auto pb-0.5 shrink-0">
                    <Keyboard
                        onChar={actions.onChar}
                        onDelete={actions.onDelete}
                        onEnter={actions.onEnter}
                        letterStatuses={letterStatuses}
                        compact={true}
                    />
                </div>
            ) : (
                <div className="w-full max-w-lg mx-auto pb-2 shrink-0 animate-in fade-in slide-in-from-bottom-5 duration-500">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 text-center">
                        <div>
                            <span className={`text-xs font-black uppercase tracking-widest ${guesses.some((g: any) => g.every((c: any) => c.status === 'correct')) ? 'text-correct animate-bounce inline-block' : 'text-red-500'}`}>
                                {guesses.some((g: any) => g.every((c: any) => c.status === 'correct')) ? 'Completed! 🎉' : 'Challenge Failed 💔'}
                            </span>
                            <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-0.5">
                                The correct word was
                            </h4>
                        </div>
                        
                        <div className="flex gap-1.5 justify-center">
                            {(targetWord || '').toUpperCase().split('').map((letter, i) => (
                                <div
                                    key={i}
                                    className="w-8 h-8 rounded-lg bg-correct/10 border border-correct/30 flex items-center justify-center text-xs font-black text-correct shadow-inner shadow-correct/5 animate-in zoom-in duration-300"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    {letter}
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 rounded-full bg-correct animate-pulse" />
                            <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider">
                                Syncing results with lobby...
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
