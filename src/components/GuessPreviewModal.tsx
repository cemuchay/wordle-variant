/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { getDailyConfig } from "../lib/game-logic";
import { SCORING, MAX_ATTEMPTS } from "../constants/game";
import { Z_INDEX } from "../constants/ui";
import { CHALLENGE_CONFIG } from "../constants/challenge";

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
    myParticipation?: any;
    initialMarathonLength?: number;
    initialData?: {
        guesses: any[] | null;
        hints_used?: boolean;
        skill_score?: number;
        hint_record?: any | null;
        time_taken?: number | null;
    }
}> = ({ entry, onClose, targetWord, lengthOfWord, myParticipation, initialMarathonLength, initialData }) => {
    const isMarathon = lengthOfWord === 1;
    const [marathonLength, setMarathonLength] = useState<number>(initialMarathonLength || 3);

    const [gameData, setGameData] = useState<{
        guesses: any[] | null;
        hints_used: boolean;
        skill_score: number;
        hint_record: { letter: string; index: number; row?: number } | null;
        time_taken?: number | null;
    } | null>(null);

    const [loading, setLoading] = useState(!initialData || isMarathon);
    const { date } = useApp();

    useEffect(() => {
        if (isMarathon) {
            const isMe = entry.user_id === myParticipation?.user_id;
            const myProg = myParticipation?.marathon_progress?.find((p: any) => p.word_length === marathonLength);
            const myFinished = myProg?.status === 'completed' || myProg?.status === 'timed_out';

            const prog = entry.marathon_progress?.find((p: any) => p.word_length === marathonLength);

            if (prog && (isMe || myFinished)) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setGameData({
                    guesses: prog.guesses || [],
                    hints_used: prog.hints_used || false,
                    skill_score: prog.score || 0,
                    hint_record: prog.hint_record || null,
                    time_taken: prog.time_taken
                });
            } else {
                setGameData(null);
            }
            setLoading(false);
            return;
        }

        if (initialData) {
            setGameData({
                guesses: initialData.guesses,
                hints_used: initialData.hints_used || false,
                skill_score: initialData.skill_score || 0,
                hint_record: initialData.hint_record || null,
                time_taken: initialData.time_taken
            });
            setLoading(false);
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
    }, [date, entry.user_id, initialData, marathonLength, isMarathon, entry.marathon_progress, myParticipation?.user_id, myParticipation?.marathon_progress]);

    const getBreakdown = () => {
        if (!gameData?.guesses || gameData.guesses.length === 0) return { rows: [], base: 0, bonus: 0, hint: 0 };

        // 1. CONFIG: Define target word from authoritative sources (Source of Truth)
        let wordToUse = targetWord || getDailyConfig(true, date || undefined).word;

        if (isMarathon && targetWord) {
            try {
                const words = JSON.parse(targetWord);
                wordToUse = words[marathonLength] || "";
            } catch (e) {
                console.error("Failed to parse targetWord in marathon preview", e);
            }
        }

        const targetChars = wordToUse.toUpperCase().split("");
        const wordLength = isMarathon ? marathonLength : (lengthOfWord || targetChars.length);

        const rows: number[] = [];
        const knownBlacks = new Set<string>(); // For repeat -20 penalties
        let totalBonus = 0;

        // 2. PROCESS ROWS: Calculate deductions for rows 1 to (N-1), award points on Row N
        gameData.guesses.forEach((row: any[], rowIndex: number) => {
            let rowBonus = 0;
            const isLastRow = rowIndex === (gameData.guesses?.length ? gameData.guesses.length - 1 : null)

            const won = row.every(cell => cell.status === 'correct');

            if (isLastRow && won) {
                // THE PAYOFF: Award the full discovery points
                const discoveryPoints = wordLength * SCORING.POINTS_PER_LETTER;
                rowBonus += discoveryPoints;
            } else {
                // THE DEDUCTIONS: Evaluate every letter entity individually
                row.forEach((cell) => {
                    const letter = cell.letter.toUpperCase();

                    // CASE: YELLOW (Present but wrong spot)
                    if (cell.status === 'present') {
                        rowBonus -= SCORING.YELLOW_PENALTY;
                    }

                    // CASE: BLACK (Absent)
                    else if (cell.status === 'absent') {
                        if (targetChars.includes(letter)) {
                            rowBonus -= SCORING.ABSENT_PENALTY;
                        } else if (knownBlacks.has(letter)) {
                            rowBonus -= SCORING.REPEATED_ABSENT_PENALTY;
                        } else {
                            rowBonus -= SCORING.ABSENT_PENALTY;
                            knownBlacks.add(letter);
                        }
                    }

                    // CASE: GREEN (Correct)
                    else if (cell.status === 'correct') {
                        // console.log(`[STASIS] Index ${cellIndex} (${letter}): Green status. No deduction (0).`);
                    }
                });
            }

            rows.push(rowBonus);
            totalBonus += rowBonus;
        });

        let localHint = 0

        // DEDUCT HINT POINTS
        if (gameData.hints_used && gameData.hint_record?.row !== undefined) {
            const rowBonus = rows[gameData.hint_record.row - 1];
            if (rowBonus !== undefined) {
                totalBonus -= SCORING.HINT_PENALTY;
                localHint -= SCORING.HINT_PENALTY;
            }
        }

        // 3. FINAL AGGREGATION
        const currentAttempts = gameData.guesses.length;
        const won = gameData.guesses[currentAttempts - 1]?.every((c: any) => c.status === 'correct');
        const baseScore = won ? Math.floor(((MAX_ATTEMPTS - currentAttempts + 1) / MAX_ATTEMPTS) * SCORING.BASE_SCORE_MAX) : 0;

        return { rows, base: baseScore, bonus: totalBonus, hint: localHint };
    };

    const breakdown = getBreakdown();

    const username = entry.username || entry.profiles?.username || 'Player';

    return (

        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.GUESS_PREVIEW }} onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 w-full max-w-xs rounded-2xl p-6 shadow-2xl relative flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
                    <X size={20} />
                </button>

                <p className="text-sm uppercase tracking-tighter mb-2 text-center text-gray-100 font-bold">{username}'s Guesses</p>

                {isMarathon && (
                    <div className="flex justify-center gap-1 mb-4 border-b border-white/5 pb-4">
                        {CHALLENGE_CONFIG.MARATHON_LENGTHS.map(l => {
                            const prog = entry.marathon_progress?.find((p: any) => p.word_length === l);
                            const isPlayed = !!prog;
                            return (
                                <button
                                    key={l}
                                    disabled={!isPlayed}
                                    onClick={() => setMarathonLength(l)}
                                    className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${marathonLength === l ? 'bg-correct text-black scale-110 shadow-lg shadow-correct/20' : isPlayed ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/5 text-gray-700 opacity-50 cursor-not-allowed'}`}
                                >
                                    {l}
                                </button>
                            );
                        })}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-correct" size={24} /></div>
                ) : !gameData || !gameData.guesses || gameData.guesses.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-xs text-gray-500 italic">No guesses recorded for this length.</p>
                    </div>
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
                                                    className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black uppercase shadow-inner ${cell.status === 'correct' ? 'bg-correct text-white' :
                                                        cell.status === 'present' ? 'bg-present text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
                                                        }`}
                                                >
                                                    {cell.letter}
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`text-[9px] font-mono font-bold w-8 ${rowScore >= 0 ? 'text-correct' : 'text-red-400'}`}>
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

                            {gameData?.time_taken !== null && gameData?.time_taken !== undefined && (
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
                                <span>{isMarathon ? `Length ${marathonLength} Score:` : 'Total Index:'}</span>
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
