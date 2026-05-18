/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { getDailyConfig } from "../lib/game-logic";

const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

const GuessPreviewModal: React.FC<{
    entry: any; // More flexible for challenge participants
    onClose: () => void;
    targetWord?: string;
    lengthOfWord?: number;
    initialData?: {
        guesses: any[] | null;
        hints_used?: boolean;
        skill_score?: number;
        hint_record?: any | null;
        time_taken?: number | null;
    }
}> = ({ entry, onClose, targetWord, lengthOfWord, initialData }) => {
    const [gameData, setGameData] = useState<{
        guesses: any[] | null;
        hints_used: boolean;
        skill_score: number;
        hint_record: { letter: string; index: number; row?: number } | null;
        time_taken?: number | null;
    } | null>(initialData ? {
        guesses: initialData.guesses,
        hints_used: initialData.hints_used || false,
        skill_score: initialData.skill_score || 0,
        hint_record: initialData.hint_record || null,
        time_taken: initialData.time_taken
    } : null);
    const [loading, setLoading] = useState(!initialData);
    const { date } = useApp();

    useEffect(() => {
        if (initialData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setGameData({
                guesses: initialData.guesses,
                hints_used: initialData.hints_used || false,
                skill_score: initialData.skill_score || 0,
                hint_record: initialData.hint_record || null,
                time_taken: initialData.time_taken
            });
            return;
        }

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, entry.user_id, initialData?.guesses, initialData?.hints_used, initialData?.skill_score, initialData?.hint_record, initialData?.time_taken]);

    const getBreakdown = () => {
        if (!gameData?.guesses || gameData.guesses.length === 0) return { rows: [], base: 0, bonus: 0, hint: 0 };

        // 1. CONFIG: Define target word from authoritative sources (Source of Truth)
        const wordToUse = targetWord || getDailyConfig(true, date || undefined).word;
        const targetChars = wordToUse.toUpperCase().split("");
        const wordLength = lengthOfWord || targetChars.length;

        const rows: number[] = [];
        const knownBlacks = new Set<string>(); // For repeat -20 penalties
        let totalBonus = 0;

        // 2. PROCESS ROWS: Calculate deductions for rows 1 to (N-1), award points on Row N
        gameData.guesses.forEach((row: any[], rowIndex: number) => {
            let rowBonus = 0;
            const isLastRow = rowIndex === (gameData.guesses?.length ? gameData.guesses.length - 1 : null)
            // const rowWord = row.map(c => c.letter).join("").toUpperCase();

            const won = row.every(cell => cell.status === 'correct');

            // console.log(`\n>> PROCESSING ROW ${rowIndex + 1}: [${rowWord}]`);

            if (isLastRow && won) {
                // THE PAYOFF: Award the full discovery points
                const discoveryPoints = wordLength * 40;
                rowBonus += discoveryPoints;
                // console.log(`[REWARD] Final Row Reached. Awarding +${discoveryPoints} discovery points.`);
            } else {
                // THE DEDUCTIONS: Evaluate every letter entity individually
                row.forEach((cell,) => {
                    const letter = cell.letter.toUpperCase();

                    // CASE: YELLOW (Present but wrong spot)
                    if (cell.status === 'present') {
                        rowBonus -= 15;
                        // console.log(`[DEDUCTION] Index ${cellIndex} (${letter}): Yellow status. Retroactive penalty applied (-15).`);
                    }

                    // CASE: BLACK (Absent)
                    else if (cell.status === 'absent') {
                        if (targetChars.includes(letter)) {
                            // Quantity mistake or known letter in wrong spot
                            rowBonus -= 5;
                            // console.log(`[DEDUCTION] Index ${cellIndex} (${letter}): Known letter but absent instance. Minor penalty (-5).`);
                        } else if (knownBlacks.has(letter)) {
                            rowBonus -= 20;
                            // console.log(`[DEDUCTION] Index ${cellIndex} (${letter}): REPEAT Black. High-severity penalty (-20).`);
                        } else {
                            rowBonus -= 5;
                            knownBlacks.add(letter);
                            // console.log(`[DEDUCTION] Index ${cellIndex} (${letter}): NEW Black. Standard penalty (-5).`);
                        }
                    }

                    // CASE: GREEN (Correct)
                    else if (cell.status === 'correct') {
                        // console.log(`[STASIS] Index ${cellIndex} (${letter}): Green status. No deduction (0).`);
                    }
                });
            }

            // console.log(`ROW ${rowIndex + 1} RESULT: ${rowBonus}`);
            rows.push(rowBonus);
            totalBonus += rowBonus;
        });

        let localHint = 0

        // DEDUCT HINT POINTS
        if (gameData.hints_used && gameData.hint_record?.row !== undefined) {
            const rowBonus = rows[gameData.hint_record.row - 1];
            if (rowBonus !== undefined) {
                totalBonus -= 100;
                localHint -= 100;
            }
        }

        // 3. FINAL AGGREGATION
        const maxAttempts = 6;
        const attempts = entry.attempts === 'X' ? maxAttempts : Number(entry.attempts);
        const won = entry.status === 'won' || entry.status === 'completed';
        const baseScore = won ? Math.floor(((maxAttempts - attempts + 1) / maxAttempts) * 1000) : 0;

        // console.log(`\n--- FINAL SCORING SUMMARY ---`);
        // console.log(`Bonus Breakdown: ${JSON.stringify(rows)}`);
        // console.log(`Net Bonus: ${totalBonus}`);
        // console.log(`Base Efficiency Score: ${baseScore}`);

        return { rows, base: baseScore, bonus: totalBonus, hint: localHint };
    };

    const breakdown = getBreakdown();

    if (!gameData || !breakdown) return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-130 p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 w-full max-w-xs rounded-2xl p-6 shadow-2xl relative flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
                    <X size={20} />
                </button>

                <p className="text-sm uppercase tracking-tighter mb-4 pb-4 text-center text-gray-100 font-bold">{entry.username || entry.profiles?.username}'s Guesses</p>
                <div className="flex gap-2">
                    {Array(5).fill(null).map((_, i) => <div key={i} className="flex-1 bg-gray-800 rounded-lg aspect-square flex items-center justify-center" />)}
                </div>

                {loading && (
                    <div className="mt-6 text-center text-gray-400">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Fetching guess data...
                    </div>
                )}
            </div>
        </div>
    )

    return (

        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-130 p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 w-full max-w-xs rounded-2xl p-6 shadow-2xl relative flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
                    <X size={20} />
                </button>

                <p className="text-sm uppercase tracking-tighter mb-4 pb-4 text-center text-gray-100 font-bold">{entry.username || entry.profiles?.username}'s Guesses</p>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-correct" size={24} /></div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="grid gap-2 mb-6 justify-center">
                            {gameData?.guesses?.map((row: any[], i) => {
                                const rowScore = breakdown.rows[i];
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
                                <span className="text-gray-100">{breakdown.base}</span>
                            </div>
                            <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                                <span>Precision Bonus:</span>
                                <span className={breakdown.bonus >= 0 ? 'text-correct' : 'text-red-400'}>
                                    {breakdown.bonus > 0 ? `+${breakdown.bonus}` : breakdown.bonus}
                                </span>
                            </div>

                            {gameData?.time_taken && (
                                <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                                    <span>Time Taken:</span>
                                    <span className="text-gray-100">{formatTime(gameData.time_taken)}</span>
                                </div>
                            )}

                            {/* Hint Info */}
                            {gameData?.hints_used && (
                                <div className="pt-2 border-t border-gray-700/50">
                                    <div className="flex justify-between text-[9px] uppercase font-bold text-yellow-500 mb-1">
                                        <span>Hint Used:</span>
                                        <span>{breakdown.hint}</span>
                                    </div>
                                    {gameData.hint_record && (
                                        <div className="flex items-center gap-2 text-[8px] font-black uppercase text-gray-400 bg-yellow-500/10 p-1.5 rounded-lg border border-yellow-500/20">
                                            <div className="w-5 h-5 rounded bg-yellow-500 text-black flex items-center justify-center text-[10px]">
                                                {gameData.hint_record.letter}
                                            </div>
                                            <span>
                                                Revealed at Pos {gameData.hint_record.index + 1}
                                                {gameData.hint_record.row !== undefined && ` after row ${gameData.hint_record.row}`}
                                            </span>
                                        </div>
                                    )}
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
