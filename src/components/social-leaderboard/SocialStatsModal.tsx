/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Activity,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Loader2,
  RotateCw,
  Trophy,
  User,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TIMEOUT } from "../../constants/game";
import { TOAST_DURATION } from "../../constants/ui";
import { useApp } from "../../context/AppContext";
import { supabase } from "../../lib/supabaseClient";
import type { AppUser, LeaderboardEntry } from "../../types/game";
import formatUsername from "../../utils/formatUsername";
import { safeLocalStorage, safeSessionStorage } from "../../utils/storage";
import { ProtectedAvatar } from "../chat/ProtectedAvatar";
import { ReigningBadge } from "../common/ReigningBadge";
import { LeaderboardSkeleton } from "../common/Skeletons";
import GuessPreviewModal from "../guess-preview";
import { StreakCounter } from "../StreakCounter";
import { LeaderboardFeedCard } from "./LeaderboardFeedCard";
import { SocialActivityCard } from "./SocialActivityCard";
import { fetchSocialActivities, type SocialActivityItem } from "../../services/socialActivityService";

type Timeframe = "today" | "yesterday" | "weekly" | "monthly";
type ViewMode = "table" | "feed" | "newsfeed";

interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guesses: Record<string, number>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
  stats: GameStats;
  isGameOver: boolean;
  initialTab?: "stats" | "leaderboard";
  inline?: boolean;
}

