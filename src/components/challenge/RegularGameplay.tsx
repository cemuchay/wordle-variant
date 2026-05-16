/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, Lightbulb, RefreshCw } from 'lucide-react';
import { memo } from 'react';
import { useChallengeGameEngine } from '../../hooks/useChallengeGameEngine';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { AudioChatControls } from './AudioChatControls';

interface RegularGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (result: any) => Promise<boolean>;
    onFinish: () => void;
    selectedLength?: number; // Optional override for Marathon mode
    onBack?: () => void; // Optional back handler
}

export const RegularGameplay = memo(({
    challenge, participation, triggerToast, submitChallengeResult, onFinish, selectedLength, onBack
}: RegularGameplayProps) => {
    const { state, actions, isSaving, retryCount, wordLength } = useChallengeGameEngine({
        challenge, 
        participation, 
        triggerToast, 
        submitChallengeResult, 
        onFinish, 
        selectedLength,
        onLengthComplete: onBack 
    });

    const { guesses, currentGuess, letterStatuses, isGameOver, isShake, usedHint, hintRecord, timeLeft } = state;

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
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack || onFinish}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
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
                {selectedLength && (
                    <div className="bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">
                        <span className="text-xs font-black text-yellow-500 uppercase tracking-widest">
                            {selectedLength} Letters
                        </span>
                    </div>
                )}
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

            {isGameOver && selectedLength && (
                <div className="p-6 text-center">
                    <button
                        onClick={onBack}
                        className="bg-correct text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                        Back to Marathon
                    </button>
                </div>
            )}
        </div>
    );
});
