import React, { useEffect, useState, useMemo } from 'react';
import { X, Trophy, User, Loader2, Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { AppUser, LeaderboardEntry } from '../types/game';
import GuessPreviewModal from './GuessPreviewModal';

// type Timeframe = 'today' | 'weekly' | 'monthly' | 'all';
type Timeframe = 'today' | 'weekly' | 'monthly'


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
}

// --- Component ---

export const StatsModal: React.FC<Props> = ({ isOpen, onClose, user, stats, isGameOver }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'leaderboard'>('stats');
  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);

  const maxGuesses = useMemo(() => {
    return Math.max(...(Object.values(stats.guesses) as number[]), 1);
  }, [stats]);

  // Fetch Leaderboard Data
  useEffect(() => {
    let isMounted = true;

    const fetchLeaderboard = async () => {
      if (!isOpen || activeTab !== 'leaderboard') return;

      setLoading(true);

      const viewMap: Record<Timeframe, string> = {
        today: 'leaderboard_today',
        weekly: 'leaderboard_weekly',
        monthly: 'leaderboard_monthly',
        // all: 'leaderboard_all_time'
      };

      // 1. Join array values into a comma-separated string for Supabase .select()
      const baseSelect = "username, avatar_url, total_points"
      const standardSelect = `${baseSelect}, days_active`;
      const todaySelect = `${baseSelect}, word_length, attempts, status, user_id`;

      const { data, error } = await supabase
        .from(viewMap[timeframe])
        .select(timeframe === 'today' ? todaySelect : standardSelect)
        .order('total_points', { ascending: false })
        .limit(20);

      if (isMounted && !error && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedData: LeaderboardEntry[] = data.map((entry: any) => ({
          username: entry.username,
          avatar_url: entry.avatar_url,
          total_score: entry.total_points,
          // Pass these through if you want to display them in the UI for 'today'
          word_length: entry.word_length ?? null,
          attempts: entry.attempts ?? null,
          status: entry.status,
          days_active: entry.days_active ?? 0,
          user_id: entry.user_id ?? null
        }));

        setLeaderboard(formattedData);
      }

      if (error) console.error("Leaderboard fetch error:", error.message);
      if (isMounted) setLoading(false);
    };

    fetchLeaderboard();

    return () => { isMounted = false; };
  }, [isOpen, activeTab, timeframe]);

  const canViewGuess = isGameOver && timeframe === "today" && !!user;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-120 p-4">
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
                {(['today', 'weekly', 'monthly'] as Timeframe[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border transition-all ${timeframe === t ? 'bg-white text-black border-white' : 'border-gray-700 text-gray-500'}`}
                  >
                    {t}
                  </button>
                ))}


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



              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="animate-spin text-gray-600" size={24} />
                  <span className="text-[10px] text-gray-600 uppercase font-bold">Ranking Players...</span>
                </div>
              ) : (
                <div className="space-y-2">
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
        {(selectedEntry && (timeframe === "today" || activeTab === 'stats')) && (
          <GuessPreviewModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
          />
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-correct py-2 rounded-xl font-bold uppercase tracking-tighter hover:brightness-110 transition-all active:scale-95 shrink-0"
        >
          Close
        </button>
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

  const formattedGameScore = attempts && wordLength ? ` (${attempts}/${6})` : ` (${entry.days_active} game${pluralCheck(entry.days_active)})`
  const isFirst = rank === 1;
  const isTopThree = rank <= 3;
  const pieceWidth = 100 / tieCount;

  return (
    <div
      onClick={() => canViewGuesses && onShowGuesses(entry)}
      className={`
    flex items-center justify-between p-3 rounded-xl border transition-all duration-300
    ${isFirst
          ? 'bg-linear-to-r from-yellow-900/40 via-yellow-600/10 to-transparent border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)] scale-[1.02]'
          : isCurrentUser ? 'bg-correct/10 border-correct/30' : 'bg-gray-800/40 border-gray-800'
        } 
    ${canViewGuesses ? 'cursor-pointer hover:brightness-110' : ''}
  `}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className={`text-xs font-black w-4 flex justify-center ${isFirst ? 'text-yellow-400' : isTopThree ? 'text-yellow-500' : 'text-gray-500'}`}>
            {rank}
          </span>
          {isFirst && (
            <div className="absolute -top-6 left-7.5 text-[18px] w-[18px] flex justify-center select-none">
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
          <span className={`text-xs font-bold truncate max-w-24 ${isFirst ? 'text-yellow-50 tracking-wide' : 'text-gray-200'}`}>
            {entry.username}
          </span>
          {canViewGuesses && (
            <div className="flex items-center gap-1 text-gray-500 text-[8px] font-black uppercase">
              <Eye size={10} /> Preview
            </div>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className={`text-xs font-black ${isFirst ? 'text-yellow-400' : 'text-white'}`}>
          {entry.total_score} {formattedGameScore}
        </div>
        <div className={`text-[8px] uppercase font-bold tracking-tighter ${isFirst ? 'text-yellow-600/80' : 'text-gray-500'}`}>
          Skill PTS
        </div>
      </div>
    </div>
  )
};