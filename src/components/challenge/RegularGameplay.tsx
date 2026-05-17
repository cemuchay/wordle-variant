/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lightbulb, RefreshCw } from 'lucide-react';
import { memo, useEffect } from 'react';
import { useChallengeGameEngine } from '../../hooks/useChallengeGameEngine';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { useChallengeContext } from '../../context/ChallengeContext';

interface RegularGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any, wordLength?: number) => Promise<boolean>;
    onFinish: () => void;
    selectedLength?: number; // Optional override for Marathon mode
    onBack?: () => void; // Optional back handler
    setTimeLeftGlobal?: (t: number | null) => void;
}

export const RegularGameplay = memo(({
    challenge, participation, triggerToast, submitChallengeResult, onFinish, selectedLength, onBack, setTimeLeftGlobal
}: RegularGameplayProps) => {
    const { setBackAction } = useChallengeContext();

    useEffect(() => {
        const back = onBack || onFinish;
        setBackAction(() => back);
        return () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            setBackAction((prev: any) => prev === back ? null : prev);
        };
    }, [onBack, onFinish, setBackAction]);

    const { state, actions, isSaving, retryCount, wordLength } = useChallengeGameEngine({
        challenge,
        participation,
        triggerToast,
        submitChallengeResult,
        onFinish,
        selectedLength,
        onLengthComplete: onBack,
        setTimeLeftGlobal
    });

    const { guesses, currentGuess, letterStatuses, isGameOver, isShake, usedHint, hintRecord } = state;

    return (
        <div className="flex-1 flex flex-col p-4 gap-6 relative">
            {isSaving && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <RefreshCw size={10} className={`animate-spin ${retryCount > 0 ? 'text-red-500' : 'text-correct'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                        {retryCount > 0 ? `Retrying ${retryCount}/3...` : 'Syncing...'}
                    </span>
                </div>
            )}

            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    {selectedLength ? (
                        <div className="bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">
                            <span className="text-xs font-black text-yellow-500 uppercase tracking-widest">
                                {selectedLength} Letters
                            </span>
                        </div>
                    ) : (
                        <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                            <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                                {challenge.word_length} Letters
                            </span>
                        </div>
                    )}
                </div>

                {guesses.length >= 3 && !isGameOver && (
                    <button
                        onClick={actions.handleHint}
                        className={`p-2 transition-all rounded-xl ${usedHint ? 'text-yellow-500/30' : 'text-yellow-500 bg-yellow-500/10 animate-pulse'}`}
                    >
                        <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
                    </button>
                )}
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
