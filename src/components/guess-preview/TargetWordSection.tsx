/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { Eye } from 'lucide-react';
import { getTileSizeClass } from './types';

interface TargetWordSectionProps {
    canSeeDetails: boolean;
    showTargetWord: boolean;
    setShowTargetWord: (show: boolean) => void;
    isShapeshifter: boolean;
    gameData: any;
    targetWordToUse: string;
}

export const TargetWordSection = memo(({
    canSeeDetails,
    showTargetWord,
    setShowTargetWord,
    isShapeshifter,
    gameData,
    targetWordToUse,
}: TargetWordSectionProps) => {
    if (!canSeeDetails) {
        return (
            <div className="mb-6 mt-3 flex flex-col items-center">
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
                    <p className="text-[10px] font-black uppercase text-gray-500 tracking-tighter">
                        Target Word Hidden
                    </p>
                    <p className="text-[8px] font-bold text-gray-600 uppercase">
                        Complete your game to reveal
                    </p>
                </div>
            </div>
        );
    }

    if (!showTargetWord) {
        return (
            <div className="mb-6 mt-3 flex flex-col items-center">
                <button
                    onClick={() => setShowTargetWord(true)}
                    className="group flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                >
                    <Eye
                        size={12}
                        className="text-gray-500 group-hover:text-correct transition-colors"
                    />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">
                        Reveal Word
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="mb-6 mt-3 flex flex-col items-center">
            {isShapeshifter && gameData?.target_words && gameData.target_words.length > 0 ? (
                <div className="flex flex-col items-center animate-in zoom-in duration-300 w-full">
                    <span className="text-[9px] uppercase font-black text-gray-500 mb-2">
                        Shape Shifter Shift History
                    </span>
                    <div className="flex flex-wrap gap-2 justify-center items-center max-w-sm p-3 bg-white/5 border border-white/10 rounded-2xl">
                        {(gameData.target_words || []).map((w: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                {idx > 0 && <span className="text-correct font-black text-xs font-mono">&rarr;</span>}
                                <span className={`px-2.5 py-1 text-xs font-black uppercase font-mono rounded-lg transition-all ${idx === (gameData.target_words || []).length - 1 ? 'bg-correct text-black shadow-md shadow-correct/25 scale-105' : 'bg-white/5 text-white/50 border border-white/5'}`}>
                                    {w}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                    <span className="text-[8px] uppercase font-black text-gray-500 mb-1">
                        Target Word
                    </span>
                    <div className="flex gap-1">
                        {targetWordToUse
                            .toUpperCase()
                            .split("")
                            .map((letter, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center justify-center bg-correct/10 border border-correct/20 font-black text-correct ${getTileSizeClass(targetWordToUse.length)}`}
                                >
                                    {letter}
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
});
