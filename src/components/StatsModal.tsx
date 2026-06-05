/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye, Loader2, Trophy, User, X, RotateCw } from 'lucide-react';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { MAX_ATTEMPTS } from '../constants/game';
import { Z_INDEX } from '../constants/ui';
import { supabase } from '../lib/supabaseClient';
import type { AppUser, LeaderboardEntry } from '../types/game';
import GuessPreviewModal from './GuessPreviewModal';
import { useApp } from '../context/AppContext';
import { safeSessionStorage } from '../utils/storage';
import { LeaderboardSkeleton } from './common/Skeletons';

// type Timeframe = 'today' | 'weekly' | 'monthly' | 'all';
type Timeframe = 'today' | 'yesterday' | 'weekly' | 'monthly'


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
  initialTab?: 'stats' | 'leaderboard';
  inline?: boolean;
}

// --- Component ---

export const StatsModal: React.FC<Props> = ({ isOpen, onClose, user, stats, isGameOver, initialTab = 'leaderboard', inline = false }) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [activeTab, setActiveTab] = useState<'stats' | 'leaderboard'>(initialTab);

  if (isOpen !== prevIsOpen || initialTab !== prevInitialTab) {
    setPrevIsOpen(isOpen);
    setPrevInitialTab(initialTab);
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }

  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const { date: currentDate, triggerToast } = useApp();

  const fetchIdRef = useRef(0);

  // Fetch Leaderboard Data
  const fetchLeaderboard = useCallback(async (ignoreCache = false, isBackground = false) => {
    if (!isOpen || activeTab !== 'leaderboard' || !currentDate) return;

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
        console.error('Failed to parse cached leaderboard', e);
      }
    }

    const currentFetchId = ++fetchIdRef.current;
    if (!isBackground) {
      setLoading(true);
    }
    setLeaderboardError(null);

    try {
      const { data: edgeRes, error } = await supabase.functions.invoke('redis-cache', {
        body: { action: 'get-leaderboard', timeframe, date: currentDate, ignoreCache }
      });

      if (error) throw error;

      if (currentFetchId !== fetchIdRef.current) {
        console.log('[StatsModal] Stale fetch response ignored.');
        return;
      }

      if (edgeRes && edgeRes.data) {
        setLeaderboard(edgeRes.data);
        setLeaderboardError(null);
        try {
          safeSessionStorage.setItem(cacheKey, JSON.stringify(edgeRes.data));
        } catch (e) {
          console.error('Failed to cache leaderboard data', e);
        }
      }
    } catch (err: any) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error("Leaderboard fetch error:", err.message || err);
      if (!isBackground || leaderboard.length === 0) {
        setLeaderboardError(err.message || "Failed to retrieve leaderboard data.");
      }
    } finally {
      if (currentFetchId === fetchIdRef.current && !isBackground) {
        setLoading(false);
      }
    }
  }, [isOpen, activeTab, timeframe, currentDate, leaderboard.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      console.error('Failed to clear sessionStorage on manual refresh:', e);
    }
    await fetchLeaderboard(true);
    triggerToast("Leaderboard refreshed with latest scores!", 3000);
  }, [fetchLeaderboard, loading, triggerToast, currentDate]);

  // Evict all sessionStorage caches on modal close (unmount)
  useEffect(() => {
    return () => {
      if (currentDate) {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_weekly_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_monthly_${currentDate}`);
      }
    };
  }, [currentDate]);

  // Track timeframe in a ref to avoid subscription churn
  const timeframeRef = useRef(timeframe);
  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  // Open-only realtime score updates subscription
  useEffect(() => {
    if (!isOpen || !currentDate) return;

    const channelName = `global_scores_leaderboard_sync_${currentDate}`;
    const existing = supabase
      .getChannels()
      .find((c) => (c as any).topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScoreUpdate = (status: string | null) => {
      const isGameOverUpdate = status === 'won' || status === 'lost';
      const currentTF = timeframeRef.current;

      console.log(`[StatsModal Realtime] Score update received: status=${status}, currentTF=${currentTF}`);

      // 1. Evict sessionStorage cache keys
      if (status === 'playing') {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
      } else if (isGameOverUpdate) {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_weekly_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_monthly_${currentDate}`);
      }

      // 2. Decide if we trigger a background refresh
      let shouldRefresh = false;
      if (currentTF === 'today') {
        shouldRefresh = true;
      } else if (isGameOverUpdate && (currentTF === 'weekly' || currentTF === 'monthly' || currentTF === 'yesterday')) {
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log(`[StatsModal Realtime] Performing background refresh for timeframe: ${currentTF}`);
          fetchLeaderboard(true, true);
        }, 1500);
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `game_date=eq.${currentDate}`,
        },
        (payload: any) => {
          const status = payload.new ? payload.new.status : null;
          handleScoreUpdate(status);
        }
      )
      .on(
        "broadcast",
        { event: "score_submitted" },
        (payload: any) => {
          const status = payload.payload ? payload.payload.status : null;
          handleScoreUpdate(status);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentDate, fetchLeaderboard]);

  // Listen to global leaderboard score sync events (local custom events)
  useEffect(() => {
    if (!isOpen) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleGlobalUpdate = (e: Event) => {
      if (debounceTimer) clearTimeout(debounceTimer);

      const customEvent = e as CustomEvent;
      const isBackground = customEvent.detail?.isBackground ?? false;
      const isGameOverUpdate = customEvent.detail?.isGameOver ?? false;
      const currentTF = timeframeRef.current;

      // 1. Evict sessionStorage cache keys
      if (isGameOverUpdate) {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_weekly_${currentDate}`);
        safeSessionStorage.removeItem(`wordle_global_leaderboard_monthly_${currentDate}`);
      } else {
        safeSessionStorage.removeItem(`wordle_global_leaderboard_today_${currentDate}`);
      }

      // 2. Decide if we trigger refresh
      let shouldRefresh = false;
      if (currentTF === 'today') {
        shouldRefresh = true;
      } else if (isGameOverUpdate && (currentTF === 'weekly' || currentTF === 'monthly' || currentTF === 'yesterday')) {
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        debounceTimer = setTimeout(() => {
          console.log('[StatsModal] Local update received. Refreshing...', isBackground);
          fetchLeaderboard(true, isBackground);
        }, 1500);
      }
    };

    window.addEventListener('global-scores-updated', handleGlobalUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('global-scores-updated', handleGlobalUpdate);
    };
  }, [isOpen, currentDate, fetchLeaderboard]);

  const maxGuesses = useMemo(() => {
    return Math.max(...(Object.values(stats.guesses) as number[]), 1);
  }, [stats]);

  const canViewGuess = !!user && (timeframe === "yesterday" || timeframe === "today");
  if (!isOpen && !inline) return null;

  const renderContent = () => (
    <>
        {/* Tab Switcher */}
        <div className="flex bg-gray-800 rounded-lg p-1 mb-6 shrink-0">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'stats' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400'}`}
          >
            <User size={14} /> Personal
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'leaderboard' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400'}`}
          >
            <Trophy size={14} /> Global
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 scrollbar-hide">
          {activeTab === 'stats' ? (
            loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="animate-spin text-gray-600" size={24} />
                <span className="text-[10px] text-gray-600 uppercase font-bold">Fetching your history...</span>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-around mb-4 text-center">
                  <StatItem value={stats.gamesPlayed} label="Played" />
                  <StatItem
                    value={`${stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%`}
                    label="Win %"
                  />
                  <StatItem value={stats.currentStreak} label="Streak" />
                </div>

                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-gray-500">Guess Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(stats.guesses).map(([attempt, count]) => (
                    <div key={attempt} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-2">{attempt}</span>
                      <div className="flex-1 bg-gray-800 rounded-sm overflow-hidden">
                        <div
                          className={`${attempt === "X" ? `bg-red-400` : `bg-correct`} py-0.5 px-1 text-right transition-all duration-1000 min-w-fit font-bold`}
                          style={{ width: `${Math.max((count / maxGuesses) * 100, 8)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isGameOver && user && (
                  <button
                    onClick={() => setSelectedEntry({
                      username: user.user_metadata?.full_name || 'You',
                      avatar_url: user.user_metadata?.avatar_url || '',
                      user_id: user.id,
                      total_score: 0,
                      days_active: 0
                    })}
                    className="mt-8 w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-300 transition-all border border-white/5"
                  >
                    <Eye size={14} /> View Today's Game
                  </button>
                )}
              </div>)
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Timeframe Toggles */}
              <div className="flex gap-1 mb-2">
                {(['today', 'yesterday', 'weekly', 'monthly'] as Timeframe[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border transition-all ${timeframe === t ? 'bg-white text-black border-white' : 'border-gray-700 text-gray-500'}`}
                  >
                    {t}
                  </button>
                ))}


              </div>

              <div className="flex items-center justify-between py-1.5 px-3 mb-3 bg-correct/5 border border-correct/20 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-correct animate-pulse" />
                  <span className="text-[8px] text-correct font-bold uppercase tracking-wider">Live Updates Enabled</span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="text-correct hover:text-white transition-colors disabled:opacity-50 p-1 rounded hover:bg-correct/10"
                  title="Force Refresh Leaderboard"
                  id="force-refresh-leaderboard"
                >
                  <RotateCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              {
                canViewGuess && (
                  <p className="text-[10px] text-gray-100 uppercase font-bold mb-4">Click on user to see their guesses...</p>
                )
              }
              {
                timeframe === "weekly" && (
                  <p className="text-[10px] text-gray-100 uppercase font-bold mb-4">Weekly leaderboard runs from mon - sun</p>
                )
              }

              {
                timeframe === "monthly" && (
                  <p className="text-[9px] text-gray-100 uppercase font-bold mb-4">Monthly leaderboard runs from 1st to last day of the month</p>
                )
              }



              {leaderboardError && leaderboard.length === 0 ? (
                <div className="py-12 px-4 text-center bg-red-950/20 border border-red-500/30 rounded-2xl space-y-4">
                  <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20">
                    <p className="text-xs font-black uppercase mb-1">Failed to Rank Players</p>
                    <p className="text-[10px] leading-relaxed text-red-300/90">{leaderboardError}</p>
                  </div>
                  <button
                    onClick={() => fetchLeaderboard(true)}
                    className="bg-white text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : loading ? (
                <LeaderboardSkeleton />
              ) : (
                <div className="space-y-2">
                  {leaderboardError && leaderboard.length > 0 && (
                    <div className="mb-4 bg-amber-500/15 border border-amber-500/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left">
                      <div>
                        <p className="text-[10px] font-black uppercase text-amber-500">Connection Interrupted</p>
                        <p className="text-[9px] text-white/80 font-semibold leading-tight">Leaderboard details might be stale.</p>
                      </div>
                      <button
                        onClick={() => fetchLeaderboard(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {(() => {
                    let currentRank = 1;
                    return leaderboard.map((entry, i, arr) => {
                      if (i > 0 && entry.total_score < arr[i - 1].total_score) {
                        currentRank = i + 1;
                      }

                      const tieCount = arr.filter(e => e.total_score === entry.total_score).length;
                      const tieIndex = arr.slice(0, i + 1).filter(e => e.total_score === entry.total_score).length - 1;

                      return (
                        <LeaderboardRow
                          key={`${entry.username}-${i}`}
                          entry={entry}
                          rank={currentRank}
                          tieIndex={tieIndex}
                          tieCount={tieCount}
                          isCurrentUser={entry.user_id === user?.id}
                          canViewGuesses={canViewGuess}
                          onShowGuesses={(e) => setSelectedEntry(e)}
                        />
                      );
                    });
                  })()}
                  {leaderboard.length === 0 && (
                    <p className="text-center text-[10px] text-gray-500 uppercase py-8 tracking-widest">No scores found for this period</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* The Modal */}
        {(selectedEntry && (timeframe === "today" || timeframe === "yesterday" || activeTab === 'stats')) && (
          <GuessPreviewModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            yesterday={timeframe === "yesterday"}
          />
        )}
    </>
  );

  if (inline) {
    return (
      <div className="h-full w-full flex flex-col bg-dark text-white p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0))] overflow-hidden">
        <div className="w-full max-w-md mx-auto flex flex-col h-full relative">
          <h2 className="text-xl uppercase tracking-tighter mb-6 text-center text-gray-100 shrink-0">Statistics</h2>
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0))]" style={{ zIndex: Z_INDEX.STATS_MODAL }}>
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
          <X size={20} />
        </button>

        <h2 className="text-xl uppercase tracking-tighter mb-6 text-center text-gray-100">Statistics</h2>

        {/* Tab Switcher */}
        <div className="flex bg-gray-800 rounded-lg p-1 mb-6 shrink-0">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'stats' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400'}`}
          >
            <User size={14} /> Personal
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'leaderboard' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400'}`}
          >
            <Trophy size={14} /> Global
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 scrollbar-hide">
          {activeTab === 'stats' ? (
            loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="animate-spin text-gray-600" size={24} />
                <span className="text-[10px] text-gray-600 uppercase font-bold">Fetching your history...</span>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-around mb-4 text-center">
                  <StatItem value={stats.gamesPlayed} label="Played" />
                  <StatItem
                    value={`${stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%`}
                    label="Win %"
                  />
                  <StatItem value={stats.currentStreak} label="Streak" />
                </div>

                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-gray-500">Guess Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(stats.guesses).map(([attempt, count]) => (
                    <div key={attempt} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-2">{attempt}</span>
                      <div className="flex-1 bg-gray-800 rounded-sm overflow-hidden">
                        <div
                          className={`${attempt === "X" ? `bg-red-400` : `bg-correct`} py-0.5 px-1 text-right transition-all duration-1000 min-w-fit font-bold`}
                          style={{ width: `${Math.max((count / maxGuesses) * 100, 8)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isGameOver && user && (
                  <button
                    onClick={() => setSelectedEntry({
                      username: user.user_metadata?.full_name || 'You',
                      avatar_url: user.user_metadata?.avatar_url || '',
                      user_id: user.id,
                      total_score: 0,
                      days_active: 0
                    })}
                    className="mt-8 w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-300 transition-all border border-white/5"
                  >
                    <Eye size={14} /> View Today's Game
                  </button>
                )}
              </div>)
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Timeframe Toggles */}
              <div className="flex gap-1 mb-2">
                {(['today', 'yesterday', 'weekly', 'monthly'] as Timeframe[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border transition-all ${timeframe === t ? 'bg-white text-black border-white' : 'border-gray-700 text-gray-500'}`}
                  >
                    {t}
                  </button>
                ))}


              </div>

              <div className="flex items-center justify-between py-1.5 px-3 mb-3 bg-correct/5 border border-correct/20 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-correct animate-pulse" />
                  <span className="text-[8px] text-correct font-bold uppercase tracking-wider">Live Updates Enabled</span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="text-correct hover:text-white transition-colors disabled:opacity-50 p-1 rounded hover:bg-correct/10"
                  title="Force Refresh Leaderboard"
                  id="force-refresh-leaderboard"
                >
                  <RotateCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              {
                canViewGuess && (
                  <p className="text-[10px] text-gray-100 uppercase font-bold mb-4">Click on user to see their guesses...</p>
                )
              }
              {
                timeframe === "weekly" && (
                  <p className="text-[10px] text-gray-100 uppercase font-bold mb-4">Weekly leaderboard runs from mon - sun</p>
                )
              }

              {
                timeframe === "monthly" && (
                  <p className="text-[9px] text-gray-100 uppercase font-bold mb-4">Monthly leaderboard runs from 1st to last day of the month</p>
                )
              }



              {leaderboardError && leaderboard.length === 0 ? (
                <div className="py-12 px-4 text-center bg-red-950/20 border border-red-500/30 rounded-2xl space-y-4">
                  <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20">
                    <p className="text-xs font-black uppercase mb-1">Failed to Rank Players</p>
                    <p className="text-[10px] leading-relaxed text-red-300/90">{leaderboardError}</p>
                  </div>
                  <button
                    onClick={() => fetchLeaderboard(true)}
                    className="bg-white text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : loading ? (
                <LeaderboardSkeleton />
              ) : (
                <div className="space-y-2">
                  {leaderboardError && leaderboard.length > 0 && (
                    <div className="mb-4 bg-amber-500/15 border border-amber-500/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left">
                      <div>
                        <p className="text-[10px] font-black uppercase text-amber-500">Connection Interrupted</p>
                        <p className="text-[9px] text-white/80 font-semibold leading-tight">Leaderboard details might be stale.</p>
                      </div>
                      <button
                        onClick={() => fetchLeaderboard(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {(() => {
                    let currentRank = 1;
                    return leaderboard.map((entry, i, arr) => {
                      if (i > 0 && entry.total_score < arr[i - 1].total_score) {
                        currentRank = i + 1;
                      }

                      const tieCount = arr.filter(e => e.total_score === entry.total_score).length;
                      const tieIndex = arr.slice(0, i + 1).filter(e => e.total_score === entry.total_score).length - 1;

                      return (
                        <LeaderboardRow
                          key={`${entry.username}-${i}`}
                          entry={entry}
                          rank={currentRank}
                          tieIndex={tieIndex}
                          tieCount={tieCount}
                          isCurrentUser={entry.user_id === user?.id}
                          canViewGuesses={canViewGuess}
                          onShowGuesses={(e) => setSelectedEntry(e)}
                        />
                      );
                    });
                  })()}
                  {leaderboard.length === 0 && (
                    <p className="text-center text-[10px] text-gray-500 uppercase py-8 tracking-widest">No scores found for this period</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* The Modal */}
        {(selectedEntry && (timeframe === "today" || timeframe === "yesterday" || activeTab === 'stats')) && (
          <GuessPreviewModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            yesterday={timeframe === "yesterday"}
          />
        )}


      </div>
    </div>
  );
};

// --- Sub-components ---

const StatItem: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <div>
    <div className="text-2xl font-black">{value}</div>
    <div className="text-[9px] uppercase text-gray-500 tracking-widest">{label}</div>
  </div>
);

const pluralCheck = (num: number) => {
  return num > 1 ? "s" : ""
}

const LeaderboardRow: React.FC<{ entry: LeaderboardEntry; rank: number; tieIndex: number; tieCount: number; isCurrentUser: boolean, canViewGuesses: boolean; onShowGuesses: (entry: LeaderboardEntry) => void; }> = ({ entry, rank, tieIndex, tieCount, isCurrentUser, canViewGuesses, onShowGuesses }) => {
  let attempts = entry.attempts
  const wordLength = entry.word_length
  const status = entry.status

  if (status === "lost") attempts = "X"

  const formattedGameScore = attempts && wordLength ? ` (${attempts}/${MAX_ATTEMPTS})` : ` (${entry.days_active} game${pluralCheck(entry.days_active)})`
  const isFirst = rank === 1;
  const isTopThree = rank <= 3;
  const pieceWidth = 100 / tieCount;

  return (
    <div
      onClick={() => {
        if (canViewGuesses) {
          onShowGuesses(entry);
        } else if (entry.user_id) {
          window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: entry.user_id } }));
        }
      }}
      className={`
    flex items-center justify-between p-3 rounded-xl border transition-all duration-300
    ${isFirst
          ? 'bg-linear-to-r from-yellow-900/40 via-yellow-600/10 to-transparent border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)] scale-[1.02]'
          : isCurrentUser ? 'bg-correct/10 border-correct/30' : 'bg-gray-800/40 border-gray-800'
        } 
    ${(canViewGuesses || entry.user_id) ? 'cursor-pointer hover:brightness-110' : ''}
  `}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className={`text-xs font-black w-4 flex justify-center ${isFirst ? 'text-yellow-400' : isTopThree ? 'text-yellow-500' : 'text-gray-500'}`}>
            {rank}
          </span>
          {isFirst && (
            <div className="absolute -top-6 left-8.5 text-[18px] w-[18px] flex justify-center select-none">
              <div style={tieCount > 1 ? {
                clipPath: `inset(0 ${100 - pieceWidth * (tieIndex + 1)}% 0 ${pieceWidth * tieIndex}%)`,
                transform: `translateX(${50 - (pieceWidth * tieIndex + pieceWidth / 2)}%)`,
                display: 'inline-block'
              } : {}}>
                👑
              </div>
            </div>
          )}
        </div>

        <img
          src={entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.username)}`}
          className={`w-7 h-7 rounded-full border ${isFirst ? 'border-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'border-gray-700'}`}
          alt={entry.username}
        />

        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span
              className={`text-xs font-bold truncate max-w-20 ${isFirst ? 'text-yellow-50 tracking-wide' : 'text-gray-200'}`}
            >
              {entry.username}
            </span>
            {entry.user_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: entry.user_id } }));
                }}
                title="View Profile"
                className="text-gray-500 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-800"
              >
                <User size={10} />
              </button>
            )}
          </div>
          {canViewGuesses && (
            <div className="flex items-center gap-1 text-gray-500 text-[8px] font-black uppercase">
              <Eye size={10} /> Preview
            </div>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className={`text-xs font-black ${isFirst ? 'text-yellow-400' : 'text-white'} flex items-center justify-end gap-1`}>
          {entry.total_score} {formattedGameScore}
          {status === 'playing' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" title="In Progress" />
          )}
        </div>
        <div className={`text-[8px] uppercase font-bold tracking-tighter ${isFirst ? 'text-yellow-600/80' : (status === 'playing' ? 'text-amber-400 animate-pulse' : 'text-gray-500')}`}>
          {status === 'playing' ? 'Playing' : 'Skill PTS'}
        </div>
      </div>
    </div>
  )
};