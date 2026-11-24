import React from 'react';

// ChatRoom Suspense loading fallback — matches exact Screenshot 2 CONVERSATIONS structure
export const ChatSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-full w-full max-w-lg mx-auto bg-[#090d16] text-white overflow-hidden">
            {/* CONVERSATIONS Header */}
            <div className="flex justify-between items-center border-b border-white/10 px-4 py-3.5 shrink-0">
                <span className="text-xs font-black uppercase tracking-widest text-white">
                    Conversations
                </span>
                <div className="w-6 h-6 rounded-full bg-white/5" />
            </div>

            {/* Search & Action Buttons Bar */}
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 shrink-0">
                <div className="flex-1 h-10 bg-white/5 border border-white/10 rounded-2xl px-3.5 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-white/20" />
                    <span className="text-xs text-gray-500">Search conversations...</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 shrink-0" />
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 shrink-0" />
            </div>

            {/* Conversations List */}
            <div className="flex-1 space-y-1.5 px-3 py-2 overflow-y-auto">
                {/* Deterministic # GENERAL Row */}
                <div className="p-3 rounded-2xl flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/80 text-black font-black text-lg flex items-center justify-center shrink-0">
                        #
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="text-xs font-black uppercase tracking-wider text-indigo-400">
                            General
                        </div>
                        <div className="h-3 w-2/3 bg-white/10 rounded animate-pulse" />
                    </div>
                </div>

                {[1, 2].map((i) => (
                    <div key={i} className="p-3 rounded-2xl flex items-center gap-3.5 animate-pulse">
                        <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-28 bg-white/10 rounded" />
                            <div className="h-3 w-40 bg-white/5 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Profile details loading fallback
export const ProfileSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Stats grid placeholder */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/5 rounded-2xl p-3 border border-white/5 h-16" />
                ))}
            </div>

            {/* Distribution/Details placeholder */}
            <div className="space-y-3">
                <div className="h-4 w-28 bg-white/10 rounded" />
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-3 w-3 bg-white/10 rounded" />
                            <div className="flex-1 bg-white/5 h-6 rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Leaderboard table loading fallback
export const LeaderboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-800 bg-gray-800/40 h-14">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-white/10 rounded" />
                        <div className="w-7 h-7 rounded-full bg-white/10" />
                        <div className="space-y-1">
                            <div className="h-3 w-16 bg-white/10 rounded" />
                            <div className="h-2 w-8 bg-white/5 rounded" />
                        </div>
                    </div>
                    <div className="w-12 h-4 bg-white/10 rounded" />
                </div>
            ))}
        </div>
    );
};

// Leaderboard Social Feed card skeleton — matches exact Screenshot 3 LeaderboardFeedCard geometry
export const LeaderboardFeedSkeleton: React.FC = () => {
    return (
        <div className="space-y-3.5">
            {[1, 2].map((rank) => (
                <div
                    key={rank}
                    className={`rounded-2xl border p-4 space-y-4 animate-pulse ${
                        rank === 1
                            ? 'border-amber-500/30 bg-slate-900/70'
                            : 'border-white/10 bg-slate-900/40'
                    }`}
                >
                    {/* Header: Rank + Avatar + Name/Score */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-amber-400/60 w-6">
                                #{rank}
                            </span>
                            <div className="w-11 h-11 rounded-full bg-white/10 border border-white/15 shrink-0" />
                            <div className="space-y-1.5">
                                <div className="h-3.5 w-24 bg-white/15 rounded" />
                                <div className="h-3 w-20 bg-amber-500/20 rounded" />
                            </div>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-white/5" />
                    </div>

                    {/* Mini Tile Grid Placeholder */}
                    <div className="flex justify-center py-1">
                        <div className="grid grid-cols-6 gap-1 p-2 rounded-xl bg-black/40 border border-white/5">
                            {Array.from({ length: 18 }).map((_, idx) => (
                                <div key={idx} className="w-5 h-5 rounded bg-white/10" />
                            ))}
                        </div>
                    </div>

                    {/* Emoji Reaction Pills Row */}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((pill) => (
                                <div
                                    key={pill}
                                    className="h-8 w-10 rounded-xl bg-white/5 border border-white/10"
                                />
                            ))}
                        </div>
                        <div className="h-5 w-8 rounded bg-white/5" />
                    </div>

                    {/* Roast Quote Bar */}
                    <div className="h-9 w-full rounded-xl bg-amber-500/5 border border-amber-500/20" />

                    {/* Action Buttons Row: VIEW GAME | ANALYZE GAME */}
                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                        <div className="h-10 rounded-xl bg-white/5 border border-white/10" />
                        <div className="h-10 rounded-xl bg-amber-500/10 border border-amber-500/30" />
                    </div>
                </div>
            ))}
        </div>
    );
};
