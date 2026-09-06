import { useState, useEffect } from "react";
import { Trophy, ChevronRight, Loader2, } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { supabase } from "../../lib/supabaseClient";
import type { LeaderboardEntry } from "../../types/game";
import formatUsername from "../../utils/formatUsername";
import { ProtectedAvatar } from "../chat/ProtectedAvatar";

interface MiniLeaderboardSnapshotProps {
  onOpenLeaderboard: () => void;
}

export const MiniLeaderboardSnapshot: React.FC<MiniLeaderboardSnapshotProps> = ({
  onOpenLeaderboard,
}) => {
  const { date: currentDate, profile } = useApp();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);

  const fetchTopScores = useCallback(async (ignoreCache = false) => {
    if (!currentDate) return;
    setLoading(true);
    try {
      const { data: edgeRes, error } = await supabase.functions.invoke("redis-cache", {
        body: { action: "get-leaderboard", timeframe: "today", date: currentDate, ignoreCache },
      });

      if (!error && edgeRes?.data) {
        const list: LeaderboardEntry[] = edgeRes.data;
        setEntries(list.slice(0, 3));

        if (profile?.id) {
          const index = list.findIndex((e) => e.user_id === profile.id);
          if (index !== -1) {
            setUserRank(index + 1);
          }
        }
      }
    } catch {
      // Silent fallback if leaderboard edge function is unreachable
    } finally {
      setLoading(false);
    }
  }, [currentDate, profile?.id]);

  useEffect(() => {
    fetchTopScores(false);
  }, [fetchTopScores]);

  // Listen to game completion & global score updates for real-time leaderboard refresh
  useEffect(() => {
    const handleScoresUpdated = () => {
      fetchTopScores(true);
    };

    window.addEventListener("global-scores-updated", handleScoresUpdated);
    return () => {
      window.removeEventListener("global-scores-updated", handleScoresUpdated);
    };
  }, [fetchTopScores]);

  return (
    <div className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md space-y-3 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-amber-500/15 rounded-lg border border-amber-500/30 text-amber-400">
            <Trophy size={14} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
            Today's Leaderboard
          </span>
        </div>

        {userRank && (
          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Your Rank: #{userRank}
          </span>
        )}
      </div>

      {/* Top 3 List */}
      {loading ? (
        <div className="flex items-center justify-center py-3 text-xs text-gray-500 gap-1.5">
          <Loader2 size={13} className="animate-spin text-amber-400" />
          <span>Fetching ranks...</span>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">
          Be the first on today's leaderboard!
        </p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, idx) => {
            const isSelf = profile?.id === entry.user_id;
            const rankMedal =
              idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

            return (
              <div
                key={entry.user_id || idx}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all ${isSelf
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-black/20 border-white/5"
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold w-4 text-center shrink-0">{rankMedal}</span>
                  <ProtectedAvatar
                    src={entry.avatar_url}

                    className="w-5 h-5 rounded-full"
                  />
                  <span className={`text-xs font-bold truncate ${isSelf ? "text-amber-300" : "text-white"}`}>
                    {formatUsername(entry.username)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-black text-white">{entry.total_score} pts</span>
                  <span className="text-[9px] text-gray-400">({entry.attempts} tries)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Full Leaderboard CTA */}
      <button
        onClick={onOpenLeaderboard}
        className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 active:scale-98 rounded-xl border border-white/10 text-[11px] font-black uppercase tracking-wider text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
      >
        <span>View Full Leaderboard</span>
        <ChevronRight size={13} />
      </button>
    </div>
  );
};
