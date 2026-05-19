/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CHALLENGE_CONFIG } from "../constants/challenge";
import { MAX_ATTEMPTS, SCORING } from "../constants/game";
import { Z_INDEX } from "../constants/ui";
import { useApp } from "../context/AppContext";
import { deobfuscateWord, getDailyConfig } from "../lib/game-logic";
import { supabase } from "../lib/supabaseClient";

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
    salt?: string;
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
}> = ({ entry, onClose, targetWord, salt, lengthOfWord, myParticipation, initialMarathonLength, initialData }) => {
    const isMarathon = lengthOfWord === 1;
    const [marathonLength, setMarathonLength] = useState<number>(initialMarathonLength || 3);
    const [showTargetWord, setShowTargetWord] = useState(false);

    const [gameData, setGameData] = useState<{
        guesses: any[] | null;
        hints_used: boolean;
        skill_score: number;
        hint_record: { letter: string; index: number; row?: number } | null;
        time_taken?: number | null;
    } | null>(null);

    const [loading, setLoading] = useState(!initialData || isMarathon);
    const { date, profile } = useApp();

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

    const getTargetWordToUse = () => {
        let wordToUse = targetWord || getDailyConfig(!!profile, date || undefined).word;

        if (isMarathon && targetWord) {
            try {
                const words = typeof targetWord === 'string' ? JSON.parse(targetWord) : targetWord;
                const obfuscatedWord = words[marathonLength] || "";
                wordToUse = salt ? deobfuscateWord(obfuscatedWord, salt) : obfuscatedWord;
            } catch (e) {
                console.error("Failed to parse targetWord in marathon preview", e);
            }
        } else if (targetWord && salt) {
            wordToUse = deobfuscateWord(targetWord, salt);
        }

        return wordToUse;
    };

    const targetWordToUse = getTargetWordToUse();

    const getBreakdown = () => {
        if (!gameData?.guesses || gameData.guesses.length === 0) return { rows: [], base: 0, bonus: 0, hint: 0 };

        // const wordToUse = targetWordToUse;
        // const targetChars = wordToUse.toUpperCase().split("");
        // const wordLength = isMarathon ? marathonLength : (lengthOfWord || targetChars.length);

        const rows: number[] = [];
        // const knownBlacks = new Set<string>(); // For repeat -20 penalties
        let totalBonus = 0;

        const wordsAwardedPoints: Array<{
            letter: string;
            index: number;
            status: string;
            awardRow: number,
            isChecked: boolean
        }> = []


        const rowPointDecisions: Array<{
            rowNumber: string;
            totalRowPoints: number;
            decisions: Array<{
                letter: string,
                status: string,
                pointDeduction: number
            }>;
        }> = [];

        // 2. PROCESS ROWS: Calculate deductions for rows 1 to (N-1), award points on Row N


        for (let rowIndex = 0; rowIndex < gameData.guesses.length; rowIndex++) {
            const row = gameData.guesses[rowIndex];

            // get index of last row 
            // const isLastRow = rowIndex === (gameData.guesses?.length ? gameData.guesses.length - 1 : null)

            /* first row **/
            if (rowIndex === 0) {
                let points = 0;
                const localDecisions: Array<{
                    letter: string,
                    status: string,
                    pointDeduction: number
                }> = [];

                row.forEach((cell: { letter: string; index: number; status: string; }) => {

                    // CASE: YELLOW (Present but wrong spot)
                    if (cell.status === 'present') {
                        points += SCORING.YELLOW_SCORE_FIRST_TRY;
                        localDecisions.push({
                            letter: cell.letter,
                            status: `${cell.status} +${SCORING.YELLOW_SCORE_FIRST_TRY} 1st try`,
                            pointDeduction: SCORING.YELLOW_SCORE_FIRST_TRY
                        })
                        wordsAwardedPoints.push({
                            letter: cell.letter,
                            index: cell.index,
                            status: cell.status,
                            awardRow: rowIndex,
                            isChecked: false
                        })
                    }

                    // CASE: BLACK (Absent)
                    else if (cell.status === 'absent') {
                        points -= SCORING.ABSENT_PENALTY;
                        localDecisions.push({
                            letter: cell.letter,
                            status: `${cell.status} -${SCORING.ABSENT_PENALTY}`,
                            pointDeduction: -SCORING.ABSENT_PENALTY
                        })
                        wordsAwardedPoints.push({
                            letter: cell.letter,
                            index: cell.index,
                            status: cell.status,
                            awardRow: rowIndex,
                            isChecked: false
                        })
                    }

                    // CASE: GREEN (Correct)
                    else if (cell.status === 'correct') {
                        points += SCORING.POINTS_PER_LETTER_FIRST_TRY;
                        localDecisions.push({
                            letter: cell.letter,
                            status: `${cell.status} +${SCORING.POINTS_PER_LETTER_FIRST_TRY} 1st try`,
                            pointDeduction: SCORING.POINTS_PER_LETTER_FIRST_TRY
                        })
                        wordsAwardedPoints.push({
                            letter: cell.letter,
                            index: cell.index,
                            status: cell.status,
                            awardRow: rowIndex,
                            isChecked: false
                        })
                    }

                });

                rowPointDecisions.push({
                    rowNumber: `Row ${rowIndex}`,
                    totalRowPoints: points,
                    decisions: localDecisions
                });



                rows.push(points);
                totalBonus += points;

            }

            /* for every other row besides last row **/
            // if (rowIndex !== gameData.guesses.length - 1) {
            else {
                /* from the overall awarded words, find those with awardRow less than current */

                const relevantAwardedWords = wordsAwardedPoints.filter((item) => item.awardRow < rowIndex);


                let points = 0;
                const localDecisions: Array<{
                    letter: string,
                    status: string,
                    pointDeduction: number
                }> = [];



                for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
                    const cell = row[cellIndex];
                    const isSecondGuess = rowIndex === 1

                    // CASE: YELLOW (Present but wrong spot)
                    if (cell.status === 'present') {
                        /* we will scan all wordsAwardedPoints with present status and return fist instance matching letter*/
                        const awardedOldYellow = relevantAwardedWords.find((item) => item.status === 'present' && !item.isChecked);

                        /* letter not present or isChecked */
                        const freshYellow = !awardedOldYellow ? true : false;

                        if (awardedOldYellow) {
                            awardedOldYellow.isChecked = true;
                            localDecisions.push({
                                letter: cell.letter,
                                status: `${cell.status} [no deduction or addition as points have already been given]`,
                                pointDeduction: 0
                            })
                        }

                        /* award fresh points for a new yellow discovery*/
                        if (freshYellow) {
                            points += isSecondGuess ? SCORING.YELLOW_SCORE_SECOND_TRY : SCORING.YELLOW_SCORE;
                            localDecisions.push({
                                letter: cell.letter,
                                status: `${cell.status} +${isSecondGuess ? SCORING.YELLOW_SCORE_SECOND_TRY : SCORING.YELLOW_SCORE} ${isSecondGuess ? '2nd try' : ''} `,
                                pointDeduction: isSecondGuess ? SCORING.YELLOW_SCORE_SECOND_TRY : SCORING.YELLOW_SCORE
                            })
                        }


                        wordsAwardedPoints.push({
                            letter: cell.letter,
                            index: cell.index,
                            status: cell.status,
                            awardRow: rowIndex,
                            isChecked: false
                        })
                    }

                    // CASE: BLACK (Absent)
                    else if (cell.status === 'absent') {
                        // we will check if cell letter is an old absent
                        // relevantAwardedWords has all absents up to row - 1

                        const oldAbsent = relevantAwardedWords.find((item) => item.letter === cell.letter && item.status === 'absent')

                        if (oldAbsent) {
                            oldAbsent.isChecked = true;
                            localDecisions.push({
                                letter: cell.letter,
                                status: `${cell.status} [penalty for subsequent absent use at index ${oldAbsent.index}]`,
                                pointDeduction: -SCORING.REPEATED_ABSENT_PENALTY
                            })

                            points -= SCORING.REPEATED_ABSENT_PENALTY
                        }

                        /* award fresh points for a new absent discovery*/
                        if (!oldAbsent) {
                            points -= SCORING.ABSENT_PENALTY;
                            localDecisions.push({
                                letter: cell.letter,
                                status: `${cell.status} -${SCORING.ABSENT_PENALTY}`,
                                pointDeduction: -SCORING.ABSENT_PENALTY
                            })
                        }

                        wordsAwardedPoints.push({
                            letter: cell.letter,
                            index: cell.index,
                            status: cell.status,
                            awardRow: rowIndex,
                            isChecked: false
                        })
                    }

                    // CASE: GREEN (Correct)
                    else if (cell.status === 'correct') {
                        const oldGreen = wordsAwardedPoints.find((item) => item.status === 'correct' && item.letter === cell.letter);
                        const oldYellow = wordsAwardedPoints.find((item) => item.status === 'present' && item.letter === cell.letter);

                        const oldPresent = oldGreen || oldYellow;

                        if (oldPresent) {
                            oldPresent.isChecked = true;
                            localDecisions.push({
                                letter: cell.letter,
                                status: `${cell.status} [points already awarded]`,
                                pointDeduction: 0
                            })
                        }

                        if (!oldPresent) {


                            // award fresh points
                            points += isSecondGuess ? SCORING.POINTS_PER_LETTER_SECOND_TRY : SCORING.POINTS_PER_LETTER;
                            localDecisions.push({
                                letter: cell.letter,
                                status: `${cell.status} +${isSecondGuess ? SCORING.POINTS_PER_LETTER_SECOND_TRY : SCORING.POINTS_PER_LETTER} ${isSecondGuess ? '2nd try' : ''}`,
                                pointDeduction: isSecondGuess ? SCORING.POINTS_PER_LETTER_SECOND_TRY : SCORING.POINTS_PER_LETTER
                            })
                        }
                        wordsAwardedPoints.push({
                            letter: cell.letter,
                            index: cell.index,
                            status: cell.status,
                            awardRow: rowIndex,
                            isChecked: false
                        })
                    }
                }

                rowPointDecisions.push({
                    rowNumber: `Row ${rowIndex}`,
                    totalRowPoints: points,
                    decisions: localDecisions
                });


                rows.push(points);
                totalBonus += points;

            }
        }

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

        return { rows, base: baseScore, bonus: totalBonus, hint: localHint, decisions: rowPointDecisions };
    };

    const breakdown = getBreakdown();

    const username = entry.username || entry.profiles?.username || 'Player';

    return (

        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.GUESS_PREVIEW }} onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative flex flex-col overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
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
                                    onClick={() => {
                                        setMarathonLength(l);
                                        setShowTargetWord(false);
                                    }}
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
                        {/* Target Word Section */}
                        <div className="mb-6 mt-3 flex flex-col items-center">
                            {showTargetWord ? (
                                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                    <span className="text-[8px] uppercase font-black text-gray-500 mb-1">Target Word</span>
                                    <div className="flex gap-1">
                                        {targetWordToUse.toUpperCase().split('').map((letter, i) => (
                                            <div key={i} className="w-7 h-7 rounded-lg bg-correct/10 border border-correct/20 flex items-center justify-center text-[10px] font-black text-correct">
                                                {letter}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowTargetWord(true)}
                                    className="group flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                                >
                                    <Eye size={12} className="text-gray-500 group-hover:text-correct transition-colors" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">
                                        Reveal Word
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Breakdown Section */}
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 mb-4 space-y-2">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                                <span>Base Performance:</span>
                                <span className="text-gray-100">{breakdown.base}</span>
                            </div>
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

                            <div className="pt-2 mt-1 border-t border-gray-700 flex justify-between text-[11px] uppercase font-black text-gray-100">
                                <span>{isMarathon ? `Length ${marathonLength} Score:` : 'Total Index:'}</span>
                                <span className="text-white bg-correct px-2 rounded-full">{gameData?.skill_score || 0}</span>
                            </div>
                        </div>

                        <div className="grid gap-4 mb-6 justify-center">
                            {gameData?.guesses?.map((row: any[], i) => {
                                const rowScore = breakdown.rows[i];
                                const rowDecisions = breakdown.decisions[i]?.decisions;
                                return (
                                    <div key={i} className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                                        <div className="flex items-center gap-3 justify-between">
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
                                            <div className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${rowScore >= 0 ? 'bg-correct/20 text-correct' : 'bg-red-500/20 text-red-400'}`}>
                                                {rowScore > 0 ? `+${rowScore}` : rowScore}
                                            </div>
                                        </div>

                                        {rowDecisions && rowDecisions.length > 0 && (
                                            <div className="grid grid-cols-1 gap-1 pt-2 border-t border-white/5">
                                                {rowDecisions.map((dec: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-[8px] font-bold uppercase tracking-tighter">
                                                        <span className="text-gray-500">
                                                            Letter <span className="text-gray-300">{dec.letter}</span>: {dec.status}
                                                        </span>
                                                        {dec.pointDeduction !== 0 && (
                                                            <span className={dec.pointDeduction > 0 ? 'text-correct' : 'text-red-400'}>
                                                                {dec.pointDeduction > 0 ? `+${dec.pointDeduction}` : dec.pointDeduction}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
