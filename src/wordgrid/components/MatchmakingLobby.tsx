// src/wordgrid/components/MatchmakingLobby.tsx

import { useState, useEffect } from 'react';
import { useWordGridStore } from '../../store/useWordGridStore';
import { useApp } from '../../context/AppContext';
import { ProtectedAvatar } from '../../components/chat/ProtectedAvatar';
import { supabase } from '../../lib/supabaseClient';
import { ALLOWED_GRID_SIZES, RECOMMENDED_MAX_PLAYERS } from '../../utils/wordgrid/constants';
import type { WordGridPlayer } from '../../utils/wordgrid/constants';
import { getLastActivityAt } from '../../utils/wordgrid/staleMatches';
import formatLastSeen from '../../utils/formatLastSeen';
import { useTheme } from '@/hooks/useTheme';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Trash2, Users, Bot, Check, Search, Sparkles, Eye } from 'lucide-react';
import { TOAST_DURATION } from '../../constants/ui';

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
  players_data?: WordGridPlayer[];
  max_players?: number;
  p1_score: number;
  p2_score: number;
  status: string;
  current_turn: string;
  grid_size?: number;
  last_move_at?: string | null;
  created_at?: string | null;
  moves?: Array<{ created_at?: string | null }>;
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
    matchesList,
    loadMatch,
    deleteMatch,
    loading
  } = useWordGridStore();

  useTheme('wordGrid');

  const { triggerToast } = useApp();
  const [selectedGridSize, setSelectedGridSize] = useState<number>(7);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [playerSearch, setPlayerSearch] = useState('');
  const [matchToDelete, setMatchToDelete] = useState<{ id: string; name: string } | null>(null);

  const maxPlayersAllowed = RECOMMENDED_MAX_PLAYERS[selectedGridSize] || 2;
  const targetPlayers = maxPlayersAllowed;

  const [gameMode, setGameMode] = useState<'bot' | 'human'>('human');
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  const maxOpponentsAllowed = maxPlayersAllowed - 1; // e.g., if 3 players max, can select up to 2 opponents

  // Auto-adjust selected opponents if grid size changes
  useEffect(() => {
    setSelectedOpponents((prev) => prev.slice(0, maxOpponentsAllowed));
  }, [maxOpponentsAllowed]);

  const toggleOpponentSelection = (oppId: string) => {
    setSelectedOpponents((prev) => {
      if (prev.includes(oppId)) {
        return prev.filter((id) => id !== oppId);
      }
      if (prev.length >= maxOpponentsAllowed) {
        // If max is 1 (e.g. 2-player match), replace the single selection
        if (maxOpponentsAllowed === 1) {
          return [oppId];
        }
        triggerToast(`You can select up to ${maxOpponentsAllowed} opponent${maxOpponentsAllowed > 1 ? 's' : ''} for a ${selectedGridSize}×${selectedGridSize} board.`);
        return prev;
      }
      return [...prev, oppId];
    });
  };

  const handleStartHumanMatch = () => {
    if (selectedOpponents.length === 0) {
      triggerToast('Please select at least 1 opponent to start.');
      return;
    }
    // Launch challenge for all selected opponents
    handleChallengePlayer(selectedOpponents);
  };

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!userId || !isUuid || view !== 'lobby') return;

    useWordGridStore.getState().loadMatchesList(userId);

    const channel = supabase
      .channel(`wordgrid_lobby_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wordgrid_matches', filter: `player1_id=eq.${userId}` },
        () => {
          useWordGridStore.getState().loadMatchesList(userId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wordgrid_matches', filter: `player2_id=eq.${userId}` },
        () => {
          useWordGridStore.getState().loadMatchesList(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, view]);

  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    if (!loading && view !== 'matchmaking') {
      setIsLaunching(false);
    }
  }, [loading, view]);

  const handleQueue = (isRated: boolean) => {
    setIsLaunching(true);
    startQueue(userId, isRated, selectedGridSize, targetPlayers, triggerToast);
  };

  const handleBotStart = () => {
    setIsLaunching(true);
    startBotMatch(userId, difficulty, selectedGridSize, triggerToast);
  };

  const handleChallengePlayer = (oppIds: string | string[]) => {
    setIsLaunching(true);
    startDirectChallenge(userId, oppIds, selectedGridSize, triggerToast);
  };

  const handleResumeMatch = (matchId: string) => {
    setIsLaunching(true);
    loadMatch(matchId, userId);
  };

  const getOpponentInfo = (match: WordGridMatchRecord) => {
    if (match.is_bot_match) {
      return {
        id: 'bot',
        username: `AI (${(match.bot_difficulty || 'normal').toUpperCase()})`,
        avatar_url: null,
        opponents: [{ id: 'bot', username: `AI (${(match.bot_difficulty || 'normal').toUpperCase()})`, avatar_url: null }],
      };
    }

    // Check players_data first if available
    if (match.players_data && match.players_data.length > 0) {
      const opps = match.players_data.filter((p) => p.id !== userId);
      const firstOpp = opps[0];
      const usernames = opps.map((p) => p.username).join(', ');
      return {
        id: firstOpp?.id || '',
        username: usernames || 'Opponents',
        avatar_url: firstOpp?.avatar_url || null,
        opponents: opps,
      };
    }

    const isP1 = match.player1_id === userId;
    const opp = isP1 ? match.player2 : match.player1;
    return {
      id: opp?.id || '',
      username: opp?.username || 'Opponent',
      avatar_url: opp?.avatar_url || null,
      opponents: opp ? [opp] : [],
    };
  };

  // Self-abort 10s timeout during matchmaking or game creation
  useEffect(() => {
    if (loading || isLaunching || view === 'matchmaking') {
      const timer = setTimeout(() => {
        const store = useWordGridStore.getState();
        if (store.loading || store.view === 'matchmaking') {
          setIsLaunching(false);
          useWordGridStore.setState({ loading: false, view: 'lobby' });
          triggerToast('Game creation timed out (10s limit). Returning to lobby.', TOAST_DURATION.LONG);
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [loading, isLaunching, view, triggerToast]);

  const filteredPlayers = (allProfiles || []).filter(
    (p: PlayerProfile) =>
      p.id !== userId &&
      (p.username || '').toLowerCase().includes(playerSearch.toLowerCase())
  );

  const activeMatches = (matchesList as WordGridMatchRecord[])
    .filter((m) => m.status === 'active')
    .sort((a, b) => {
      const aIsMyTurn = a.current_turn === userId;
      const bIsMyTurn = b.current_turn === userId;

      // 1. Games where it's the user's turn come first
      if (aIsMyTurn && !bIsMyTurn) return -1;
      if (!aIsMyTurn && bIsMyTurn) return 1;

      // 2. Secondary sort: Games with the latest last move / activity
      const aTime = new Date(getLastActivityAt(a) || a.last_move_at || a.created_at || 0).getTime();
      const bTime = new Date(getLastActivityAt(b) || b.last_move_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

  const completedMatches = (matchesList as WordGridMatchRecord[]).filter(m => m.status === 'completed' || m.status === 'abandoned');
  const isExpiredMatch = (m: WordGridMatchRecord) => m.status === 'abandoned';

  return (
    <div className="flex flex-col max-h-[85vh] md:max-h-[90vh] overflow-y-auto scrollbar-hide p-4 sm:p-6 bg-[#101828] border border-slate-800 rounded-3xl w-full max-w-none mx-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔠</span>
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-white">WordGrid Arena</h2>
            <p className="text-[10px] font-bold text-indigo-400">Fast Turn-Based Multiplayer</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-[#0c121e] border border-slate-700 hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-sm"
        >
          Back
        </button>
      </div>

      {/* Main Content Layout: Active Matches on Top on Mobile, 2-Column Grid on Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Active Matches Column (Mobile: order-1 on top, Desktop: right column) */}
        <div className="order-1 md:order-2 space-y-4">
          {/* Active Matches list */}
          {activeMatches.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-indigo-400 font-black uppercase tracking-wider">Your Active Matches</p>
              <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-hide pr-1">
                {activeMatches.map(match => {
                  const opp = getOpponentInfo(match);
                  const isMyTurn = match.current_turn === userId;
                  const myScore = match.player1_id === userId ? match.p1_score : match.p2_score;
                  const oppScore = match.player1_id === userId ? match.p2_score : match.p1_score;
                  const lastActivity = getLastActivityAt(match);

                  return (
                    <div
                      key={match.id}
                      className="bg-[#0c121e] border border-slate-800 hover:border-slate-700 rounded-2xl p-3 flex items-center justify-between transition-all shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {opp.opponents && opp.opponents.length > 1 ? (
                          <div className="flex -space-x-2 shrink-0">
                            {opp.opponents.slice(0, 3).map((op: any, i: number) => (
                              <ProtectedAvatar
                                key={op.id || i}
                                userId={op.id}
                                src={op.avatar_url || undefined}
                                username={op.username}
                                className="w-8 h-8 rounded-full border-2 border-slate-900 ring-1 ring-slate-700 shrink-0"
                              />
                            ))}
                          </div>
                        ) : (
                          <ProtectedAvatar
                            userId={opp.id}
                            src={opp.avatar_url || undefined}
                            username={opp.username}
                            className="w-10 h-10 rounded-full shrink-0 border border-slate-700"
                          />
                        )}
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {opp.opponents && opp.opponents.length > 1 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {opp.opponents.map((op: any) => (
                                  <span
                                    key={op.id}
                                    className="text-[11px] font-black text-indigo-300 bg-indigo-950/80 border border-indigo-700/60 px-2 py-0.5 rounded-lg truncate max-w-[120px]"
                                    title={op.username}
                                  >
                                    @{op.username}
                                  </span>
                                ))}
                                <span className="text-[9px] font-extrabold text-amber-300 bg-amber-950/70 border border-amber-600/50 px-1.5 py-0.5 rounded-md">
                                  {opp.opponents.length + 1}P
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-black text-white truncate">vs {opp.username}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {match.players_data && match.players_data.length > 2 ? (
                              <span className="text-[10px] text-slate-400 font-bold">
                                You: {match.players_data.find((p: any) => p.id === userId)?.score ?? myScore} pts
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">
                                {myScore} pts vs {oppScore} pts
                              </span>
                            )}
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded-md">
                              {match.grid_size || 7}×{match.grid_size || 7}
                            </span>
                            <span
                              className="text-[9px] text-slate-500 font-bold flex items-center gap-0.5"
                              title={`Last play: ${formatLastSeen(lastActivity || undefined)}`}
                            >
                              ⏱ {formatLastSeen(lastActivity || undefined)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wider ${isMyTurn
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 animate-pulse'
                          : 'bg-[#101828] border-slate-700 text-slate-400'
                          }`}>
                          {isMyTurn ? 'Your Turn' : 'Waiting'}
                        </span>
                        {match.is_bot_match && (
                          <button
                            onClick={() => setMatchToDelete({ id: match.id, name: opp.username })}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl transition-all cursor-pointer"
                            title="Delete Bot Match"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
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

          {/* Completed Matches (History) */}
          {completedMatches.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Finished Matches</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide pr-1">
                {completedMatches.map(match => {
                  const opp = getOpponentInfo(match);
                  const myScore = match.player1_id === userId ? match.p1_score : match.p2_score;
                  const oppScore = match.player1_id === userId ? match.p2_score : match.p1_score;
                  const won = myScore > oppScore;
                  const expired = isExpiredMatch(match);
                  const lastActivity = getLastActivityAt(match);

                  return (
                    <div
                      key={match.id}
                      className="bg-[#0c121e] border border-slate-800 rounded-2xl p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex flex-col">
                        <span className="text-xs font-black text-white/80 truncate">vs {opp.username}</span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Final: {myScore} - {oppScore}
                          </span>
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded-md">
                            {match.grid_size || 7}×{match.grid_size || 7}
                          </span>
                          <span
                            className="text-[9px] text-slate-500 font-bold flex items-center gap-0.5"
                            title={`Last play: ${formatLastSeen(lastActivity || undefined)}`}
                          >
                            ⏱ {formatLastSeen(lastActivity || undefined)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${expired
                          ? 'bg-amber-950 border-amber-500/40 text-amber-400'
                          : won
                            ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
                            : 'bg-rose-950 border-rose-500/40 text-rose-400'
                          }`}>
                          {expired ? 'Expired' : won ? 'Won' : 'Lost'}
                        </span>
                        <button
                          onClick={() => handleResumeMatch(match.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Preview Game Board and History"
                        >
                          <Eye size={12} className="text-indigo-400" />
                          <span>Preview</span>
                        </button>
                        {match.is_bot_match && (
                          <button
                            onClick={() => setMatchToDelete({ id: match.id, name: opp.username })}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl transition-all cursor-pointer"
                            title="Delete Bot Match"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Left Column: Dimensions, Mode Selection (Solo vs Bot / vs Human) (Mobile: order-2, Desktop: order-1) */}
        <div className="order-2 md:order-1 space-y-4">
          {/* Step 1: Grid Size */}
          <div className="bg-[#0c121e] border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                1. Select Board Dimension
              </label>
              <span className="text-[10px] font-bold text-indigo-400">
                Max {maxPlayersAllowed} Players
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {ALLOWED_GRID_SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSelectedGridSize(sz)}
                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${selectedGridSize === sz
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-[#101828] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  {sz}×{sz}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Game Mode Selection (Solo vs Bot OR vs Human) */}
          <div className="bg-[#0c121e] border border-slate-800/80 rounded-2xl p-4 space-y-3.5 shadow-lg">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
              2. Choose Game Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGameMode('bot')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer ${gameMode === 'bot'
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-[#101828] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
              >
                <Bot className={`w-6 h-6 mb-1.5 ${gameMode === 'bot' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-xs font-black uppercase">Solo vs Bot</span>
                <span className="text-[9px] text-slate-400 font-bold mt-0.5">Practice against AI</span>
              </button>

              <button
                type="button"
                onClick={() => setGameMode('human')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer ${gameMode === 'human'
                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-[#101828] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
              >
                <Users className={`w-6 h-6 mb-1.5 ${gameMode === 'human' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-xs font-black uppercase">vs Human</span>
                <span className="text-[9px] text-slate-400 font-bold mt-0.5">Challenge players</span>
              </button>
            </div>

            {/* Sub-Panel A: Bot Configuration */}
            {gameMode === 'bot' && (
              <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-bold">Bot Level:</span>
                  <div className="flex gap-1 bg-[#101828] p-1 rounded-xl border border-slate-800">
                    {(['easy', 'normal', 'hard'] as const).map((diff) => (
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
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  Start Solo Match ({selectedGridSize}×{selectedGridSize})
                </button>
              </div>
            )}

            {/* Sub-Panel B: Human Multi-select Search & Challenge */}
            {gameMode === 'human' && (
              <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black uppercase text-slate-300">
                    Select Opponents (1 to {maxOpponentsAllowed})
                  </span>
                  <span className="font-bold text-indigo-400">
                    {selectedOpponents.length}/{maxOpponentsAllowed} Selected
                  </span>
                </div>

                {/* Search Bar */}
                <div className="bg-[#101828] border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Search size={14} className="text-slate-500 shrink-0" />
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

                {/* Available Players Multi-Select List */}
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-hide pr-1">
                  {filteredPlayers.length > 0 ? (
                    filteredPlayers.map((profile: PlayerProfile) => {
                      const isSelected = selectedOpponents.includes(profile.id);
                      return (
                        <div
                          key={profile.id}
                          onClick={() => toggleOpponentSelection(profile.id)}
                          className={`flex items-center justify-between rounded-xl p-2.5 cursor-pointer border transition-all ${isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                            : 'bg-[#101828] border-slate-800/80 hover:border-slate-700 text-slate-300'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProtectedAvatar
                              userId={profile.id}
                              src={profile.avatar_url || undefined}
                              username={profile.username}
                              className="w-7 h-7 rounded-full shrink-0 border border-slate-700"
                            />
                            <p className="text-xs font-black truncate">{profile.username}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${isSelected
                              ? 'bg-indigo-600 border-indigo-400 text-white'
                              : 'border-slate-700 bg-slate-900/50'
                              }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      {playerSearch ? 'No players found matching search' : 'No available players found'}
                    </div>
                  )}
                </div>

                {/* Challenge Action Button */}
                <button
                  onClick={handleStartHumanMatch}
                  disabled={loading || selectedOpponents.length === 0}
                  className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${selectedOpponents.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                >
                  <Users size={14} />
                  Challenge {selectedOpponents.length > 0 ? `${selectedOpponents.length} Player${selectedOpponents.length > 1 ? 's' : ''}` : 'Players'} ({selectedGridSize}×{selectedGridSize})
                </button>
              </div>
            )}
          </div>

          {/* Quick Random Matchmaking Option */}
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider">Or Fast Auto-Matchmaking</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleQueue(false)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/40 rounded-2xl transition-all cursor-pointer group shadow-lg"
              >
                <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">🎪</span>
                <span className="text-xs font-black uppercase text-indigo-200">Casual Match</span>
                <span className="text-[9px] text-indigo-300/80 font-bold">Random queue</span>
              </button>
              <button
                onClick={() => handleQueue(true)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 rounded-2xl transition-all cursor-pointer group shadow-lg"
              >
                <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">🏆</span>
                <span className="text-xs font-black uppercase text-emerald-200">Rated Arena</span>
                <span className="text-[9px] text-emerald-300/80 font-bold">Competitive queue</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Matchmaking Modal Overlay */}
      {(loading || isLaunching || view === 'matchmaking') && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto">
          <div className="bg-[#0c121e] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center text-center space-y-5 animate-in zoom-in-95 duration-200 select-none">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <span className="absolute text-xl animate-bounce">🔠</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                {view === 'matchmaking' ? 'Finding Opponent...' : 'Loading Game...'}
              </h3>
              <p className="text-xs text-indigo-300 font-bold">
                Populating board & tile rack...
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                Please wait while the match data initializes.
              </p>
            </div>
            {view === 'matchmaking' && (
              <button
                onClick={() => {
                  setIsLaunching(false);
                  useWordGridStore.setState({ loading: false, view: 'lobby' });
                  cancelQueue(userId);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-[#101828] hover:bg-slate-800 text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-md active:scale-95"
              >
                Cancel Matchmaking
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={matchToDelete !== null}
        onClose={() => setMatchToDelete(null)}
        onConfirm={async () => {
          if (matchToDelete) {
            await deleteMatch(matchToDelete.id, userId);
            triggerToast(`Deleted match vs ${matchToDelete.name}`);
            setMatchToDelete(null);
          }
        }}
        title="Delete Bot Game"
        message={`Are you sure you want to delete your game vs ${matchToDelete?.name}? This action cannot be undone.`}
        confirmLabel="Delete Game"
        cancelLabel="Keep Game"
        type="danger"
      />
    </div>
  );
};

export default MatchmakingLobby;