export const SocialStatsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  stats,
  isGameOver,
  initialTab = "leaderboard",
  inline = false,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [activeTab, setActiveTab] = useState<"stats" | "leaderboard">(initialTab);

  if (isOpen !== prevIsOpen || initialTab !== prevInitialTab) {
    setPrevIsOpen(isOpen);
    setPrevInitialTab(initialTab);
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }

  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = safeLocalStorage.getItem("wordle_social_lb_view_mode") as ViewMode | null;
    // Default to 'feed'
    return saved === "table" || saved === "feed" ? saved : "feed";
  });
  const [hideGridWords, setHideGridWords] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(null);
  const [initialOpenAnalysis, setInitialOpenAnalysis] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const { date: currentDate, triggerToast } = useApp();
  const fetchIdRef = useRef(0);

  const targetLbDate = useMemo(() => {
    if (timeframe === "yesterday" && currentDate) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    }
    return currentDate || "";
  }, [timeframe, currentDate]);

  const [newsfeedActivities, setNewsfeedActivities] = useState<SocialActivityItem[]>([]);
  const [newsfeedLoading, setNewsfeedLoading] = useState(false);

  // Fetch Newsfeed Activities for current timeframe
  const fetchNewsfeed = useCallback(async (isBackground = false) => {
    if (!isOpen || activeTab !== "leaderboard" || !targetLbDate) return;

    if (!isBackground) {
      setNewsfeedLoading(true);
    }

    try {
      const activities = await fetchSocialActivities(targetLbDate, "daily_game", 60);
      setNewsfeedActivities(activities);
    } catch (err) {
      console.error("Failed to load newsfeed activities:", err);
    } finally {
      if (!isBackground) {
        setNewsfeedLoading(false);
      }
    }
  }, [isOpen, activeTab, targetLbDate]);

  useEffect(() => {
    if (viewMode === "newsfeed") {
      fetchNewsfeed(false);
    }
  }, [viewMode, fetchNewsfeed]);

  // Realtime subscription for newsfeed activities
  useEffect(() => {
    if (!isOpen || viewMode !== "newsfeed" || !targetLbDate) return;

    const channelName = `realtime_social_activities_${targetLbDate}_${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "social_activities",
          filter: `game_date=eq.${targetLbDate}`,
        },
        async (payload) => {
          if (payload.new) {
            // Re-fetch to get user profile attached
            await fetchNewsfeed(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, viewMode, targetLbDate, fetchNewsfeed]);

  // Save viewMode preference
  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    safeLocalStorage.setItem("wordle_social_lb_view_mode", mode);
  };

  // Fetch Leaderboard Data
  const fetchLeaderboard = useCallback(
    async (ignoreCache = false, isBackground = false) => {
      if (!isOpen || activeTab !== "leaderboard" || !currentDate) return;

      const cacheKey = `wordle_global_leaderboard_${timeframe}_${currentDate}`;

      if (!ignoreCache) {
        try {
          const cached = safeSessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            setLeaderboard(parsed);
            setLeaderboardError(null);
            return;
          }
        } catch (e) {
          console.error("Failed to parse cached leaderboard", e);
        }
      }

      const currentFetchId = ++fetchIdRef.current;
      if (!isBackground) {
        setLoading(true);
      }
      setLeaderboardError(null);

      try {
        const { data: edgeRes, error } = await supabase.functions.invoke("redis-cache", {
          body: { action: "get-leaderboard", timeframe, date: currentDate, ignoreCache },
        });

        if (error) throw error;

        if (currentFetchId !== fetchIdRef.current) {
          return;
        }

        if (edgeRes && edgeRes.data) {
          setLeaderboard(edgeRes.data);
          setLeaderboardError(null);
          try {
            safeSessionStorage.setItem(cacheKey, JSON.stringify(edgeRes.data));
          } catch (e) {
            console.error("Failed to cache leaderboard data", e);
          }
        }
      } catch (err: any) {
        if (currentFetchId !== fetchIdRef.current) return;
        console.error("Social leaderboard fetch error:", err.message || err);
        if (!isBackground || leaderboard.length === 0) {
          setLeaderboardError(err.message || "Failed to retrieve leaderboard data.");
        }
      } finally {
        if (currentFetchId === fetchIdRef.current && !isBackground) {
          setLoading(false);
        }
      }
    },
    [isOpen, activeTab, timeframe, currentDate, leaderboard.length]
  );

  useEffect(() => {
    fetchLeaderboard(false);
  }, [fetchLeaderboard]);

  const handleManualRefresh = useCallback(async () => {
    if (loading) return;
    try {
      safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
      safeSessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${currentDate}`);
      safeSessionStorage.removeItem(`wordle_global_leaderboard_weekly_${currentDate}`);
      safeSessionStorage.removeItem(`wordle_global_leaderboard_monthly_${currentDate}`);
    } catch (e) {
      console.error("Failed to clear sessionStorage on manual refresh:", e);
    }
    await fetchLeaderboard(true);
    triggerToast("Leaderboard updated with latest games!", TOAST_DURATION.DEFAULT);
  }, [fetchLeaderboard, loading, triggerToast, currentDate]);

  // Track timeframe in a ref to avoid subscription churn
  const timeframeRef = useRef(timeframe);
  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  // Realtime score subscriptions
  useEffect(() => {
    if (!isOpen || !currentDate) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScoreUpdate = async (status: string | null, username?: string) => {
      const isGameOverUpdate = status === "won" || status === "lost";
      const currentTF = timeframeRef.current;

      try {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
        if (isGameOverUpdate) {
          safeSessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${currentDate}`);
          safeSessionStorage.removeItem(`wordle_global_leaderboard_weekly_${currentDate}`);
          safeSessionStorage.removeItem(`wordle_global_leaderboard_monthly_${currentDate}`);
        }
      } catch (e) {
        console.error("Failed to clear sessionStorage on score update:", e);
      }

      let shouldRefresh = false;
      if (currentTF === "today") {
        shouldRefresh = true;
      } else if (
        isGameOverUpdate &&
        (currentTF === "weekly" || currentTF === "monthly" || currentTF === "yesterday")
      ) {
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          await fetchLeaderboard(true, true);
          const toastMsg = username
            ? `New guess by @${formatUsername(username)}!`
            : isGameOverUpdate
              ? "A player just finished their game!"
              : "Leaderboard updated with latest live guesses!";
          triggerToast(toastMsg, TOAST_DURATION.SHORT);
        }, TIMEOUT.LEADERBOARD_REFRESH);
      }
    };

    // 1. Listen to broadcast sync channel used by usePersistence
    const broadcastChannelName = "global_scores_leaderboard_sync";
    const broadcastChannel = supabase
      .channel(broadcastChannelName)
      .on("broadcast", { event: "score_submitted" }, (payload: any) => {
        const payloadData = payload.payload || {};
        const status = payloadData.status || null;
        handleScoreUpdate(status, payloadData.username);
      })
      .subscribe();

    // 2. Listen to direct Postgres changes on the scores table for currentDate
    const pgChannelName = `social_scores_lb_sync_${currentDate}`;
    const pgChannel = supabase
      .channel(pgChannelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `game_date=eq.${currentDate}` },
        (payload: any) => {
          const status = payload.new ? payload.new.status : null;
          handleScoreUpdate(status);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(pgChannel);
    };
  }, [isOpen, currentDate, fetchLeaderboard, triggerToast]);

  // Global scores custom event (fired when local user makes guesses or finishes)
  useEffect(() => {
    if (!isOpen) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleGlobalUpdate = (e: Event) => {
      if (debounceTimer) clearTimeout(debounceTimer);

      const customEvent = e as CustomEvent;
      const isBackground = customEvent.detail?.isBackground ?? false;
      const isGameOverUpdate = customEvent.detail?.isGameOver ?? false;
      const currentTF = timeframeRef.current;

      try {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
        if (isGameOverUpdate) {
          safeSessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${currentDate}`);
          safeSessionStorage.removeItem(`wordle_global_leaderboard_weekly_${currentDate}`);
          safeSessionStorage.removeItem(`wordle_global_leaderboard_monthly_${currentDate}`);
        }
      } catch (err) {
        console.error("Failed to clear sessionStorage on global score update:", err);
      }

      let shouldRefresh = false;
      if (currentTF === "today") {
        shouldRefresh = true;
      } else if (
        isGameOverUpdate &&
        (currentTF === "weekly" || currentTF === "monthly" || currentTF === "yesterday")
      ) {
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        debounceTimer = setTimeout(async () => {
          await fetchLeaderboard(true, isBackground);
          triggerToast("Leaderboard updated with latest scores!", TOAST_DURATION.SHORT);
        }, TIMEOUT.LEADERBOARD_REFRESH);
      }
    };

    window.addEventListener("global-scores-updated", handleGlobalUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("global-scores-updated", handleGlobalUpdate);
    };
  }, [isOpen, currentDate, fetchLeaderboard, triggerToast]);

  const maxGuesses = useMemo(() => {
    return Math.max(...Object.values(stats.guesses), 1);
  }, [stats.guesses]);

  const canViewGuess = isGameOver || timeframe === "yesterday";

  // Standard Competition Ranking (1224 - ties share the same rank and skip the following numbers)
  const rankedLeaderboard = useMemo(() => {
    return leaderboard.map((entry, index, arr) => {
      if (index === 0) return { entry, rank: 1 };
      if (entry.total_score === arr[index - 1].total_score) {
        // Find first occurrence with this score to get the tied rank
        const tiedIndex = arr.findIndex((e) => e.total_score === entry.total_score);
        return { entry, rank: tiedIndex + 1 };
      }
      return { entry, rank: index + 1 };
    });
  }, [leaderboard]);

  // Map of userId -> competition rank for quick lookup in Newsfeed cards
  const userRankMap = useMemo(() => {
    const map = new Map<string, number>();
    rankedLeaderboard.forEach(({ entry, rank }) => {
      if (entry.user_id) {
        map.set(entry.user_id, rank);
      }
    });
    return map;
  }, [rankedLeaderboard]);

  const selectedEntry =
    selectedEntryIndex !== null && leaderboard[selectedEntryIndex]
      ? leaderboard[selectedEntryIndex]
      : null;

  const handleOpenPreview = (entry: LeaderboardEntry, openAnalysis = false) => {
    const idx = leaderboard.findIndex((e) => e.username === entry.username);
    setSelectedEntryIndex(idx >= 0 ? idx : 0);
    setInitialOpenAnalysis(openAnalysis);
  };

  const handleNavigatePlayerIndex = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < leaderboard.length) {
      setSelectedEntryIndex(newIndex);
    }
  };

  // Check if current timeframe supports Social Feed
  const supportsFeed = timeframe === "today" || timeframe === "yesterday";

  if (!isOpen) return null;

  return (
    <div
      className={`${inline
        ? "w-full h-full"
        : "fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
        }`}
      onClick={inline ? undefined : onClose}
    >
      <div
        className="flex flex-col h-full min-h-0 flex-1 w-full max-w-xl mx-auto bg-gray-900 overflow-hidden px-3 py-3 relative rounded-2xl border border-gray-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between mb-3 shrink-0 px-1 relative">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <h2 className="text-lg font-black uppercase tracking-tight text-gray-100">
              {activeTab === "leaderboard"
                ? supportsFeed && viewMode === "newsfeed"
                  ? "Live Activity Feed"
                  : supportsFeed && viewMode === "feed"
                    ? "Social Feed & Leaderboard"
                    : "Leaderboard"
                : "Your Stats"}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            {activeTab === "leaderboard" && (
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
                title="Refresh scores"
              >
                <RotateCw size={15} className={loading ? "animate-spin text-amber-400" : ""} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher: Stats vs Leaderboard */}
        <div className="flex bg-gray-800/80 p-1 rounded-xl mb-3 border border-gray-700/50 shrink-0">
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === "stats"
              ? "bg-gray-700 text-white shadow-sm"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <User size={12} /> Stats
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === "leaderboard"
              ? "bg-amber-400 text-black shadow-md font-black"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <Trophy size={12} /> Global Feed
          </button>
        </div>

        {/* Content Container */}
        <div className="overflow-y-auto flex-1 pr-0.5 scrollbar-thin">
          {activeTab === "stats" ? (
            /* User Stats Panel */
            loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 className="animate-spin text-amber-400" size={24} />
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                  Fetching stats...
                </span>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200 space-y-4 py-2">
                <div className="flex justify-around text-center bg-black/20 p-4 rounded-2xl border border-white/5">
                  <StatItem value={stats.gamesPlayed} label="Played" />
                  <StatItem
                    value={`${stats.gamesPlayed
                      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
                      : 0
                      }%`}
                    label="Win %"
                  />
                </div>

                <StreakCounter
                  size="big"
                  currentStreak={stats.currentStreak}
                  maxStreak={stats.maxStreak}
                />

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 text-gray-400">
                    Guess Distribution
                  </h3>
                  <div className="space-y-1.5">
                    {Object.entries(stats.guesses).map(([attempt, count]) => (
                      <div key={attempt} className="flex items-center gap-2 text-xs font-mono">
                        <span className="w-2.5 font-bold text-gray-400">{attempt}</span>
                        <div className="flex-1 bg-gray-800 rounded-sm overflow-hidden h-5">
                          <div
                            className={`${attempt === "X" ? "bg-rose-500" : "bg-emerald-500"
                              } h-full px-2 text-right flex items-center justify-end font-bold text-[10px] text-white transition-all duration-1000 min-w-[24px]`}
                            style={{ width: `${Math.max((count / maxGuesses) * 100, 10)}%` }}
                          >
                            {count}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isGameOver && user && (
                  <button
                    onClick={() => {
                      const userEntry: LeaderboardEntry = {
                        username:
                          user.user_metadata?.username ||
                          formatUsername(user.user_metadata?.full_name) ||
                          "You",
                        avatar_url: user.user_metadata?.avatar_url || "",
                        user_id: user.id,
                        total_score: 0,
                        days_active: 0,
                      };
                      handleOpenPreview(userEntry, false);
                    }}
                    className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer"
                  >
                    <Eye size={14} /> View Today's Game & Scrutiny
                  </button>
                )}
              </div>
            )
          ) : (
            /* Leaderboard & Feed Panel */
            <div className="animate-in fade-in duration-200">
              {/* Timeframe Toggles */}
              <div className="flex gap-1 mb-2.5">
                {(["today", "yesterday", "weekly", "monthly"] as Timeframe[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${timeframe === t
                      ? "bg-white text-black border-white shadow-sm"
                      : "border-gray-800 text-gray-400 hover:text-white bg-gray-800/40"
                      }`}
                  >
                    {t === "today" ? "🔥 Today" : t === "yesterday" ? "Yesterday" : t}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle: [ Table | Feed ] for Today & Yesterday */}
              {supportsFeed && (
                <div className="flex items-center justify-between mb-3 px-1.5 py-1 bg-black/30 border border-white/5 rounded-xl gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                      Display Style
                    </span>
                    {/* Hide / Blur Grid Words for Screenshot Privacy Toggle */}
                    {canViewGuess && (
                      <button
                        type="button"
                        onClick={() => setHideGridWords((prev) => !prev)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${hideGridWords
                          ? "bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-xs"
                          : "bg-white/5 text-gray-400 hover:text-white border-white/10 hover:bg-white/10"
                          }`}
                        title={
                          hideGridWords
                            ? "Grid words hidden (Privacy/Screenshot Mode ON) - Click to reveal"
                            : "Click to hide/blur grid words for screenshots"
                        }
                      >
                        {hideGridWords ? (
                          <>
                            <EyeOff size={11} className="text-amber-300" />
                            <span>Hidden</span>
                          </>
                        ) : (
                          <>
                            <Eye size={11} />
                            <span>Hide Words</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => handleSetViewMode("table")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "table"
                        ? "bg-gray-700 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                        }`}
                    >
                      <List size={12} /> Table
                    </button>


                    <button
                      onClick={() => handleSetViewMode("feed")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "feed"
                        ? "bg-amber-400 text-black shadow-sm"
                        : "text-gray-400 hover:text-white"
                        }`}
                    >
                      <LayoutGrid size={12} /> Social Feed
                    </button>

                    <button
                      onClick={() => handleSetViewMode("newsfeed")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "newsfeed"
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20 font-black"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      <Zap size={12} className={viewMode === "newsfeed" ? "text-yellow-300 fill-yellow-300" : ""} /> Newsfeed
                    </button>

                  </div>
                </div>
              )}

              {/* Newsfeed Mode Content */}
              {supportsFeed && viewMode === "newsfeed" ? (
                newsfeedLoading && newsfeedActivities.length === 0 ? (
                  <LeaderboardSkeleton />
                ) : newsfeedActivities.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Activity size={24} className="mx-auto text-gray-600 animate-pulse" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                      No live activities recorded yet for this date
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-6">
                    {newsfeedActivities.map((activity) => (
                      <SocialActivityCard
                        key={activity.id}
                        activity={activity}
                        userRank={userRankMap.get(activity.user_id)}
                        canViewGuesses={canViewGuess}
                        hideGridWords={hideGridWords}
                        onOpenPreview={handleOpenPreview}
                        onActivityDeleted={(id) =>
                          setNewsfeedActivities((prev) => prev.filter((a) => a.id !== id))
                        }
                      />
                    ))}
                  </div>
                )
              ) : leaderboardError && leaderboard.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-xs text-rose-400 font-bold">{leaderboardError}</p>
                  <button
                    onClick={() => fetchLeaderboard(true)}
                    className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : loading ? (
                <LeaderboardSkeleton />
              ) : leaderboard.length === 0 ? (
                <p className="text-center text-[10px] text-gray-500 uppercase py-16 tracking-widest font-black">
                  No scores submitted yet for this period
                </p>
              ) : supportsFeed && viewMode === "feed" ? (
                /* Social Feed Doom-Scroll Stream with Tied Rank Skipping */
                <div className="space-y-3 pb-6">
                  {rankedLeaderboard.map(({ entry, rank }, i) => (
                    <LeaderboardFeedCard
                      key={`${entry.username}-${i}`}
                      entry={entry}
                      rank={rank}
                      gameDate={targetLbDate}
                      isCurrentUser={entry.user_id === user?.id}
                      canViewGuesses={canViewGuess}
                      hideGridWords={hideGridWords}
                      onOpenPreview={handleOpenPreview}
                    />
                  ))}
                </div>
              ) : (
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
                                className={`text-xs font-bold truncate max-w-[120px] block ${isFirst ? "text-yellow-200" : "text-white"
                                  }`}
                              >
                                {formatUsername(entry.username)}
                              </span>
                              {entry.user_id && <ReigningBadge userId={entry.user_id} type="weekly" />}
                              {entry.user_id && <ReigningBadge userId={entry.user_id} type="bot_marathon" />}
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
                            {entry.status === "lost" ? "X/6" : `${entry.attempts || "?"}/6`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full Height Guess Preview Overlay with Continuous Playlist Browsing */}
        {selectedEntry && (
          <div className="absolute inset-0 z-30 bg-gray-900 flex flex-col h-full w-full min-h-0">
            <GuessPreviewModal
              entry={selectedEntry}
              onClose={() => setSelectedEntryIndex(null)}
              yesterday={timeframe === "yesterday"}
              entries={leaderboard}
              initialIndex={selectedEntryIndex ?? 0}
              onNavigateIndex={handleNavigatePlayerIndex}
              initialOpenAnalysis={initialOpenAnalysis}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const StatItem: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <div>
    <div className="text-2xl font-black text-white font-mono">{value}</div>
    <div className="text-[9px] uppercase text-gray-400 tracking-widest font-bold">{label}</div>
  </div>
);
