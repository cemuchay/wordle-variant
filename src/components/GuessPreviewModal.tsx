/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { LeaderboardEntry } from "../types/game";
import { useApp } from "../context/AppContext";

const GuessPreviewModal: React.FC<{ entry: LeaderboardEntry; onClose: () => void; }> = ({ entry, onClose, }) => {
    const [gameData, setGameData] = useState<{
        guesses: any[] | null;
        hints_used: boolean;
        skill_score: number;
        hint_record: { letter: string; index: number; row?: number } | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const { date } = useApp();

    useEffect(() => {
        const fetchGuesses = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('scores')
                .select('guesses, hints_used, skill_score, hint_record')
                .eq('user_id', entry.user_id)
                .eq('game_date', date)
                .single();

            if (data) setGameData(data);
            if (error) console.log(error)
            setLoading(false);
        };

        fetchGuesses();
    }, [date, entry.user_id]);

    const calculateRowScore = (row: any[]) => {
        return row.reduce((acc, cell) => {
            if (cell.status === 'correct') return acc + 15;
            if (cell.status === 'present') return acc + 2;
            if (cell.status === 'absent') return acc - 10;
            return acc;
        }, 0);
    };

    const maxAttempts = 6;
    const attempts = entry.attempts === 'X' ? maxAttempts : Number(entry.attempts);
    const baseScore = entry.status === 'won' ? Math.floor(((maxAttempts - attempts + 1) / maxAttempts) * 1000) : 0;
    const totalRowBonuses = gameData?.guesses?.reduce((acc, row) => acc + calculateRowScore(row), 0) || 0;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-120 p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 w-full max-w-xs rounded-2xl p-6 shadow-2xl relative flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
                    <X size={20} />
                </button>

                <p className="text-sm uppercase tracking-tighter mb-4 pb-4 text-center text-gray-100 font-bold">{entry.username}'s Guesses</p>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-correct" size={24} /></div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid gap-2 mb-6 justify-center">
                            {gameData?.guesses?.map((row: any[], i) => {
                                const rowScore = calculateRowScore(row);
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            {row.map((cell, j) => (
                                                <div
                                                    key={j}
                                                    className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-black uppercase shadow-inner ${cell.status === 'correct' ? 'bg-correct text-white' :
                                                        cell.status === 'present' ? 'bg-present text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
                                                        }`}
                                                >
                                                    {cell.letter}
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`text-[10px] font-mono font-bold w-8 ${rowScore >= 0 ? 'text-correct' : 'text-red-400'}`}>
                                            {rowScore > 0 ? `+${rowScore}` : rowScore}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Breakdown Section */}
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 mb-4 space-y-2">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                                <span>Base Performance:</span>
                                <span className="text-gray-100">{baseScore}</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                                <span>Precision Bonus:</span>
                                <span className={totalRowBonuses >= 0 ? 'text-correct' : 'text-red-400'}>
                                    {totalRowBonuses > 0 ? `+${totalRowBonuses}` : totalRowBonuses}
                                </span>
                            </div>

                            {/* Hint Info */}
                            {gameData?.hint_record && (
                                <div className="pt-2 border-t border-gray-700/50">
                                    <div className="flex justify-between text-[9px] uppercase font-bold text-yellow-500 mb-1">
                                        <span>Hint Used:</span>
                                        <span>-100</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] font-black uppercase text-gray-400 bg-yellow-500/10 p-1.5 rounded-lg border border-yellow-500/20">
                                        <div className="w-5 h-5 rounded bg-yellow-500 text-black flex items-center justify-center text-[10px]">
                                            {gameData.hint_record.letter}
                                        </div>
                                        <span>
                                            Revealed at Pos {gameData.hint_record.index + 1}
                                            {gameData.hint_record.row !== undefined && ` after row ${gameData.hint_record.row}`}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 mt-1 border-t border-gray-700 flex justify-between text-[11px] uppercase font-black text-gray-100">
                                <span>Total Index:</span>
                                <span className="text-white bg-correct px-2 rounded-full">{gameData?.skill_score || 0}</span>
                            </div>
                        </div>

                        <button onClick={onClose} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuessPreviewModal

