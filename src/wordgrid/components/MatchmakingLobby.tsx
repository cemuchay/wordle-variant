// src/wordgrid/components/MatchmakingLobby.tsx

import { useState, useEffect } from 'react';
import { useWordGridStore } from '../../store/useWordGridStore';
import { useApp } from '../../context/AppContext';
import { ProtectedAvatar } from '../../components/chat/ProtectedAvatar';
import { supabase } from '../../lib/supabaseClient';

interface MatchmakingLobbyProps {
  userId: string;
  allProfiles: any[];
  onBack: () => void;
}

export const MatchmakingLobby = ({ userId, allProfiles, onBack }: MatchmakingLobbyProps) => {
  const {
    view,
    startQueue,
    cancelQueue,
    startBotMatch,
    startDirectChallenge,
    loadMatchesList,
    matchesList,
    loadMatch,
    loading
  } = useWordGridStore();

  const { triggerToast } = useApp();
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [playerSearch, setPlayerSearch] = useState('');

  // Periodically refresh matches list when in lobby
  useEffect(() => {
    if (!userId || view !== 'lobby') return;
    loadMatchesList(userId);

    // Bind real-time update triggers to refresh matches list automatically
    const channel = supabase
      .channel('wordgrid_lobby_matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wordgrid_matches' },
        () => {
          loadMatchesList(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, view, loadMatchesList]);

  const handleQueue = (isRated: boolean) => {
    startQueue(userId, isRated, triggerToast);
  };

  const handleBotStart = () => {
    startBotMatch(userId, difficulty);
  };

  const handleChallengePlayer = (oppId: string) => {
    startDirectChallenge(userId, oppId, triggerToast);
  };

  const handleResumeMatch = (matchId: string) => {
    loadMatch(matchId, userId);
  };

  const getOpponentInfo = (match: any) => {
    const isP1 = match.player1_id === userId;
    const opp = isP1 ? match.player2 : match.player1;
    if (match.is_bot_match) {
      return { id: 'bot', username: `AI (${match.bot_difficulty.toUpperCase()})`, avatar_url: null };
    }
    return {
      id: opp?.id || '',
      username: opp?.username || 'Opponent',
      avatar_url: opp?.avatar_url || null
    };
  };

  const filteredPlayers = (allProfiles || []).filter(
    (p: any) =>
      p.id !== userId &&
      (p.username || '').toLowerCase().includes(playerSearch.toLowerCase())
  );

  if (view === 'matchmaking') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/80 border border-white/10 rounded-3xl max-w-sm w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse text-2xl">
          🔍
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black uppercase tracking-wider text-white">Finding Opponent</h3>
          <p className="text-xs text-gray-400">Searching for another player to start a turn-based WordGrid match...</p>
        </div>
        <button
          onClick={() => cancelQueue(userId)}
          className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-wider text-white/70 hover:text-white transition-all cursor-pointer"
        >
          Cancel Search
        </button>
      </div>
    );
  }

  // Active / finished split
  const activeMatches = matchesList.filter(m => m.status === 'active');
  const completedMatches = matchesList.filter(m => m.status === 'completed');

  return (
    <div className="flex flex-col max-h-[80vh] overflow-y-auto p-6 bg-slate-900/80 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 scrollbar-hide pr-1">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔠</span>
          <h2 className="text-md font-black uppercase tracking-wider text-white">WordGrid Arena</h2>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-white/60 hover:text-white transition-all cursor-pointer"
        >
          Back
        </button>
      </div>

      {/* Active Matches list */}
      {activeMatches.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-wider">Your Active Matches</p>
          <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-hide">
            {activeMatches.map(match => {
              const opp = getOpponentInfo(match);
              const isMyTurn = match.current_turn === userId;
              const myScore = match.player1_id === userId ? match.p1_score : match.p2_score;
              const oppScore = match.player1_id === userId ? match.p2_score : match.p1_score;

              return (
                <div
                  key={match.id}
                  className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-3 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProtectedAvatar
                      userId={opp.id}
                      src={opp.avatar_url}
                      username={opp.username}
                      className="w-9 h-9 rounded-full shrink-0"
                    />
                    <div className="min-w-0 flex flex-col">
                      <span className="text-xs font-black text-white truncate">{opp.username}</span>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        {myScore} pts vs {oppScore} pts
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider ${
                      isMyTurn
                        ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400 animate-pulse'
                        : 'bg-white/5 border-white/10 text-white/50'
                    }`}>
                      {isMyTurn ? 'Your Turn' : 'Waiting'}
                    </span>
                    <button
                      onClick={() => handleResumeMatch(match.id)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Play
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Online Matchmaking */}
      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Fast Matchmaking</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleQueue(false)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/25 rounded-2xl transition-all cursor-pointer group"
          >
            <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🎪</span>
            <span className="text-[10px] font-black uppercase text-indigo-200">Casual</span>
            <span className="text-[8px] text-indigo-300/60 font-bold mt-1">Just for fun</span>
          </button>
          <button
            onClick={() => handleQueue(true)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-4 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/25 rounded-2xl transition-all cursor-pointer group"
          >
            <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🏆</span>
            <span className="text-[10px] font-black uppercase text-emerald-200">Rated Arena</span>
            <span className="text-[8px] text-emerald-300/60 font-bold mt-1">Affects rating</span>
          </button>
        </div>
      </div>

      {/* Solo Bot Match */}
      <div className="space-y-3">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Solo Bot Practice</p>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300 font-bold">Bot Level:</span>
            <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
              {(['easy', 'normal', 'hard'] as const).map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`px-3 py-1 text-[9px] font-black uppercase rounded-md cursor-pointer transition-colors ${
                    difficulty === diff ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleBotStart}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            Start Solo Game
          </button>
        </div>
      </div>

      {/* Direct Challenges Search and List */}
      <div className="space-y-3 pt-2">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Challenge Active Players</p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search players by username..."
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/40 font-bold"
          />
          {playerSearch && (
            <button
              onClick={() => setPlayerSearch('')}
              className="text-[9px] font-black uppercase text-white/50 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-hide">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((profile: any) => (
              <div
                key={profile.id}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ProtectedAvatar
                    userId={profile.id}
                    src={profile.avatar_url}
                    username={profile.username}
                    className="w-8 h-8 rounded-full shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate">{profile.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleChallengePlayer(profile.id)}
                  disabled={loading}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Challenge
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-white/40 text-[9px] font-bold uppercase tracking-wider">
              {playerSearch ? 'No players found matching search' : 'Search for players to challenge'}
            </div>
          )}
        </div>
      </div>

      {/* Completed Matches (History) */}
      {completedMatches.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Finished Matches</p>
          <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-hide">
            {completedMatches.map(match => {
              const opp = getOpponentInfo(match);
              const myScore = match.player1_id === userId ? match.p1_score : match.p2_score;
              const oppScore = match.player1_id === userId ? match.p2_score : match.p1_score;
              const won = myScore > oppScore;

              return (
                <div
                  key={match.id}
                  className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between"
                >
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-black text-white/70 truncate">vs {opp.username}</span>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                      Final: {myScore} - {oppScore}
                    </span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    won
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    {won ? 'Won' : 'Lost'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
