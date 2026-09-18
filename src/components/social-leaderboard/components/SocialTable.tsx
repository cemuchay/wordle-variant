import { ProtectedAvatar } from "@/components/chat/ProtectedAvatar";
import { ReigningBadge } from "@/components/common/ReigningBadge";
import type { AppUser, LeaderboardEntry } from "@/types/game";
import formatUsername from "@/utils/formatUsername";
import { Eye, User } from "lucide-react";
import type { RankMovementInfo } from "@/utils/leaderboardSnapshotUtils";

interface SocialTableProps {
    rankedLeaderboard: {
        entry: LeaderboardEntry;
        rank: number;
    }[];
    canViewGuess: boolean;
    handleOpenPreview: (entry: LeaderboardEntry, openAnalysis?: boolean) => void;
    user: AppUser | null;
    timeframe: string;
    currentDate: string | null;
    movementMap?: Map<string, RankMovementInfo>;
}

const SocialTable = ({
    rankedLeaderboard,
    canViewGuess,
    handleOpenPreview,
    user,
    timeframe,
    currentDate,
    movementMap,
}: SocialTableProps) => {
    // Partition playing vs completed when in today's view
    const isToday = timeframe === "today";
    const playingEntries = isToday ? rankedLeaderboard.filter(({ entry }) => entry.status === "playing") : [];
    const completedEntries = isToday ? rankedLeaderboard.filter(({ entry }) => entry.status !== "playing") : rankedLeaderboard;

    const renderRow = ({ entry, rank: currentRank }: { entry: LeaderboardEntry; rank: number }, i: number) => {
        const isFirst = currentRank === 1;
        const isPlaying = entry.status === "playing";
        const key = entry.user_id || entry.username;
        const movement = movementMap?.get(key);

        return (
            <div
                key={`${entry.username}-${i}`}
                onClick={() => {
                    if (canViewGuess) {
                        handleOpenPreview(entry, false);
                    } else if (entry.user_id) {
                        window.dispatchEvent(
                            new CustomEvent("open-user-profile", {
                                detail: { userId: entry.user_id },
                            })
                        );
                    }
                }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer hover:border-gray-600 ${isPlaying
                        ? "bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-400/60"
                        : isFirst
                            ? "bg-yellow-500/10 border-yellow-500/40"
                            : entry.user_id === user?.id
                                ? "bg-emerald-500/10 border-emerald-500/40"
                                : "bg-gray-800/40 border-gray-800"
                    }`}
            >
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-6 shrink-0">
                        <span
                            className={`text-xs font-black font-mono text-center ${isPlaying
                                    ? "text-cyan-400"
                                    : isFirst
                                        ? "text-yellow-400"
                                        : "text-gray-400"
                                }`}
                        >
                            {currentRank}
                        </span>
                        {/* Rank Movement Indicator */}
                        {movement?.isNew ? (
                            <span className="text-[8px] font-black uppercase text-cyan-400 leading-none mt-0.5">
                                NEW
                            </span>
                        ) : movement?.delta !== undefined && movement.delta !== 0 ? (
                            <span
                                className={`text-[8px] font-black font-mono leading-none mt-0.5 flex items-center ${movement.delta > 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                title={`Previous rank: #${movement.prevRank}`}
                            >
                                {movement.delta > 0 ? `▲+${movement.delta}` : `▼${movement.delta}`}
                            </span>
                        ) : null}
                    </div>
                    <div className="relative shrink-0">
                        {isFirst && !isPlaying && (
                            <span
                                className="absolute -top-4 left-1/2 -translate-x-1/2 text-base z-10 select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter brightness-110 font-bold"
                                role="img"
                                aria-label="crown"
                            >
                                👑
                            </span>
                        )}
                        <ProtectedAvatar
                            userId={entry.user_id}
                            src={entry.avatar_url}
                            username={entry.username}
                            className={`w-7 h-7 rounded-full border ${isPlaying
                                    ? "border-cyan-400 ring-1 ring-cyan-400/40"
                                    : isFirst
                                        ? "border-yellow-400 ring-1 ring-yellow-400/40"
                                        : "border-gray-700"
                                }`}
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                                className={`text-xs font-bold truncate max-w-30 block ${isPlaying
                                        ? "text-cyan-200"
                                        : isFirst
                                            ? "text-yellow-200"
                                            : "text-white"
                                    }`}
                            >
                                {formatUsername(entry.username)}
                            </span>
                            {isPlaying && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    • Live
                                </span>
                            )}
                            {entry.user_id && <ReigningBadge userId={entry.user_id} type="weekly" />}
                            {entry.user_id && <ReigningBadge userId={entry.user_id} type="bot_marathon" />}
                            {entry.user_id && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.dispatchEvent(
                                            new CustomEvent("open-user-profile", {
                                                detail: { userId: entry.user_id },
                                            })
                                        );
                                    }}
                                    className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                                    title="View Profile"
                                >
                                    <User size={11} />
                                </button>
                            )}
                        </div>
                        {canViewGuess && (
                            <span className="text-[9px] text-gray-400 font-semibold flex items-center gap-1">
                                <Eye size={10} /> Tap to preview
                            </span>
                        )}
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-xs font-black text-white font-mono">
                        {entry.total_score} pts
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase">
                        {timeframe === "weekly"
                            ? `${entry.days_active || entry.attempts || 0}/7 games`
                            : timeframe === "monthly"
                                ? `${entry.days_active || entry.attempts || 0}/${getDaysInMonth(currentDate)} games`
                                : entry.status === "lost"
                                    ? "X/6"
                                    : entry.status === "playing"
                                        ? `${entry.attempts || 0}/6 live`
                                        : `${entry.attempts || "?"}/6`}
                    </div>
                </div>
            </div>
        );
    };

    const renderPlayingChip = ({ entry, rank: currentRank }: { entry: LeaderboardEntry; rank: number }, i: number) => {
        const key = entry.user_id || entry.username;
        const movement = movementMap?.get(key);

        return (
            <div
                key={`playing-${entry.username}-${i}`}
                onClick={() => {
                    if (canViewGuess) {
                        handleOpenPreview(entry, false);
                    } else if (entry.user_id) {
                        window.dispatchEvent(
                            new CustomEvent("open-user-profile", {
                                detail: { userId: entry.user_id },
                            })
                        );
                    }
                }}
                className="flex items-center justify-between p-2.5 rounded-xl border bg-cyan-950/30 border-cyan-500/40 hover:border-cyan-400/70 transition-all cursor-pointer w-[200px] sm:w-[220px] shrink-0 snap-start shadow-xs"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex flex-col items-center justify-center w-4 shrink-0">
                        <span className="text-xs font-black font-mono text-cyan-400">
                            {currentRank}
                        </span>
                        {movement?.isNew ? (
                            <span className="text-[7px] font-black uppercase text-cyan-400 leading-none">
                                NEW
                            </span>
                        ) : movement?.delta !== undefined && movement.delta !== 0 ? (
                            <span
                                className={`text-[7px] font-black font-mono leading-none ${
                                    movement.delta > 0 ? "text-emerald-400" : "text-rose-400"
                                }`}
                            >
                                {movement.delta > 0 ? `▲+${movement.delta}` : `▼${movement.delta}`}
                            </span>
                        ) : null}
                    </div>
                    <ProtectedAvatar
                        userId={entry.user_id}
                        src={entry.avatar_url}
                        username={entry.username}
                        className="w-6 h-6 rounded-full border border-cyan-400 shrink-0"
                    />
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-cyan-200 truncate block max-w-[90px] sm:max-w-[105px]">
                            {formatUsername(entry.username)}
                        </span>
                        <span className="text-[8px] font-black uppercase text-cyan-300">
                            • {entry.attempts || 0}/6 live
                        </span>
                    </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                    <div className="text-xs font-black text-white font-mono">
                        {entry.total_score}
                    </div>
                    <div className="text-[8px] text-cyan-400 font-bold uppercase">
                        pts
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-3 pb-6">
            {/* If there are playing entries today, show them in a single horizontal swipeable row */}
            {playingEntries.length > 0 && (
                <div className="space-y-1.5 pb-1">
                    <div className="flex items-center justify-between px-1 py-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 font-black">
                                In Progress ({playingEntries.length})
                            </span>
                        </div>
                        <span className="text-[9px] text-cyan-400/80 font-bold tracking-wider uppercase flex items-center gap-1">
                            Swipe ➔
                        </span>
                    </div>
                    <div className="flex overflow-x-auto gap-2 pb-1.5 pt-0.5 scrollbar-hide snap-x">
                        {playingEntries.map(renderPlayingChip)}
                    </div>
                    <div className="h-px bg-cyan-500/20 my-1" />
                </div>
            )}

            {/* Completed entries section */}
            {completedEntries.length > 0 && (
                <div className="space-y-1.5">
                    {playingEntries.length > 0 && (
                        <div className="flex items-center gap-2 px-1 pt-1 pb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                Completed Standings ({completedEntries.length})
                            </span>
                            <div className="h-px bg-gray-800 flex-1 ml-2" />
                        </div>
                    )}
                    {completedEntries.map(renderRow)}
                </div>
            )}
        </div>
    );
};

export default SocialTable

function getDaysInMonth(dateStr?: string | null): number {
    if (!dateStr) return 30;
    try {
        const [year, month] = dateStr.split("-").map(Number);
        if (year && month) {
            return new Date(year, month, 0).getDate();
        }
    } catch { /* no empty block */ }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}