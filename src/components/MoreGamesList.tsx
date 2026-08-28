
interface MoreGamesListProps {
    setMoreGameMode: React.Dispatch<React.SetStateAction<"wordup" | "select" | "wordgrid">>;
    handleNavigation: (item: "wordup" | "play" | "challenges" | "leaderboard" | "chat" | "more") => void;
    wordupUnreadCount?: number;
    wordgridUnreadCount?: number;
}

const MoreGamesList = ({
    setMoreGameMode,
    handleNavigation,
    wordupUnreadCount = 0,
    wordgridUnreadCount = 0
}: MoreGamesListProps) => {
    return (<div className="flex flex-col p-4 bg-slate-900/80 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 select-none">
        <div className="space-y-1">
            <span className="text-4xl">🎮</span>
            <h2 className="text-lg font-black uppercase tracking-wider text-white">More Games</h2>
            <p className="text-[12px] text-white font-bold uppercase tracking-wider">Choose a challenge below</p>
        </div>

        <div className="space-y-4">
            {/* WordUp game card */}
            <button
                onClick={() => setMoreGameMode("wordup")}
                className="w-full flex items-center gap-4 p-4 bg-linear-to-br from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10 border border-rose-500/20 rounded-2xl cursor-pointer text-left transition-all active:scale-98 group relative"
            >
                <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-2xl group-hover:scale-105 transition-transform">
                    ⚔️
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase text-rose-300 tracking-wide">WordUp</p>
                        {wordupUnreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-[10px] font-black text-white animate-pulse">
                                {wordupUnreadCount} turn{wordupUnreadCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] text-white font-medium leading-normal mt-0.5">Rapid multiplayer definition matching game. Climb the rankings and defeat players in real time!</p>
                </div>
            </button>

            {/* WordGrid game card */}
            <button
                onClick={() => setMoreGameMode("wordgrid")}
                className="w-full flex items-center gap-4 p-4 bg-linear-to-br from-indigo-500/10 to-indigo-600/5 hover:from-indigo-500/20 hover:to-indigo-600/10 border border-indigo-500/20 rounded-2xl cursor-pointer text-left transition-all active:scale-98 group relative"
            >
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-2xl group-hover:scale-105 transition-transform">
                    🔠
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase text-indigo-300 tracking-wide">WordGrid</p>
                        {wordgridUnreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-black text-white animate-pulse">
                                {wordgridUnreadCount} turn{wordgridUnreadCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] text-white font-medium leading-normal mt-0.5">Asynchronous board game. Place words, use multipliers, and score bonuses.</p>
                </div>
            </button>
        </div>

        <button
            onClick={() => handleNavigation('play')}
            className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-wider text-white hover:text-white transition-all cursor-pointer"
        >
            Back to Classic Variant
        </button>
    </div>)
}

export default MoreGamesList