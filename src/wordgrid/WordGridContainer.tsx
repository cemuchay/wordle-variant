/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useMemo } from 'react';
import { calculateTurnScore } from '../utils/wordgrid/scoring';
import { validateBoardPlacement } from '../utils/wordgrid/boardValidation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWordGridStore } from '../store/useWordGridStore';
import { MatchmakingLobby } from './components/MatchmakingLobby';
import { BoardGrid } from './components/BoardGrid';
import { TileRack } from './components/TileRack';
import { MoveHistory } from './components/MoveHistory';
import { WordGridTutorialModal } from './components/WordGridTutorialModal';
import LetterPickerModal from './components/LetterPickerModal';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../hooks/useTheme';
import { ProtectedAvatar } from '../components/chat/ProtectedAvatar';
import { TOAST_DURATION } from '../constants/ui';
import { buildPlayerColorMap } from '../utils/wordgrid/playerColors';
import { loadScrabbleDictionary } from '../utils/wordgrid/scrabbleTrie';
import { useWordGridPresence } from '../hooks/useWordGridPresence';
import formatUsername from '../utils/formatUsername';

interface WordGridContainerProps {
  onBackToClassic: () => void;
}

export const WordGridContainer = ({ onBackToClassic }: WordGridContainerProps) => {
  useTheme('wordGrid');
  const { user } = useAuth();
  const { triggerToast, allProfiles, profile } = useApp();

  const {
    matchId,
    gridSize,
    status,
    board,
    rack,
    placedTiles,
    currentTurn,
    currentTurnIndex,
    role,
    moves,
    players,
    player1,
    player2,
    view,
    setView,
    resetGame,
    moveTileInGrid,
    placeTile,
    placeBlankAs,
    recallTile,
    recallAllTiles,
    shuffleRack,
    submitMove,
    exchangeTiles,
    resignMatch,
  } = useWordGridStore();

  const tileBag = useWordGridStore((s: any) => s.tileBag);
  const p1Score = useWordGridStore((s: any) => s.p1Score);
  const p2Score = useWordGridStore((s: any) => s.p2Score);
  const reorderRack = useWordGridStore((s: any) => s.reorderRack);
  const loading = useWordGridStore((s: any) => s.loading);
  const lastMove = useWordGridStore((s: any) => s.lastMove);
  const conflictCoords = useWordGridStore((s: any) => s.conflictCoords);

  const isBotThinking = useWordGridStore((s: any) => s.isBotThinking);
  const lastBotMove = useWordGridStore((s: any) => s.lastBotMove);

  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [pickerCell, setPickerCell] = useState<{ x: number; y: number } | null>(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeSelections, setExchangeSelections] = useState<boolean[]>([]);
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('wordgrid_tutorial_completed');
  });

  const isBotMatch = useWordGridStore((s: any) => s.isBotMatch);
  const effectiveUserId = user?.id || (isBotMatch ? (player1?.id || 'p1') : 'guest');
  const userId = effectiveUserId;
  const isMyTurn = status === 'active' && (
    currentTurn === userId ||
    (isBotMatch && currentTurn !== 'bot') ||
    (players.length > 0 && players[currentTurnIndex]?.id === userId) ||
    (players.length > 0 && currentTurnIndex === 0 && (role === 'player1' || !role))
  );

  const handleTutorialComplete = () => {
    localStorage.setItem('wordgrid_tutorial_completed', 'true');
    setShowTutorial(false);
  };

  // Active players list for scores header
  const activePlayersList = players.length > 0
    ? players
    : [
      { id: player1?.id || 'p1', username: player1?.username || 'Player 1', score: p1Score, rack: [] },
      { id: player2?.id || 'p2', username: player2?.username || 'Player 2', score: p2Score, rack: [] },
    ];

  // Deterministic per-user color schemes shared across header, timeline & board
  const colorMap = buildPlayerColorMap(activePlayersList.map((p: any) => p.id));

  // Profile lookup (usernames/avatars) for the play timeline & notifications
  const profileLookup: Record<string, { username?: string; avatar_url?: string | null }> = {};
  allProfiles.forEach((p: any) => {
    if (p?.id) profileLookup[p.id] = { username: p.username, avatar_url: p.avatar_url };
  });
  [player1, player2].forEach((p: any) => {
    if (p?.id) profileLookup[p.id] = { username: p.username, avatar_url: p.avatar_url };
  });

  // Latest identity context for async event handlers (splash notifications)
  const identityRef = useRef<{
    players: any[];
    lookup: Record<string, { username?: string; avatar_url?: string | null }>;
  }>({ players: activePlayersList, lookup: profileLookup });
  useEffect(() => {
    identityRef.current = { players: activePlayersList, lookup: profileLookup };
  });

  // Resolve a player's display name from live state, formatted app-wide
  const resolvePlayerDisplayName = (playerId?: string, fallback?: string): string => {
    if (!playerId || playerId === 'bot') return fallback || 'Opponent';
    const { players: ps, lookup } = identityRef.current;
    const rawName =
      ps.find((p: any) => p?.id === playerId)?.username ||
      lookup[playerId]?.username;
    if (rawName) return formatUsername(rawName);
    if (fallback && fallback !== 'Opponent') return formatUsername(fallback);
    return 'Opponent';
  };



  // Preload Scrabble dictionary into IndexedDB / memory
  useEffect(() => {
    loadScrabbleDictionary().catch(err => {
      console.warn('Scrabble dictionary preload warning:', err);
    });
  }, []);

  // Subscribe to match updates when matchId changes
  useEffect(() => {
    if (!matchId || !effectiveUserId) return;

    const channel = supabase
      .channel(`wordgrid_match_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wordgrid_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          useWordGridStore.getState().updateFromMatchRecord(payload.new, effectiveUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, effectiveUserId]);

  // Auto-play bot move when it's the bot's turn
  useEffect(() => {
    if (status === 'active' && isBotMatch && currentTurn === 'bot' && !isBotThinking) {
      const timer = setTimeout(() => {
        useWordGridStore.getState().playBotTurn();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [status, isBotMatch, currentTurn, isBotThinking]);

  const myUsername = profile?.username || user?.user_metadata?.username || 'You';
  const { presenceMap, setSelfPlacing } = useWordGridPresence(
    matchId,
    effectiveUserId,
    myUsername,
    status === 'active' && !isBotMatch
  );

  // Auto-broadcast placing state when local player places tiles
  useEffect(() => {
    if (placedTiles.length > 0) {
      setSelfPlacing(true);
    }
  }, [placedTiles.length, setSelfPlacing]);

  const handleSelectTile = (idx: number) => {
    setSelectedRackIdx(idx < 0 ? null : idx);
    if (idx >= 0) {
      setSelfPlacing(true);
    }
  };

  // Tiles can be arranged any time (even off-turn) for strategizing; only
  // submission/exchange remain turn-gated.
  const handlePlaceTile = (x: number, y: number, rackIdx: number) => {
    const letter = rack[rackIdx];
    if (letter !== undefined) {
      placeTile(x, y, letter);
      setSelectedRackIdx(null);
      setSelfPlacing(true);
    }
  };

  // Empty-cell tap with no (or a blank) tile selected → Scrabble letter picker
  const handlePickLetterForCell = (x: number, y: number) => {
    setPickerCell({ x, y });
    setSelfPlacing(true);
  };

  const handlePickerChoose = (chosen: string) => {
    if (!pickerCell) return;
    const letter = chosen.toUpperCase();
    const blankPreSelected = selectedRackIdx !== null && rack[selectedRackIdx] === '_';
    if (blankPreSelected || !rack.includes(letter)) {
      const ok = placeBlankAs(pickerCell.x, pickerCell.y, letter);
      if (!ok) {
        triggerToast('No blank tile available.', TOAST_DURATION.SHORT);
        return;
      }
    } else {
      placeTile(pickerCell.x, pickerCell.y, letter);
    }
    setPickerCell(null);
    setSelectedRackIdx(null);
    setSelfPlacing(true);
  };

  const handleRecallTile = (x: number, y: number) => {
    recallTile(x, y);
    setSelfPlacing(true);
  };

  // Potential score preview calculated in real-time as tiles are placed on the grid
  const potentialScore = useMemo(() => {
    if (!placedTiles || placedTiles.length === 0) return null;
    const validation = validateBoardPlacement(placedTiles, board, gridSize);
    if (!validation.isValid || !validation.wordsFormed || validation.wordsFormed.length === 0) {
      return null;
    }
    const currentActiveRackSize = (rack?.length ?? 0) + placedTiles.length;
    const scoreRes = calculateTurnScore(validation.wordsFormed, currentActiveRackSize, board, gridSize);
    return {
      score: scoreRes.totalScore,
      isBingo: scoreRes.bingoApplied,
      words: scoreRes.words,
    };
  }, [placedTiles, board, gridSize, rack?.length]);

  const [isValidatingWord, setIsValidatingWord] = useState(false);

  const handleSubmit = async () => {
    if (placedTiles.length === 0 || isValidatingWord) return;
    setIsValidatingWord(true);
    setSelfPlacing(false);
    try {
      await submitMove(effectiveUserId, triggerToast);
    } finally {
      setIsValidatingWord(false);
    }
  };

  const handleOpenExchange = () => {
    // Recall any placed tiles back to rack first so full rack is available to swap
    recallAllTiles();
    setExchangeSelections(Array(rack.length + placedTiles.length).fill(false));
    setShowExchangeModal(true);
  };

  const handleToggleExchangeSelection = (idx: number) => {
    const next = [...exchangeSelections];
    next[idx] = !next[idx];
    setExchangeSelections(next);
  };

  const [splashMove, setSplashMove] = useState<{
    playerName: string;
    word: string;
    score: number;
    isSwap?: boolean;
  } | null>(null);

  useEffect(() => {
    let timer: any = null;
    const handleOpponentMove = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && detail.word) {
        setSplashMove({
          ...detail,
          playerName: resolvePlayerDisplayName(detail.playerId, detail.playerName),
        });
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setSplashMove(null);
        }, 4500);
      }
    };
    window.addEventListener('opponent-played-move', handleOpponentMove);
    return () => {
      window.removeEventListener('opponent-played-move', handleOpponentMove);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleConfirmExchange = async () => {
    // Current working rack after recalling all placed tiles
    const fullRack = [...rack, ...placedTiles.map((t: any) => t.letter)];
    const selectedLetters = fullRack.filter((_: string, idx: number) => exchangeSelections[idx]);
    if (selectedLetters.length === 0) {
      triggerToast("Select at least one tile to swap.");
      return;
    }
    setShowExchangeModal(false);
    await exchangeTiles(effectiveUserId, selectedLetters, triggerToast);
  };

  const handleResign = async () => {
    if (window.confirm('Are you sure you want to resign the match?')) {
      await resignMatch(effectiveUserId);
      triggerToast('You resigned the match.');
    }
  };

  const handleBackToLobby = () => {
    resetGame();
    setView('lobby');
  };

  if (view === 'lobby' || view === 'matchmaking') {
    return (
      <div className="h-[#100%] w-full flex items-center justify-center select-none px-2 md:px-6">
        <MatchmakingLobby userId={effectiveUserId} allProfiles={allProfiles} onBack={onBackToClassic} />
      </div>
    );
  }

  return (
    <div
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
      className="h-full w-full flex flex-col items-center justify-start bg-[#101828] overflow-y-auto pb-10 scrollbar-hide px-3 pt-12 sm:pt-14 md:pt-6 space-y-4 mx-auto select-none relative"
    >
      {showTutorial && (
        <WordGridTutorialModal
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />
      )}

      {/* Opponent / Bot Play Splash Notification */}
      <AnimatePresence>
        {splashMove && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pointer-events-auto cursor-pointer"
            onClick={() => setSplashMove(null)}
          >
            <div className="bg-linear-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 border-2 border-indigo-400/80 rounded-3xl p-4 shadow-[0_10px_35px_rgba(99,102,241,0.4)] backdrop-blur-md flex items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xl shadow-inner shrink-0 animate-bounce">
                  {splashMove.playerName.includes("Bot") ? "🤖" : "⚔️"}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 truncate">
                    {splashMove.playerName} {splashMove.isSwap ? 'swapped tiles' : 'just played'}
                  </span>
                  {!splashMove.isSwap && (
                    <span className="text-base font-black tracking-wide text-white truncate drop-shadow-md">
                      "{splashMove.word.toUpperCase()}"
                    </span>
                  )}
                </div>
              </div>

              {!splashMove.isSwap && (
                <div className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 rounded-2xl text-xs font-black uppercase shadow-lg shrink-0">
                  +{splashMove.score} pts
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bot Move Splash Notification */}
      {lastBotMove && !splashMove && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-4 zoom-in-95 duration-300 px-4 w-full max-w-sm">
          <div className="bg-linear-to-r from-emerald-900/95 via-teal-900/95 to-slate-900/95 border-2 border-emerald-400 rounded-3xl p-4 shadow-2xl shadow-emerald-950/80 backdrop-blur-md flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-xl shadow-inner animate-bounce">
                🤖
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Bot Played</span>
                <span className="text-base font-black tracking-wide text-white drop-shadow-md">
                  {lastBotMove.word.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase shadow-md">
              +{lastBotMove.score} pts
            </div>
          </div>
        </div>
      )}

      {/* Responsive Layout: Mobile flex ordering (Banner -> Actions & Rack -> Board -> Timeline), Desktop 12-column Grid */}
      <div className="w-full max-w-none md:px-6 flex flex-col md:grid md:grid-cols-12 gap-5 items-start">

        {/* Banner Header (Mobile: 1st, Desktop: top of left column) */}
        <div className="order-1 md:col-span-5 w-full max-w-[480px] mx-auto md:max-w-none">
          <div className="w-full bg-[#0c121e]/95 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 animate-in fade-in duration-300">

            {/* Top row: Back button, Title & Mode info */}
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={handleBackToLobby}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
                >
                  ← Back
                </button>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">WordGrid</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded-md">
                    {gridSize}×{gridSize}
                  </span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-950/80 border border-amber-800 text-amber-300 rounded-md flex items-center gap-1">
                    🎒 Bag: {tileBag?.length ?? 0}
                  </span>
                </div>
              </div>

              {status !== 'completed' && status !== 'abandoned' && (
                <button
                  onClick={handleResign}
                  className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                >
                  Resign
                </button>
              )}
            </div>

            {/* Bottom row: Turn status & Player scores */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 w-full">
              {(() => {
                // Find if an opponent is currently active or placing tiles
                const opponentEntries = Object.entries(presenceMap).filter(([pId]) => pId !== effectiveUserId);
                const activePlacer = opponentEntries.find(([_, data]) => data.isPlacing);
                const isAnyOpponentInGame = opponentEntries.some(([_, data]) => data.inGame);

                if (status === 'completed') {
                  return <span className="text-[11px] font-black text-slate-400">🏁 Match Finished (Preview)</span>;
                }
                if (status === 'abandoned') {
                  return <span className="text-[11px] font-black text-slate-400">⌛ Match Expired (Preview)</span>;
                }
                if (isBotMatch) {
                  return (
                    <span className={`text-[11px] font-black leading-tight truncate ${isMyTurn ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                      {isMyTurn ? '🔥 Your Turn' : isBotThinking || currentTurn === 'bot' ? '🤖 Bot is thinking...' : 'Waiting for move...'}
                    </span>
                  );
                }

                if (activePlacer) {
                  const placerName = activePlacer[1].username || 'Opponent';
                  return (
                    <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5 animate-pulse">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      ⚡ {placerName} is placing tiles...
                    </span>
                  );
                }

                if (isMyTurn) {
                  return (
                    <span className="text-[11px] font-black text-amber-400 flex items-center gap-1.5 animate-pulse">
                      🔥 Your Turn
                    </span>
                  );
                }

                return (
                  <span className="text-[11px] font-black text-slate-400 flex items-center gap-1.5">
                    {isAnyOpponentInGame ? (
                      <>
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                        Opponent is in game
                      </>
                    ) : (
                      'Waiting for opponent...'
                    )}
                  </span>
                );
              })()}

              <div className="flex items-center gap-2 bg-[#101828]/90 px-3 py-1.5 border border-slate-800 rounded-2xl shadow-inner flex-wrap">
                {activePlayersList.map((p: any, i: number) => {
                  const pId = p?.id ? String(p.id) : `p-${i}`;
                  const isYou = pId === userId;
                  const isCurrent = currentTurn === pId && status === 'active';
                  const scheme = colorMap[pId];
                  const avatarUrl = p?.avatar_url || profileLookup[pId]?.avatar_url;
                  const displayName = isYou ? 'You' : (p?.username || profileLookup[pId]?.username || 'Player');
                  const isOpponentInMatch = !isYou && presenceMap[pId]?.inGame;
                  const isOpponentPlacingTiles = !isYou && presenceMap[pId]?.isPlacing;

                  return (
                    <div key={pId} className="flex items-center gap-1.5 text-[10px] font-black">
                      {i > 0 && <span className="text-slate-700 font-bold">•</span>}
                      <div className="flex items-center gap-1 relative">
                        {pId !== 'bot' && !pId.startsWith('bot') ? (
                          <div className="relative">
                            <ProtectedAvatar
                              userId={pId}
                              src={avatarUrl || undefined}
                              username={displayName}
                              className={`w-5 h-5 rounded-full border ${isCurrent ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-slate-700'}`}
                            />
                            {/* Live online dot indicator */}
                            {!isYou && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                                  isOpponentPlacingTiles
                                    ? 'bg-amber-400 animate-ping'
                                    : isOpponentInMatch
                                    ? 'bg-emerald-400 shadow-xs'
                                    : 'bg-slate-600'
                                }`}
                                title={isOpponentPlacingTiles ? 'Placing tiles' : isOpponentInMatch ? 'In game' : 'Offline'}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs">🤖</span>
                        )}
                        <span className={`${isCurrent ? `${scheme?.name || 'text-slate-400'} font-extrabold` : scheme?.name || 'text-slate-400'}`}>
                          {displayName}:
                        </span>
                      </div>
                      <span className={`text-xs font-black ${isCurrent ? 'text-white' : 'text-slate-200'}`}>{p?.score ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Board Grid Column (Mobile: 2nd, Desktop: Right column md:col-span-7) */}
        <div className="order-2 md:order-none md:col-span-7 md:col-start-6 md:row-start-1 md:row-span-4 flex flex-col items-center justify-center w-full space-y-3">
          <BoardGrid
            gridSize={gridSize}
            board={board}
            placedTiles={placedTiles}
            selectedIdx={selectedRackIdx}
            conflictCoords={conflictCoords}
            lastMove={lastMove}
            colorMap={colorMap}
            rackLetters={rack}
            onMoveTileInGrid={moveTileInGrid}
            onPlaceTile={handlePlaceTile}
            onPickLetterForCell={handlePickLetterForCell}
            onRecallTile={handleRecallTile}
          />

          {/* Action panel: Play Word vs Swap Tiles directly attached to the Grid for maximum ergonomics */}
          {isMyTurn && (
            <div className="w-full max-w-[480px] grid grid-cols-2 gap-2.5 animate-in fade-in duration-200 px-1">
              <button
                onClick={handleSubmit}
                disabled={placedTiles.length === 0 || isValidatingWord}
                className={`py-3.5 px-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 ${isValidatingWord
                  ? 'bg-indigo-700 text-white animate-pulse border border-indigo-500'
                  : placedTiles.length > 0
                    ? 'bg-linear-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/30 border border-indigo-400'
                    : 'bg-[#0c121e] text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                  }`}
              >
                {isValidatingWord ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                    <span className="truncate">Playing...</span>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 truncate">
                    <span>Play Word</span>
                    {potentialScore !== null && potentialScore.score > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-black tracking-normal">
                        +{potentialScore.score} pts{potentialScore.isBingo ? ' 🎉' : ''}
                      </span>
                    ) : (
                      placedTiles.length > 0 && (
                        <span className="text-[10px] opacity-75 font-bold">
                          ({placedTiles.length})
                        </span>
                      )
                    )}
                  </div>
                )}
              </button>
              <button
                onClick={handleOpenExchange}
                className="py-3.5 px-3 bg-slate-900/90 hover:bg-slate-800 text-amber-300 rounded-2xl text-xs font-black uppercase tracking-wider border border-amber-500/30 hover:border-amber-400 transition-all active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>🔄 Swap Tiles</span>
              </button>
            </div>
          )}
        </div>

        {/* Tile Rack & Bot Status (Mobile: 3rd, Desktop: 2nd block of left column) */}
        <div className="order-3 md:col-span-5 md:col-start-1 flex flex-col space-y-4 w-full max-w-[480px] mx-auto md:max-w-none">
          {/* Bot Thinking Banner Indicator */}
          {isBotMatch && (isBotThinking || currentTurn === 'bot') && status === 'active' && (
            <div className="w-full bg-linear-to-r from-emerald-950/90 via-teal-950/90 to-emerald-950/90 border border-emerald-500/60 rounded-2xl p-3 flex items-center justify-center gap-3 shadow-lg shadow-emerald-950/50 animate-pulse">
              <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
              <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">
                🤖 AI Bot is thinking of a move...
              </span>
            </div>
          )}

          {/* Tile Rack */}
          <TileRack
            rack={rack}
            selectedIdx={selectedRackIdx}
            onSelectTile={handleSelectTile}
            onShuffle={shuffleRack}
            onRecallAll={recallAllTiles}
            isMyTurn={isMyTurn}
            onReorderRack={reorderRack}
          />
        </div>

        {/* Move History / Timeline (Mobile: 4th/Bottom, Desktop: 3rd block of left column) */}
        <div className="order-4 md:col-span-5 md:col-start-1 flex flex-col space-y-4 w-full max-w-[480px] mx-auto md:max-w-none">
          <MoveHistory
            moves={moves}
            player1={player1}
            player2={player2}
            players={activePlayersList}
            currentUserId={userId}
            profileLookup={profileLookup}
          />
        </div>

      </div>

      {/* Scrabble Letter Picker for empty cells / blanks */}
      <LetterPickerModal
         open={!!pickerCell}
         rack={rack}
         blankPreSelected={selectedRackIdx !== null && rack[selectedRackIdx] === '_'}
         onClose={() => setPickerCell(null)}
         onChoose={handlePickerChoose}
      />

      {/* Exchange Selection Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c121e] border border-slate-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div>
              <h4 className="text-base font-black uppercase text-white tracking-wider">Swap Tiles</h4>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-1">
                Select tiles to trade back. <span className="text-rose-400">Swapping ends your turn!</span>
              </p>
            </div>

            <div className="flex justify-center gap-2 flex-wrap">
              {rack.map((letter: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleToggleExchangeSelection(idx)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black cursor-pointer transition-all ${exchangeSelections[idx]
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-lg scale-105'
                    : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
                    }`}
                >
                  {letter.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowExchangeModal(false)}
                className="py-3 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExchange}
                className="py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg"
              >
                Confirm Swap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Game Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-auto">
          <div className="bg-[#0c121e] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center text-center space-y-5 animate-in zoom-in-95 duration-200 select-none">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <span className="absolute text-xl animate-bounce">🔠</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black uppercase tracking-wider text-white">Loading Game...</h3>
              <p className="text-xs text-indigo-300 font-bold">Populating board & tile rack...</p>
              <p className="text-[10px] text-slate-400 font-medium">Please wait while the match initializes.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordGridContainer;


