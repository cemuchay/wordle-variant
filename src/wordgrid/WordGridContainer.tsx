import { useState, useEffect } from 'react';
import { useWordGridStore, flushPendingUploads } from '../store/useWordGridStore';
import { MatchmakingLobby } from './components/MatchmakingLobby';
import { BoardGrid } from './components/BoardGrid';
import { TileRack } from './components/TileRack';
import { MoveHistory } from './components/MoveHistory';
import { WordGridTutorialModal } from './components/WordGridTutorialModal';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';

interface WordGridContainerProps {
  onBackToClassic: () => void;
}

export const WordGridContainer = ({ onBackToClassic }: WordGridContainerProps) => {
  const { user } = useAuth();
  const { triggerToast, allProfiles } = useApp();

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
    recallTile,
    recallAllTiles,
    shuffleRack,
    submitMove,
    exchangeTiles,
    resignMatch,
    updateFromMatchRecord,
  } = useWordGridStore();

  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeSelections, setExchangeSelections] = useState<boolean[]>([]);
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('wordgrid_tutorial_completed');
  });

  const isBotMatch = useWordGridStore((s) => s.isBotMatch);
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

  // Flush any un-synced offline uploads on mount
  useEffect(() => {
    flushPendingUploads();
  }, []);

  // Resubscribe to match updates when matchId changes
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
          updateFromMatchRecord(payload.new, effectiveUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, effectiveUserId, updateFromMatchRecord]);

  const handleSelectTile = (idx: number) => {
    setSelectedRackIdx(idx);
  };

  const handlePlaceTile = (x: number, y: number, rackIdx: number) => {
    if (!isMyTurn) {
      triggerToast("It's your opponent's turn!");
      return;
    }
    const letter = rack[rackIdx];
    if (letter !== undefined) {
      placeTile(x, y, letter);
      setSelectedRackIdx(null);
    }
  };

  const handleRecallTile = (x: number, y: number) => {
    if (!isMyTurn) return;
    recallTile(x, y);
  };

  const handleSubmit = async () => {
    const success = await submitMove(effectiveUserId, triggerToast);
    if (!success) {
      // Keep placed tiles on validation error
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

  const handleConfirmExchange = async () => {
    // Current working rack after recalling all placed tiles
    const fullRack = [...rack, ...placedTiles.map(t => t.letter)];
    const selectedLetters = fullRack.filter((_, idx) => exchangeSelections[idx]);
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
      <div className="h-full w-full flex items-center justify-center p-4 bg-slate-950 select-none">
        <MatchmakingLobby userId={effectiveUserId} allProfiles={allProfiles} onBack={onBackToClassic} />
      </div>
    );
  }

  // Active players list for scores header
  const activePlayersList = players.length > 0
    ? players
    : [
        { id: player1?.id || 'p1', username: player1?.username || 'Player 1', score: useWordGridStore.getState().p1Score, rack: [] },
        { id: player2?.id || 'p2', username: player2?.username || 'Player 2', score: useWordGridStore.getState().p2Score, rack: [] },
      ];

  return (
    <div
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
      className="h-full w-full flex flex-col items-center justify-start bg-slate-950 overflow-y-auto pb-10 scrollbar-none px-3 pt-12 sm:pt-14 md:pt-6 space-y-4 mx-auto select-none"
    >
      {showTutorial && (
        <WordGridTutorialModal
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />
      )}

      {/* Responsive Grid Container: Mobile 1 column, Tablet/Desktop 12-column Side-by-Side layout */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* Left Column (Controls, Merged Header, Rack, Timeline on Desktop) */}
        <div className="md:col-span-5 flex flex-col space-y-4 w-full max-w-[480px] mx-auto md:max-w-none">
          {/* Merged Header with Back Button, Turn Info & Live Scores */}
          <div className="w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 animate-in fade-in duration-300">
            {/* Left section: Back button & Status */}
            <div className="flex items-center gap-3 min-w-0 shrink-0">
              <button
                onClick={handleBackToLobby}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
              >
                ← Back
              </button>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">WordGrid</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded-md">
                    {gridSize}×{gridSize}
                  </span>
                </div>
                <span className={`text-[11px] font-black leading-tight truncate mt-0.5 ${isMyTurn ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                  {status === 'completed' ? 'Match Finished' : isMyTurn ? '🔥 Your Turn' : 'Waiting for move...'}
                </span>
              </div>
            </div>

            {/* Right section: Scores & Resign */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 border border-slate-800 rounded-2xl shadow-inner">
                {activePlayersList.map((p, i) => {
                  const isYou = p.id === userId;
                  const isCurrent = currentTurn === p.id && status === 'active';
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 text-[10px] font-black">
                      {i > 0 && <span className="text-slate-700 font-bold">•</span>}
                      <span className={isCurrent ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}>
                        {isYou ? 'You' : p.username}:
                      </span>
                      <span className="text-white text-xs font-black">{p.score}</span>
                    </div>
                  );
                })}
              </div>

              {status !== 'completed' && (
                <button
                  onClick={handleResign}
                  className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                >
                  Resign
                </button>
              )}
            </div>
          </div>

          {/* Action panel: Play Word vs Swap Tiles */}
          {isMyTurn && (
            <div className="w-full grid grid-cols-2 gap-3 animate-in fade-in duration-300">
              <button
                onClick={handleSubmit}
                disabled={placedTiles.length === 0}
                className={`py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg ${
                  placedTiles.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95 border border-indigo-400'
                    : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
                }`}
              >
                Play Word ({placedTiles.length})
              </button>
              <button
                onClick={handleOpenExchange}
                className="py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider border border-amber-400 transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-600/20"
              >
                🔄 Swap Tiles
              </button>
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
          />

          {/* Move History */}
          <MoveHistory moves={moves} player1={player1} player2={player2} />
        </div>

        {/* Right Column: Centered Game Board Grid */}
        <div className="md:col-span-7 flex flex-col items-center justify-center w-full">
          <BoardGrid
            gridSize={gridSize}
            board={board}
            placedTiles={placedTiles}
            selectedIdx={selectedRackIdx}
            onMoveTileInGrid={moveTileInGrid}
            onPlaceTile={handlePlaceTile}
            onRecallTile={handleRecallTile}
          />
        </div>

      </div>

      {/* Exchange Selection Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div>
              <h4 className="text-base font-black uppercase text-white tracking-wider">Swap Tiles</h4>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider mt-1">
                Select tiles to trade back. <span className="text-rose-400">Swapping ends your turn!</span>
              </p>
            </div>

            <div className="flex justify-center gap-2 flex-wrap">
              {rack.map((letter, idx) => (
                <button
                  key={idx}
                  onClick={() => handleToggleExchangeSelection(idx)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black cursor-pointer transition-all ${
                    exchangeSelections[idx]
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
    </div>
  );
};

export default WordGridContainer;


