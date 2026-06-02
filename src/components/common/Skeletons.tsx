import React from 'react';

// ChatRoom Suspense loading fallback
export const ChatSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-[92vh] w-full max-w-lg mx-auto bg-[#0b141a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl p-6 space-y-6">
            {/* Header skeleton */}
            <div className="flex justify-between items-center border-b border-white/5 pb-4 animate-pulse">
                <div className="h-6 w-24 bg-white/10 rounded-lg" />
                <div className="w-8 h-8 rounded-full bg-white/10" />
            </div>

            {/* Content items list */}
            <div className="flex-1 space-y-4 overflow-y-auto">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 bg-white/5 border border-transparent rounded-2xl flex items-center gap-3 animate-pulse">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
                        {/* Text details */}
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 bg-white/10 rounded" />
                            <div className="h-3 w-3/4 bg-white/5 rounded" />
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

// Leaderboard list loading fallback
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
