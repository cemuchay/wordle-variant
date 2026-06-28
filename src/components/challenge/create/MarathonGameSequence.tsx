import { memo, useCallback, useRef } from 'react';
import { GripVertical, X } from 'lucide-react';

interface MarathonGameSequenceProps {
    marathonGames: number[];
    onUpdate: (games: number[]) => void;
    marathonType: 'standard' | 'custom';
    onTypeChange: (type: 'standard' | 'custom') => void;
    marathonForceOrder: boolean;
    onForceOrderChange: (v: boolean) => void;
}

const ADDABLE_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10] as const;
const MAX_GAMES = 20;

function lengthColor(l: number): { text: string; border: string; bg: string } {
    const map: Record<number, { text: string; border: string; bg: string }> = {
        3: { text: 'text-rose-400', border: 'border-l-rose-400', bg: 'bg-rose-500/5' },
        4: { text: 'text-orange-400', border: 'border-l-orange-400', bg: 'bg-orange-500/5' },
        5: { text: 'text-correct', border: 'border-l-correct', bg: 'bg-correct/5' },
        6: { text: 'text-cyan-400', border: 'border-l-cyan-400', bg: 'bg-cyan-500/5' },
        7: { text: 'text-blue-400', border: 'border-l-blue-400', bg: 'bg-blue-500/5' },
        8: { text: 'text-violet-400', border: 'border-l-violet-400', bg: 'bg-violet-500/5' },
        9: { text: 'text-fuchsia-400', border: 'border-l-fuchsia-400', bg: 'bg-fuchsia-500/5' },
        10: { text: 'text-amber-400', border: 'border-l-amber-400', bg: 'bg-amber-500/5' },
    };
    return map[l] ?? { text: 'text-white/60', border: 'border-l-transparent', bg: '' };
}

export const MarathonGameSequence = memo(({
    marathonGames,
    onUpdate,
    marathonType,
    onTypeChange,
    marathonForceOrder,
    onForceOrderChange,
}: MarathonGameSequenceProps) => {
    const dragIdx = useRef<number | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
        dragIdx.current = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        (e.currentTarget as HTMLElement).classList.add('opacity-40');
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove('opacity-40');
        dragIdx.current = null;
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        const sourceIdx = dragIdx.current;
        if (sourceIdx === null || sourceIdx === targetIdx) return;
        const next = [...marathonGames];
        const [removed] = next.splice(sourceIdx, 1);
        next.splice(targetIdx, 0, removed);
        onUpdate(next);
        dragIdx.current = null;
    }, [marathonGames, onUpdate]);

    const handleAdd = useCallback((length: number) => {
        if (marathonGames.length < MAX_GAMES) {
            onUpdate([...marathonGames, length]);
        }
    }, [marathonGames, onUpdate]);

    const handleRemove = useCallback((idx: number) => {
        const next = [...marathonGames];
        next.splice(idx, 1);
        onUpdate(next);
    }, [marathonGames, onUpdate]);

    return (
        <div className="p-5 rounded-2xl border border-yellow-500/25 bg-yellow-500/5 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-black uppercase text-white">Marathon Mode Setup</p>
                    <p className="text-xs text-white/80">Configure your marathon format</p>
                </div>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                    <button
                        type="button"
                        onClick={() => onTypeChange('standard')}
                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${marathonType === 'standard' ? 'bg-yellow-500 text-black font-extrabold' : 'text-white/80'}`}
                    >
                        Standard (3-7L)
                    </button>
                    <button
                        type="button"
                        onClick={() => onTypeChange('custom')}
                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${marathonType === 'custom' ? 'bg-yellow-500 text-black font-extrabold' : 'text-white/80'}`}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {marathonType === 'custom' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-white">
                            Game Sequence ({marathonGames.length}/{MAX_GAMES} games)
                        </label>

                        {marathonGames.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-black/20">
                                <p className="text-xs text-white/80 font-bold uppercase">No games added yet. Click lengths below to build your sequence.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5 p-3 bg-black/40 rounded-xl border border-white/10 max-h-[240px] overflow-y-auto">
                                {marathonGames.map((l, idx) => {
                                    const c = lengthColor(l);
                                    return (
                                        <div
                                            key={idx}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            className={`flex items-center justify-between px-3 py-2.5 border border-l-4 border-white/10 rounded-xl text-xs font-black text-white transition-colors cursor-grab active:cursor-grabbing select-none ${c.border} ${c.bg}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <GripVertical size={14} className="text-white/30 shrink-0" />
                                                <span className="text-white/60 text-[10px] font-bold tabular-nums">#{idx + 1}</span>
                                                <span className={c.text}>{l}L</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(idx)}
                                                className="p-1 text-white/80 hover:text-red-500 transition-colors cursor-pointer"
                                                title="Remove game"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-white">
                            Add Game Length
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                            {ADDABLE_LENGTHS.map((l) => (
                                <button
                                    key={l}
                                    type="button"
                                    disabled={marathonGames.length >= MAX_GAMES}
                                    onClick={() => handleAdd(l)}
                                    className={`flex-1 min-w-[40px] py-2.5 rounded-xl border border-white/10 bg-black/20 hover:bg-white/5 text-xs font-black transition-all disabled:opacity-30 disabled:hover:bg-black/20 cursor-pointer ${lengthColor(l).text}`}
                                >
                                    +{l}L
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-widest text-white">Force Game Order</span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        className="text-white/80 hover:text-white p-0.5 rounded-full transition-colors focus:outline-none"
                        title="Forces players to play games sequentially. Game #N must be completed/failed to unlock Game #(N+1)."
                    >
                        <span className="text-[11px] text-white/50 font-medium normal-case">?</span>
                    </button>
                </div>
                <input
                    type="checkbox"
                    checked={marathonForceOrder}
                    onChange={(e) => onForceOrderChange(e.target.checked)}
                    className="w-5 h-5 accent-yellow-500 cursor-pointer"
                />
            </div>
        </div>
    );
});
