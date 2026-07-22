// src/wordgrid/components/MatchmakingLobby.tsx

import { useState, useEffect } from 'react';
import { useWordGridStore } from '../../store/useWordGridStore';
import { useApp } from '../../context/AppContext';
import { ProtectedAvatar } from '../../components/chat/ProtectedAvatar';
import { supabase } from '../../lib/supabaseClient';
import { ALLOWED_GRID_SIZES, RECOMMENDED_MAX_PLAYERS } from '../../utils/wordgrid/constants';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url?: string | null;
}

interface WordGridMatchRecord {
  id: string;
  player1_id: string;
  player2_id?: string;
  is_bot_match?: boolean;
  bot_difficulty?: string;
  player1?: PlayerProfile;
  player2?: PlayerProfile;
  p1_score: number;
  p2_score: number;
  status: string;
  current_turn: string;
  grid_size?: number;
}

interface MatchmakingLobbyProps {
  userId: string;
  allProfiles: PlayerProfile[];
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
  const [selectedGridSize, setSelectedGridSize] = useState<number>(7);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [playerSearch, setPlayerSearch] = useState('');

  const maxPlayersAllowed = RECOMMENDED_MAX_PLAYERS[selectedGridSize] || 2;
  const [selectedPlayers, setSelectedPlayers] = useState<number>(2);

