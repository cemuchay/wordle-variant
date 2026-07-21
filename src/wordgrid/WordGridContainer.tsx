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
    role,
    status,
    board,
    rack,
    placedTiles,
    currentTurn,
    p1Score,
    p2Score,
    moves,
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
    passTurn,
    exchangeTiles,
    resignMatch,
    updateFromMatchRecord,
  } = useWordGridStore();

  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeSelections, setExchangeSelections] = useState<boolean[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);

  const userId = user?.id || '';
  const isMyTurn = currentTurn === userId && status === 'active';

  // Check first-time guide on load
  useEffect(() => {
    const isCompleted = localStorage.getItem('wordgrid_tutorial_completed');
    if (!isCompleted) {
      setShowTutorial(true);
    }
  }, []);

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

  const handlePass = async () => {
    if (window.confirm('Are you sure you want to pass your turn?')) {
      await passTurn(userId);
      triggerToast('You passed your turn.');
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
    await exchangeTiles(userId, selectedLetters);
    setShowExchangeModal(false);
    triggerToast(`Exchanged ${selectedLetters.length} tiles.`);
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
      <div className="h-full flex items-center justify-center p-4 bg-dark">
        <MatchmakingLobby userId={userId} allProfiles={allProfiles} onBack={onBackToClassic} />
      </div>
    );
  }

  const p1Username = player1?.username || 'Player 1';
  const p2Username = player2?.username || 'Player 2';

  return (
    <div className="h-full w-full flex flex-col bg-dark overflow-y-auto pb-8 scrollbar-none px-2 space-y-4">
      {showTutorial && (
        <WordGridTutorialModal
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialComplete}
        />
      )}

      {/* Gameplay Header */}
      <div className="w-full max-w-[420px] mx-auto bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-xl animate-in fade-in duration-300">
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">WordGrid</span>
          <span className="text-xs text-white font-black">
            {status === 'completed' ? 'Match Finished' : isMyTurn ? 'Your Turn' : 'Waiting for Opponent'}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'completed' ? (
            <button
              onClick={handleBackToLobby}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Exit to Lobby
            </button>
          ) : (
            <button
              onClick={handleResign}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Resign
            </button>
          )}
        </div>
      </div>

      {/* Scores panel */}
      <div className="w-full max-w-[420px] mx-auto bg-slate-900/60 border border-white/10 rounded-2xl p-4 grid grid-cols-2 gap-4 text-center shadow-xl divide-x divide-white/5 animate-in fade-in duration-300">
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-white uppercase tracking-widest truncate max-w-full">
            {p1Username} {role === 'player1' && '(You)'}
          </span>
          <span className="text-2xl font-black text-white">{p1Score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-white uppercase tracking-widest truncate max-w-full">
            {p2Username} {role === 'player2' && '(You)'}
          </span>
          <span className="text-2xl font-black text-white">{p2Score}</span>
        </div>
      </div>

      {/* Board */}
      <BoardGrid
        board={board}
        placedTiles={placedTiles}
        selectedIdx={selectedRackIdx}
        onPlaceTile={handlePlaceTile}
        onRecallTile={handleRecallTile}
      />

      {/* Action panel */}
      {isMyTurn && (
        <div className="w-full max-w-[420px] mx-auto grid grid-cols-3 gap-2 animate-in fade-in duration-300">
          <button
            onClick={handleSubmit}
            disabled={placedTiles.length === 0}
            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${placedTiles.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95'
                : 'bg-slate-800 text-black border border-slate-700/50 cursor-not-allowed opacity-50'
              }`}
          >
            Submit Move
          </button>
          <button
            onClick={handleOpenExchange}
            className="py-3 bg-white hover:bg-gray-100 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
          >
            Exchange
          </button>
          <button
            onClick={handlePass}
            className="py-3 bg-white hover:bg-gray-100 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
          >
            Pass
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div>
              <h4 className="text-sm font-black uppercase text-white tracking-wider">Exchange Tiles</h4>
              <p className="text-[10px] text-white font-black uppercase tracking-wider mt-1">Select tiles to trade back to bag</p>
            </div>

            <div className="flex justify-center gap-1.5 flex-wrap">
              {rack.map((letter, idx) => (
                <button
                  key={idx}
                  onClick={() => handleToggleExchangeSelection(idx)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black cursor-pointer transition-all ${exchangeSelections[idx]
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                    }`}
                >
                  {letter.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowExchangeModal(false)}
                className="py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-[9px] font-black uppercase text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExchange}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Exchange
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default WordGridContainer;
