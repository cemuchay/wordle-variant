/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useMemo } from 'react';
import type { MarathonGame } from './types';

interface MarathonGameListProps {
    sortMode: "number" | "length";
    setSortMode: (mode: "number" | "length") => void;
    marathonGames: MarathonGame[];
    marathonGameIndex: number;
    setMarathonGameIndex: (idx: number) => void;
    setShowTargetWord: (show: boolean) => void;
    entry: any;
    myParticipation: any;
    profile: any;
    isCreator: boolean;
    marathonGamesRef: React.RefObject<HTMLDivElement | null>;
}

export const MarathonGameList = memo(({
    sortMode,
    setSortMode,
    marathonGames,
    marathonGameIndex,
    setMarathonGameIndex,
    setShowTargetWord,
    entry,
    myParticipation,
    profile,
    isCreator,
    marathonGamesRef,
}: MarathonGameListProps) => {
    // Calculate total occurrences of each length to decide if we need numbering (e.g., (1), (2))
    const lengthTotals = useMemo(() => {
        const counts: Record<number, number> = {};
        marathonGames.forEach(g => {
            counts[g.wordLength] = (counts[g.wordLength] || 0) + 1;
        });
        return counts;
    }, [marathonGames]);

    // Generate descriptive labels for each game based on its occurrence in the marathon
    const gameLabels = useMemo(() => {
        const currentCounts: Record<number, number> = {};
        return marathonGames.map(g => {
            const len = g.wordLength;
            currentCounts[len] = (currentCounts[len] || 0) + 1;
            const total = lengthTotals[len] || 0;
            return total > 1 ? `${len}L (${currentCounts[len]})` : `${len}L`;
        });
    }, [marathonGames, lengthTotals]);

    return (
        <div ref={marathonGamesRef} className="mb-4 border-b border-white/5 py-4 w-full scroll-mt-20">
            <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    Marathon Games
                </span>
                <div className="flex bg-white/5 rounded-lg p-0.5">
                    <button
                        onClick={() => setSortMode("number")}
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${sortMode === "number" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        # Order
                    </button>
                    <button
                        onClick={() => setSortMode("length")}
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${sortMode === "length" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        By Length
                    </button>
                </div>
            </div>

            {sortMode === "number" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 w-full">
                    {marathonGames.map((_, idx) => {
                        const prog = entry.marathon_progress?.find(
                            (p: any) => p.game_index === idx,
                        );
                        const targetPlayed = !!prog;

                        const myProg = myParticipation?.marathon_progress?.find(
                            (p: any) => p.game_index === idx,
                        );
                        const viewerFinished =
                            myProg?.status === "completed" ||
                            myProg?.status === "timed_out";
                        const isMe =
                            profile?.id === (entry.user_id || entry.profiles?.id);

                        const canSelect =
                            isMe || (targetPlayed && viewerFinished) || isCreator;

                        return (
                            <button
                                key={idx}
                                disabled={false}
                                onClick={() => {
                                    setMarathonGameIndex(idx);
                                    setShowTargetWord(false);
                                }}
                                className={`w-full px-1.5 py-2 h-auto min-h-[32px] rounded-lg text-[10px] font-black transition-all flex items-center justify-center text-center ${marathonGameIndex === idx ? "bg-correct text-black scale-105 shadow-md shadow-correct/20 z-10" : canSelect ? "bg-white/10 text-white hover:bg-white/20" : "bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer"}`}
                            >
                                #{idx + 1} ({gameLabels[idx]})
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col gap-3 w-full">
                    {Object.entries(
                        marathonGames.reduce((acc, game, idx) => {
                            const len = game.wordLength;
                            if (!acc[len]) acc[len] = [];
                            acc[len].push({ ...game, originalIndex: idx });
                            return acc;
                        }, {} as Record<number, any[]>)
                    )
                        .sort(([lenA], [lenB]) => Number(lenA) - Number(lenB))
                        .map(([len, games]) => (
                            <div key={len} className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2 px-1 tracking-widest">{len} Letters</h4>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                                    {games.map((game: any) => {
                                        const idx = game.originalIndex;
                                        const prog = entry.marathon_progress?.find(
                                            (p: any) => p.game_index === idx,
                                        );
                                        const targetPlayed = !!prog;

                                        const myProg = myParticipation?.marathon_progress?.find(
                                            (p: any) => p.game_index === idx,
                                        );
                                        const viewerFinished =
                                            myProg?.status === "completed" ||
                                            myProg?.status === "timed_out";
                                        const isMe =
                                            profile?.id === (entry.user_id || entry.profiles?.id);

                                        const canSelect =
                                            isMe || (targetPlayed && viewerFinished) || isCreator;

                                        return (
                                            <button
                                                key={idx}
                                                disabled={false}
                                                onClick={() => {
                                                    setMarathonGameIndex(idx);
                                                    setShowTargetWord(false);
                                                }}
                                                className={`w-full px-1.5 py-2 h-auto min-h-[32px] rounded-lg text-[10px] font-black transition-all flex items-center justify-center text-center ${marathonGameIndex === idx ? "bg-correct text-black scale-105 shadow-md shadow-correct/20 z-10" : canSelect ? "bg-white/10 text-white hover:bg-white/20" : "bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer"}`}
                                            >
                                                {gameLabels[idx]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
});
