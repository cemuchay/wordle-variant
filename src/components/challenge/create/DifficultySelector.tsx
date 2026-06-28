import { memo } from 'react';

export type Difficulty = 'easy' | 'normal' | 'difficult';
export type DifficultyMode = 'uniform' | 'custom';

interface DifficultySelectorProps {
    mode: 'single' | 'marathon';
    globalDifficulty: Difficulty;
    marathonDifficultyMode: DifficultyMode;
    onGlobalChange: (d: Difficulty) => void;
    onModeChange: (m: DifficultyMode) => void;
}

const DIFFS: { key: Difficulty; label: string }[] = [
    { key: 'easy', label: 'Easy' },
    { key: 'normal', label: 'Normal' },
    { key: 'difficult', label: 'Hard' },
];

function diffColor(key: Difficulty): string {
    switch (key) {
        case 'easy': return 'text-emerald-400 border-emerald-400';
        case 'normal': return 'text-correct border-correct';
        case 'difficult': return 'text-red-400 border-red-400';
    }
}

export const DifficultySelector = memo(({
    mode,
    globalDifficulty,
    marathonDifficultyMode,
    onGlobalChange,
    onModeChange,
}: DifficultySelectorProps) => {
    return (
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">Difficulty</span>
                <span className="text-[9px] text-white/40 font-medium">(3-5 letter words)</span>
            </div>

            {mode === 'marathon' && (
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10 w-fit">
                    <button
                        type="button"
                        onClick={() => { onModeChange('uniform'); }}
                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${marathonDifficultyMode === 'uniform' ? 'bg-correct text-black' : 'text-white/80'}`}
                    >
                        Uniform
                    </button>
                    <button
                        type="button"
                        onClick={() => { onModeChange('custom'); }}
                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${marathonDifficultyMode === 'custom' ? 'bg-correct text-black' : 'text-white/80'}`}
                    >
                        Per-Game
                    </button>
                </div>
            )}

            <div className="flex gap-2">
                {DIFFS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onGlobalChange(key)}
                        className={`flex-1 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer
                            ${globalDifficulty === key
                                ? `bg-black/40 ${diffColor(key)} shadow-sm`
                                : 'border-white/10 bg-black/20 text-white/60 hover:border-white/25'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
});
