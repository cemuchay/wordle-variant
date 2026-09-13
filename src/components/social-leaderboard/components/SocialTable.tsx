import { ProtectedAvatar } from "@/components/chat/ProtectedAvatar";
import { ReigningBadge } from "@/components/common/ReigningBadge";
import type { AppUser, LeaderboardEntry } from "@/types/game";
import formatUsername from "@/utils/formatUsername";
import { Eye, User } from "lucide-react";

const SocialTable = ({ rankedLeaderboard, canViewGuess, handleOpenPreview, user, timeframe, currentDate }: {
    rankedLeaderboard: {
        entry: LeaderboardEntry;
        rank: number;
    }[], canViewGuess: boolean, handleOpenPreview: (entry: LeaderboardEntry, openAnalysis?: boolean) => void, user: AppUser | null, timeframe: string, currentDate: string | null
}) => {
    return (
        /* Traditional Ranking Table with Tied Rank Skipping */
        <div className="space-y-1.5 pb-6">
            {rankedLeaderboard.map(({ entry, rank: currentRank }, i) => {
                const isFirst = currentRank === 1;

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
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer hover:border-gray-600 ${isFirst
                            ? "bg-yellow-500/10 border-yellow-500/40"
                            : entry.user_id === user?.id
                                ? "bg-emerald-500/10 border-emerald-500/40"
                                : "bg-gray-800/40 border-gray-800"
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span
                                className={`text-xs font-black font-mono w-5 text-center ${isFirst ? "text-yellow-400" : "text-gray-400"
                                    }`}
                            >
                                {currentRank}
                            </span>
                            <div className="relative shrink-0">
                                {isFirst && (
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
                                    className={`w-7 h-7 rounded-full border ${isFirst ? "border-yellow-400 ring-1 ring-yellow-400/40" : "border-gray-700"
                                        }`}
                                />
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={`text-xs font-bold truncate max-w-30 block ${isFirst ? "text-yellow-200" : "text-white"
                                            }`}
                                    >
                                        {formatUsername(entry.username)}
                                    </span>
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
                                            : `${entry.attempts || "?"}/6`}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    )
}

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