  // Derived target players capped by max players allowed
  const targetPlayers = Math.min(selectedPlayers, maxPlayersAllowed);

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!userId || !isUuid || view !== 'lobby') return;
    loadMatchesList(userId);

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
    startQueue(userId, isRated, selectedGridSize, targetPlayers, triggerToast);
  };

  const handleBotStart = () => {
    startBotMatch(userId, difficulty, selectedGridSize);
  };

  const handleChallengePlayer = (oppId: string) => {
    startDirectChallenge(userId, oppId, selectedGridSize, triggerToast);
  };

  const handleResumeMatch = (matchId: string) => {
    loadMatch(matchId, userId);
  };

  const getOpponentInfo = (match: WordGridMatchRecord) => {
    const isP1 = match.player1_id === userId;
    const opp = isP1 ? match.player2 : match.player1;
    if (match.is_bot_match) {
      return { id: 'bot', username: `AI (${(match.bot_difficulty || 'normal').toUpperCase()})`, avatar_url: null };
    }
    return {
      id: opp?.id || '',
      username: opp?.username || 'Opponent',
      avatar_url: opp?.avatar_url || null
    };
  };

  // Self-abort 10s timeout during matchmaking or game creation
  useEffect(() => {
    if (loading || view === 'matchmaking') {
      const timer = setTimeout(() => {
        const store = useWordGridStore.getState();
        if (store.loading || store.view === 'matchmaking') {
          useWordGridStore.setState({ loading: false, view: 'lobby' });
          triggerToast('Game creation timed out (10s limit). Returning to lobby.', 4000);
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [loading, view, triggerToast]);

  const filteredPlayers = (allProfiles || []).filter(
    (p: PlayerProfile) =>
      p.id !== userId &&
      (p.username || '').toLowerCase().includes(playerSearch.toLowerCase())
  );

  if (loading || view === 'matchmaking') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <span className="absolute text-2xl animate-bounce">🔠</span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black uppercase tracking-wider text-white">
            {view === 'matchmaking' ? 'Finding Opponent' : 'Creating Game'}
          </h3>
          <p className="text-xs text-indigo-300 font-bold">
            Initializing {selectedGridSize}×{selectedGridSize} Scrabble board...
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            Shuffling balanced tile bag & preparing racks. Self-aborting in 10s if delayed.
          </p>
        </div>
        <button
          onClick={() => {
            useWordGridStore.setState({ loading: false, view: 'lobby' });
            cancelQueue(userId);
          }}
          className="w-full py-3 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-md active:scale-95"
        >
          Cancel & Abort
        </button>
      </div>
    );
  }

  const activeMatches = (matchesList as WordGridMatchRecord[]).filter(m => m.status === 'active');
  const completedMatches = (matchesList as WordGridMatchRecord[]).filter(m => m.status === 'completed');

  return (
    <div className="flex flex-col max-h-[85vh] overflow-y-auto p-6 bg-slate-900 border border-slate-800 rounded-3xl w-full mx-auto shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between my-10 py-6 pb-12 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔠</span>
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-white">WordGrid Arena</h2>
            <p className="text-[10px] font-bold text-indigo-400">Fast Turn-Based Multiplayer</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-[10px] font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-sm"
        >
          Back
        </button>
      </div>

      {/* Grid Size & Multiplayer Settings */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div>
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block mb-2">
            Board Dimension (Default: 7×7)
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {ALLOWED_GRID_SIZES.map((sz) => (
              <button
                key={sz}
                onClick={() => setSelectedGridSize(sz)}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${selectedGridSize === sz
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
              >
                {sz}×{sz}
              </button>
            ))}
          </div>
        </div>

        {maxPlayersAllowed > 2 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">Max Players ({selectedGridSize}×{selectedGridSize}):</span>
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {Array.from({ length: maxPlayersAllowed - 1 }).map((_, i) => {
                const count = i + 2;
                return (
                  <button
                    key={count}
                    onClick={() => setSelectedPlayers(count)}
                    className={`px-3 py-1 text-[10px] font-black rounded-lg cursor-pointer transition-colors ${targetPlayers === count ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    {count} Players
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Active Matches list */}
      {activeMatches.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-indigo-400 font-black uppercase tracking-wider">Your Active Matches</p>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {activeMatches.map(match => {
              const opp = getOpponentInfo(match);
              const isMyTurn = match.current_turn === userId;
              const myScore = match.player1_id === userId ? match.p1_score : match.p2_score;
              const oppScore = match.player1_id === userId ? match.p2_score : match.p1_score;

              return (
                <div
                  key={match.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 flex items-center justify-between transition-all shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProtectedAvatar
                      userId={opp.id}
                      src={opp.avatar_url || undefined}
                      username={opp.username}
                      className="w-10 h-10 rounded-full shrink-0 border border-slate-700"
                    />
                    <div className="min-w-0 flex flex-col">
                      <span className="text-xs font-black text-white truncate">{opp.username}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {myScore} pts vs {oppScore} pts ({match.grid_size || 7}×{match.grid_size || 7})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wider ${isMyTurn
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 animate-pulse'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                      {isMyTurn ? 'Your Turn' : 'Waiting'}
                    </span>
                    <button
                      onClick={() => handleResumeMatch(match.id)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
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
        <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Fast Matchmaking</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleQueue(false)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-4 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/40 rounded-2xl transition-all cursor-pointer group shadow-lg"
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🎪</span>
            <span className="text-xs font-black uppercase text-indigo-200">Casual Match</span>
            <span className="text-[9px] text-indigo-300/80 font-bold mt-1">Just for fun</span>
          </button>
          <button
            onClick={() => handleQueue(true)}
            disabled={loading}
            className="flex flex-col items-center justify-center p-4 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 rounded-2xl transition-all cursor-pointer group shadow-lg"
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🏆</span>
            <span className="text-xs font-black uppercase text-emerald-200">Rated Arena</span>
            <span className="text-[9px] text-emerald-300/80 font-bold mt-1">Competitive ranking</span>
          </button>
        </div>
      </div>

      {/* Solo Bot Match */}
      <div className="space-y-3">
        <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Solo Bot Practice</p>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white font-bold">Bot Level:</span>
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(['easy', 'normal', 'hard'] as const).map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg cursor-pointer transition-colors ${difficulty === diff ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
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
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
          >
            Start Solo Match ({selectedGridSize}×{selectedGridSize})
          </button>
        </div>
      </div>

      {/* Direct Challenges Search and List */}
      <div className="space-y-3 pt-2">
        <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Challenge Active Players</p>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search players by username..."
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500 font-bold"
          />
          {playerSearch && (
            <button
              onClick={() => setPlayerSearch('')}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((profile: PlayerProfile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ProtectedAvatar
                    userId={profile.id}
                    src={profile.avatar_url || undefined}
                    username={profile.username}
                    className="w-9 h-9 rounded-full shrink-0 border border-slate-700"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate">{profile.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleChallengePlayer(profile.id)}
                  disabled={loading}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Challenge
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              {playerSearch ? 'No players found matching search' : 'Search for players to challenge'}
            </div>
          )}
        </div>
      </div>

      {/* Completed Matches (History) */}
      {completedMatches.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Finished Matches</p>
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {completedMatches.map(match => {
              const opp = getOpponentInfo(match);
              const myScore = match.player1_id === userId ? match.p1_score : match.p2_score;
              const oppScore = match.player1_id === userId ? match.p2_score : match.p1_score;
              const won = myScore > oppScore;

              return (
                <div
                  key={match.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between"
                >
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs font-black text-white/80 truncate">vs {opp.username}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Final: {myScore} - {oppScore}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${won
                    ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-950 border-rose-500/40 text-rose-400'
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

export default MatchmakingLobby;


