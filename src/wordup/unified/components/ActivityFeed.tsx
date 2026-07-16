import { Radio, Shield } from "lucide-react";

const ActivityFeed = ({ isLoadingHistory, buildActivityFeed, CATEGORIES, CATEGORY_STYLE_MAP, onPlayAsyncTurn, onSelectHistoryMatch }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-white/80">
                <Radio size={14} className="text-[#E85151] animate-pulse" />
                <span className="text-[12px] font-black uppercase tracking-wider">Latest Activity</span>
            </div>
            <div className="space-y-2 bg-white/5 border border-white/10 p-3 rounded-2xl shadow-inner min-h-[80px]">
                {isLoadingHistory ? (
                    <div className="space-y-2 animate-pulse">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="flex items-center justify-between bg-black/10 border border-white/5 rounded-xl p-2.5 h-[56px]">
                                <div className="flex items-center gap-2.5 w-full">
                                    <div className="w-6 h-6 rounded-md bg-white/10 shrink-0"></div>
                                    <div className="space-y-1.5 flex-1">
                                        <div className="h-2.5 bg-white/10 rounded-sm w-1/3"></div>
                                        <div className="h-1.5 bg-white/10 rounded-sm w-1/6"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : buildActivityFeed().length > 0 ? (
                    buildActivityFeed().map((item) => {
                        const itemCatObj = CATEGORIES.find(c => c.id === item.category);
                        const emoji = CATEGORY_STYLE_MAP[item.category]?.emoji || "💡";

                        if (item.type === "async_challenge") {
                            return (
                                <div key={item.id} className="flex items-center justify-between bg-black/35 border border-white/10 rounded-xl p-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{emoji}</span>
                                        <div className="min-w-0">
                                            <p className="text-[12px] text-white font-bold leading-tight truncate">
                                                Challenge vs <span className="text-[#E85151]">{item.oppName}</span>
                                            </p>
                                            <p className="text-[12px] text-white/70 font-extrabold uppercase mt-0.5">
                                                {itemCatObj?.name || "Trivia"}
                                            </p>
                                        </div>
                                    </div>
                                    {item.myTurn ? (
                                        <button
                                            onClick={() => onPlayAsyncTurn(item.data)}
                                            className="bg-[#E85151] hover:bg-[#d44343] text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition-all active:scale-95"
                                        >
                                            Play Turn
                                        </button>
                                    ) : (
                                        <span className="text-[7.5px] font-black uppercase text-yellow-505 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-md shrink-0">
                                            Waiting
                                        </span>
                                    )}
                                </div>
                            );
                        }

                        if (item.type === "completed_match") {
                            let outcome = "DRAW";
                            let outcomeStyle = "text-white border-white/10 bg-white/5";
                            if (item.won) {
                                outcome = "WIN";
                                outcomeStyle = "text-[#E85151] border-[#E85151]/20 bg-[#E85151]/10";
                            } else if (!item.draw) {
                                outcome = "LOSS";
                                outcomeStyle = "text-red-400 border-red-500/10 bg-red-500/10";
                            }

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onSelectHistoryMatch?.(item.data)}
                                    className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl p-2.5 hover:bg-white/5 cursor-pointer transition-all"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg">{emoji}</span>
                                        <div className="min-w-0">
                                            <p className="text-[12px] text-white font-bold leading-tight truncate">
                                                vs {item.oppName}
                                            </p>
                                            <p className="text-[12px] text-white/70 font-extrabold uppercase mt-0.5">
                                                {itemCatObj?.name || "Trivia"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[12px] font-black text-white">{item.myScore} - {item.oppScore}</span>
                                        <span className={`text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md border ${outcomeStyle}`}>
                                            {outcome}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        if (item.type === "rank_milestone") {
                            return (
                                <div key={item.id} className="flex items-center gap-2.5 bg-[#E85151]/10 border border-[#E85151]/25 rounded-xl p-2.5">
                                    <Shield size={16} className="text-[#E85151]" />
                                    <div>
                                        <p className="text-[12px] text-white font-bold leading-tight">
                                            Rank Update: <span className="text-[#E85151]">{item.rankName}</span>
                                        </p>
                                        <p className="text-[12px] text-white/70 font-extrabold uppercase mt-0.5">
                                            Currently holding {item.rating} rating ELO
                                        </p>
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })
                ) : (
                    <div className="text-center py-6 text-white/60 text-[10px] font-black uppercase tracking-wider">
                        No recent matches or activities.
                    </div>
                )}
            </div>
        </div>
    )
}

export default ActivityFeed