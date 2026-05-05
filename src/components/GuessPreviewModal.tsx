/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { LeaderboardEntry } from "../types/game";

const GuessPreviewModal: React.FC<{ entry: LeaderboardEntry; onClose: () => void }> = ({ entry, onClose }) => {
    const [detailedGuesses, setDetailedGuesses] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGuesses = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('scores')
                .select('guesses')
                .eq('user_id', entry.user_id) // From our new view
                .eq('game_date', new Date().toISOString().split('T')[0]) // Ensure today's date
                .single();

            if (data) setDetailedGuesses(data.guesses);
            if (error) console.log(error)
            setLoading(false);
        };

        fetchGuesses();
    }, [entry.user_id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl max-w-xs w-full" onClick={e => e.stopPropagation()}>
                {loading ? (
                    <div className="flex justify-center py-8"><div className="animate-spin h-5 w-5 border-2 border-correct border-t-transparent rounded-full" /></div>
                ) : (
                    <>
                        <div className="grid gap-1 mb-4 justify-center">
                            {detailedGuesses?.map((row: any[], i) => (
                                <div key={i} className="flex gap-1">
                                    {row.map((cell, j) => (
                                        <div
                                            key={j}
                                            className={`w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-black uppercase ${cell.status === 'correct' ? 'bg-correct' :
                                                    cell.status === 'present' ? 'bg-present' : 'bg-gray-700'
                                                }`}
                                        >
                                            { cell.letter}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <button onClick={onClose} className="w-full py-2 bg-gray-800 rounded-lg text-xs font-bold uppercase">Close</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default GuessPreviewModal