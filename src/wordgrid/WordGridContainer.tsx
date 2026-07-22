// src/wordgrid/WordGridContainer.tsx

import { useState, useEffect } from 'react';
import { useWordGridStore } from '../store/useWordGridStore';
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
    moves,
    players,
    player1,
    player2,
    view,
    setView,
    resetGame,
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

  const userId = user?.id || '';
  const isMyTurn = currentTurn === userId && status === 'active';

  const handleTutorialComplete = () => {
    localStorage.setItem('wordgrid_tutorial_completed', 'true');
    setShowTutorial(false);
  };


  // Resubscribe to match updates when matchId changes
  useEffect(() => {
    if (!matchId || !userId) return;

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
          updateFromMatchRecord(payload.new, userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, userId, updateFromMatchRecord]);

  const handleSelectTile = (idx: number) => {
    setSelectedRackIdx(idx);
  };

  const handlePlaceTile = (x: number, y: number, rackIdx: number) => {
    const letter = rack[rackIdx];
    placeTile(x, y, letter);
    if (selectedRackIdx === rackIdx) {
      setSelectedRackIdx(null);
    }
  };

  const handleRecallTile = (x: number, y: number) => {
    recallTile(x, y);
  };

  const handleSubmit = async () => {
    const success = await submitMove(userId, triggerToast);
    if (!success) {
      // Keep placed tiles on validation error
    }
  };

  const handleOpenExchange = () => {
    setExchangeSelections(Array(rack.length).fill(false));
    setShowExchangeModal(true);
  };

  const handleToggleExchangeSelection = (idx: number) => {
    const next = [...exchangeSelections];
    next[idx] = !next[idx];
    setExchangeSelections(next);
  };

  const handleConfirmExchange = async () => {
    const selectedLetters = rack.filter((_, idx) => exchangeSelections[idx]);
    if (selectedLetters.length === 0) {
      setShowExchangeModal(false);
      return;
    }
    await exchangeTiles(userId, selectedLetters, triggerToast);
    setShowExchangeModal(false);
  };

  const handleResign = async () => {
    if (window.confirm('Are you sure you want to resign the match?')) {
      await resignMatch(userId);
      triggerToast('You resigned the match.');
    }
  };

  const handleBackToLobby = () => {
    resetGame();
    setView('lobby');
  };

  if (view === 'lobby' || view === 'matchmaking') {
    return (
      <div className="h-full w-full flex items-center justify-center p-4 bg-slate-950">
        <MatchmakingLobby userId={userId} allProfiles={allProfiles} onBack={onBackToClassic} />
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
    <div className="h-full w-full flex flex-col items-center justify-start bg-slate-950 overflow-y-auto pb-10 scrollbar-none px-3 space-y-4 mx-auto">
      {showTutorial && (
        <WordGridTutorialModal
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />
      )}

      {/* Gameplay Header */}
      <div className="w-full max-w-[480px] bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-2xl animate-in fade-in duration-300">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">WordGrid</span>
            <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded-md">
              {gridSize}×{gridSize}
            </span>
          </div>
          <span className="text-xs text-white font-black mt-0.5">
            {status === 'completed' ? 'Match Finished' : isMyTurn ? '🔥 Your Turn' : 'Waiting for Opponent...'}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'completed' ? (
            <button
              onClick={handleBackToLobby}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Lobby
            </button>
          ) : (
            <button
              onClick={handleResign}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Resign
            </button>
          )}
        </div>
      </div>

      {/* Scores panel */}
      <div className="w-full max-w-[480px] bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-around shadow-2xl divide-x divide-slate-800 animate-in fade-in duration-300">
        {activePlayersList.map((p) => {
          const isCurrent = currentTurn === p.id && status === 'active';
          const isYou = p.id === userId;

          return (
            <div key={p.id} className="flex flex-col items-center px-3 flex-1 text-center min-w-0">
              <span className={`text-[10px] font-black uppercase tracking-wider truncate max-w-full ${
                isCurrent ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {p.username} {isYou && '(You)'}
              </span>
              <span className="text-2xl font-black text-white drop-shadow mt-0.5">{p.score}</span>
            </div>
          );
        })}
      </div>

      {/* Centered Board */}
      <BoardGrid
        gridSize={gridSize}
        board={board}
        placedTiles={placedTiles}
        selectedIdx={selectedRackIdx}
        onPlaceTile={handlePlaceTile}
        onRecallTile={handleRecallTile}
      />

      {/* Action panel: Play Word vs Swap Tiles (No pass button) */}
      {isMyTurn && (
        <div className="w-full max-w-[480px] grid grid-cols-2 gap-3 animate-in fade-in duration-300">
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

