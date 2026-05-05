import React, { useEffect, useState } from 'react';
import { generateShareText } from '../lib/share';
import { getServerDate } from '../lib/time';
import type { GameStats, GuessResult } from '../types/game';
import { ShareButton } from './ShareButton'; // Adjust path

interface Props {
    isOpen: boolean;
    onClose: () => void;
    guesses: GuessResult[][];
    date: string;
    config: { maxAttempts: number };
    usedHint: boolean;
    gameMessage: string;
    stats: GameStats
}

export const GameOverModal: React.FC<Props> = ({
    isOpen, onClose, guesses, date, config, usedHint, gameMessage, stats
}) => {
    const won = guesses[guesses.length - 1].every(r => r.status === 'correct');

    const [countdown, setCountdown] = useState("");

    useEffect(() => {
        // This works in both browser (returns a number) and Node (returns a Timeout object)
        let timer: ReturnType<typeof setInterval> | undefined;

        const initCountdown = async () => {
            const { raw } = await getServerDate();
            const serverOffset = raw.getTime() - Date.now();

            timer = setInterval(() => {
                const now = new Date(Date.now() + serverOffset);
                const nigeriaTimeStr = now.toLocaleString("en-US", { timeZone: "Africa/Lagos" });
                const tomorrow = new Date(nigeriaTimeStr);
                tomorrow.setHours(24, 0, 0, 0);

                const diff = tomorrow.getTime() - new Date(nigeriaTimeStr).getTime();

                if (diff <= 0) {
                    setCountdown("0:00:00");
                    return;
                }

                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff / (1000 * 60)) % 60);
                const s = Math.floor((diff / 1000) % 60);

                setCountdown(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }, 1000);
        };

        initCountdown();
        return () => {
            if (timer) clearInterval(timer);
        };
    }, []);

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center">

                <h2 className="text-2xl font-serif font-bold text-white mb-6 mt-2">{gameMessage}</h2>

                {/* Statistics Section */}
                <div className="mb-8">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Statistics</h3>
                    <div className="flex justify-between px-4">
                        <StatBox value={stats.gamesPlayed} label="Played" />
                        <StatBox value={stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0} label="Win %" />
                        <StatBox value={stats.currentStreak} label="Streak" />
                        <StatBox value={stats.maxStreak} label="Max" />
                    </div>
                </div>

                {/* Guess Distribution */}
                <div className="mb-8 text-left">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 text-center">Guess Distribution</h3>
                    <div className="space-y-1.5">
                        {Object.entries(stats.guesses).map(([num, count]) => {
                            const isCurrentDist = won && guesses.length === parseInt(num);
                            const maxVal = Math.max(...Object.values(stats.guesses) as number[], 1);
                            return (
                                <div key={num} className="flex items-center gap-2 text-xs">
                                    <span className="w-2 font-medium text-gray-300">{num}</span>
                                    <div className="flex-1 h-5 bg-gray-800/50">
                                        <div
                                            style={{ width: `${Math.max((count as number / maxVal) * 100, 8)}%` }}
                                            className={`h-full flex items-center justify-end px-2 font-bold text-white transition-all duration-1000 ${isCurrentDist ? 'bg-correct' : 'bg-gray-600'}`}
                                        >
                                            {count as number}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <hr className="border-gray-800 mb-6" />

                {/* Footer: Countdown & Share */}
                <div className="flex items-center justify-between gap-6">
                    <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Next Game</p>
                        <p className="text-2xl font-mono font-medium text-white tracking-tighter">{countdown}</p>
                    </div>
                    <div className="flex-1">
                        <ShareButton
                            text={generateShareText({
                                date,
                                guesses,
                                maxAttempts: config.maxAttempts,
                                won: guesses[guesses.length - 1].every(r => r.status === 'correct'),
                                usedHint, gameMessage
                            }
                            )}
                        />
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 text-gray-500 text-xs hover:text-white uppercase tracking-widest transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

const StatBox = ({ value, label }: { value: number | string, label: string }) => (
    <div className="flex flex-col items-center">
        <span className="text-3xl font-light text-white">{value}</span>
        <span className="text-[9px] uppercase tracking-tighter text-gray-500">{label}</span>
    </div>
);