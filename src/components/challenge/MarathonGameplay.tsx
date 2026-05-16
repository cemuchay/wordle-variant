/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState } from 'react';
import { RegularGameplay } from './RegularGameplay';

interface MarathonGameplayProps {
    challenge: any;
    participation: any;
    triggerToast: (msg: string, duration?: number) => void;
    submitChallengeResult: (id: string, result: any) => Promise<boolean>;
    onFinish: () => void;
}

export const MarathonGameplay = memo(({
    challenge, participation, triggerToast, submitChallengeResult, onFinish
}: MarathonGameplayProps) => {
    const [selectedLength, setSelectedLength] = useState<number | null>(null);

    if (selectedLength) {
        return (
            <RegularGameplay
                challenge={challenge}
                participation={participation}
                triggerToast={triggerToast}
                submitChallengeResult={submitChallengeResult}
                onFinish={onFinish}
                selectedLength={selectedLength}
                onBack={() => setSelectedLength(null)}
            />
        );
    }

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
});
