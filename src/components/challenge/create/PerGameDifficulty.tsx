import { memo } from 'react';
import type { Difficulty } from './DifficultySelector';

interface PerGameDifficultyProps {
    value: Difficulty;
    onChange: (d: Difficulty) => void;
}

const PILLS: { key: Difficulty; label: string }[] = [
    { key: 'easy', label: 'E' },
    { key: 'normal', label: 'N' },
    { key: 'difficult', label: 'H' },
];

function pillColor(key: Difficulty, active: boolean): string {
    if (!active) return 'border-white/10 text-white/40 bg-black/20 hover:border-white/30';
    switch (key) {
        case 'easy': return 'border-emerald-400 text-emerald-400 bg-emerald-500/10';
        case 'normal': return 'border-correct text-correct bg-correct/10';
        case 'difficult': return 'border-red-400 text-red-400 bg-red-500/10';
    }
}

export const PerGameDifficulty = memo(({ value, onChange }: PerGameDifficultyProps) => {
    return (
        <div className="flex items-center gap-1">
            {PILLS.map(({ key, label }) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={`w-7 h-6 rounded-md border text-[10px] font-black transition-all cursor-pointer leading-none ${pillColor(key, value === key)}`}
                    title={key.charAt(0).toUpperCase() + key.slice(1)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
});
