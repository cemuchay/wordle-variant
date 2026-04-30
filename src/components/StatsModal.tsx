import React, { useEffect, useState, useMemo } from 'react';
import { X, Trophy, User, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// --- Types & Interfaces ---

// type Timeframe = 'today' | 'weekly' | 'monthly' | 'all';
type Timeframe = 'today' | 'weekly' 

interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
}

interface AppUser {
  id: string;
  user_metadata?: UserMetadata;
}

interface LeaderboardEntry {
  username: string;
  avatar_url: string;
  total_score: number;
}

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
}

// --- Component ---

export const StatsModal: React.FC<Props> = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'leaderboard'>('stats');
  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Memoize personal stats from localStorage
  const stats = useMemo<GameStats>(() => {
    const raw = localStorage.getItem('wordle-statistics');
    console.log(raw, "raw")
    return raw ? JSON.parse(raw) : {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0 }
    };
  }, [isOpen]);

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
        // monthly: 'leaderboard_monthly',
        // all: 'leaderboard_all_time'
      };

      const { data, error } = await supabase
        .from(viewMap[timeframe])
        .select('username, avatar_url, total_points')
        .order('total_points', { ascending: false })
        .limit(20);

      if (isMounted && !error && data) {
        const formattedData: LeaderboardEntry[] = data.map((entry) => ({
          username: entry.username,
          avatar_url: entry.avatar_url,
          total_score: entry.total_points
        }));

        setLeaderboard(formattedData);
      }

      if (error) console.error("Leaderboard fetch error:", error.message);
      if (isMounted) setLoading(false);
    };

    fetchLeaderboard();

    return () => { isMounted = false; };
  }, [isOpen, activeTab, timeframe]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
          <X size={20} />
        </button>

        <h2 className="text-xl uppercase tracking-tighter mb-6 text-center">Statistics</h2>

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

        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {activeTab === 'stats' ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-around mb-8 text-center">
                <StatItem value={stats.gamesPlayed} label="Played" />
                <StatItem 
                  value={`${stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%`} 
                  label="Win %" 
                />
                <StatItem value={stats.currentStreak} label="Streak" />
              </div>

              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-gray-500">Guess Distribution</h3>
              <div className="space-y-2">
                {Object.entries(stats.guesses).map(([attempt, count]) => (
                  <div key={attempt} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-2">{attempt}</span>
                    <div className="flex-1 bg-gray-800 rounded-sm overflow-hidden">
                      <div
                        className="bg-correct py-0.5 px-2 text-right transition-all duration-1000 min-w-fit font-bold"
                        style={{ width: `${Math.max((count / maxGuesses) * 100, 8)}%` }}
                      >
                        {count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Timeframe Toggles */}
              <div className="flex gap-1 mb-6">
                {(['today', 'weekly', 'monthly', 'all'] as Timeframe[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border transition-all ${timeframe === t ? 'bg-white text-black border-white' : 'border-gray-700 text-gray-500'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="animate-spin text-gray-600" size={24} />
                  <span className="text-[10px] text-gray-600 uppercase font-bold">Ranking Players...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.length > 0 ? leaderboard.map((entry, i) => (
                    <LeaderboardRow
                      key={entry.username}
                      entry={entry}
                      index={i}
                      isCurrentUser={entry.username === user?.user_metadata?.full_name}
                    />
                  )) : (
                    <p className="text-center text-[10px] text-gray-500 uppercase py-8 tracking-widest">No scores found for this period</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-correct py-3 rounded-xl font-bold uppercase tracking-tighter hover:brightness-110 transition-all active:scale-95 shrink-0"
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

const LeaderboardRow: React.FC<{ entry: LeaderboardEntry; index: number; isCurrentUser: boolean }> = ({ entry, index, isCurrentUser }) => (
  <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isCurrentUser ? 'bg-correct/10 border-correct/30' : 'bg-gray-800/40 border-gray-800'}`}>
    <div className="flex items-center gap-3">
      <span className={`text-xs font-black w-4 ${index < 3 ? 'text-yellow-500' : 'text-gray-500'}`}>
        {index + 1}
      </span>
      <img 
        src={entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.username)}`} 
        className="w-6 h-6 rounded-full border border-gray-700" 
        alt={entry.username} 
      />
      <span className="text-xs font-bold truncate max-w-[120px]">{entry.username}</span>
    </div>
    <div className="text-right">
      <div className="text-xs font-black text-white">{entry.total_score}</div>
      <div className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter">Skill PTS</div>
    </div>
  </div>
);