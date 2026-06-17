/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useMemo } from 'react';
import type { MarathonGame } from './types';

interface MarathonGameListProps {
    sortMode: "number" | "length" | "day";
    setSortMode: (mode: "number" | "length" | "day") => void;
    marathonGames: MarathonGame[];
    marathonGameIndex: number;
    setMarathonGameIndex: (idx: number) => void;
    setShowTargetWord: (show: boolean) => void;
    entry: any;
    myParticipation: any;
    profile: any;
    isCreator: boolean;
    marathonGamesRef: React.RefObject<HTMLDivElement | null>;
    isBotMarathon?: boolean;
}

const getLengthColor = (length: number) => {
    switch (length) {
        case 3: return "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20";
        case 4: return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20";
        case 5: return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20";
        case 6: return "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20";
        case 7: return "bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20";
        case 8: return "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20";
        case 9: return "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20";
        case 10: return "bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20";
        default: return "bg-white/10 text-white border border-white/10 hover:bg-white/20";
    }
};

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
    isBotMarathon: isBotMarathonProp,
}: MarathonGameListProps) => {
    const isBotMarathon = isBotMarathonProp || entry?.challenge?.is_bot_marathon || entry?.is_bot_marathon;

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

    const gamesByDay = useMemo(() => {
        if (!isBotMarathon) return {};
        const numDays = 7;
        const baseSequenceLength = Math.max(1, Math.floor(marathonGames.length / numDays));

        return marathonGames.reduce((acc, game, idx) => {
            const dayNum = Math.floor(idx / baseSequenceLength) + 1;
            if (!acc[dayNum]) acc[dayNum] = [];
            acc[dayNum].push({ ...game, originalIndex: idx });
            return acc;
        }, {} as Record<number, any[]>);
    }, [marathonGames, isBotMarathon]);

    const renderGameButton = (idx: number, label: string, wordLength: number) => {
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

        const colorClasses = getLengthColor(wordLength);

        return (
            <button
                key={idx}
                disabled={false}
                onClick={() => {
                    setMarathonGameIndex(idx);
                    setShowTargetWord(false);
                }}
                className={`w-full px-1.5 py-2 h-auto min-h-[32px] rounded-lg text-[10px] font-black transition-all flex items-center justify-center text-center border ${marathonGameIndex === idx ? "bg-correct text-black border-correct scale-105 shadow-md shadow-correct/20 z-10" : canSelect ? colorClasses : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 cursor-pointer"}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div ref={marathonGamesRef} className="mb-4 border-b border-white/5 py-4 w-full scroll-mt-20">
            <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    Marathon Games
                </span>
                <div className="flex bg-white/5 rounded-lg p-0.5">
                    {isBotMarathon && (
                        <button
                            onClick={() => setSortMode("day")}
                            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${sortMode === "day" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                        >
                            By Day
                        </button>
                    )}
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

            {sortMode === "day" && isBotMarathon ? (
                <div className="flex flex-col gap-3 w-full">
                    {Object.entries(gamesByDay).map(([day, games]) => (
                        <div key={day} className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                            <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2 px-1 tracking-widest">Day {day}</h4>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                                {games.map((game: any) => renderGameButton(game.originalIndex, `#${game.originalIndex + 1} (${gameLabels[game.originalIndex]})`, game.wordLength))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : sortMode === "number" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 w-full">
                    {marathonGames.map((game, idx) => renderGameButton(idx, `#${idx + 1} (${gameLabels[idx]})`, game.wordLength))}
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
                                    {games.map((game: any) => renderGameButton(game.originalIndex, gameLabels[game.originalIndex], game.wordLength))}
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
});
