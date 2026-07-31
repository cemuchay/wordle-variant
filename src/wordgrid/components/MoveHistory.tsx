// src/wordgrid/components/MoveHistory.tsx

import { useState } from 'react';
import { fetchWordDefinition } from '../../utils/wordgrid/dictionary';
import type { DictionaryDefinition } from '../../utils/wordgrid/dictionary';

interface MoveHistoryProps {
  moves: any[];
  player1: any;
  player2: any;
}

export const MoveHistory = ({ moves, player1, player2 }: MoveHistoryProps) => {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<DictionaryDefinition | null>(null);
  const [loadingDef, setLoadingDef] = useState(false);

  const getUsername = (id: string) => {
    if (id === player1?.id) return player1?.username || 'Player 1';
    if (id === player2?.id) return player2?.username || 'Player 2';
    if (id === 'bot') return 'AI (Bot)';
    return 'Opponent';
  };

  const handleWordClick = async (wordStr: string) => {
    // A move can contain comma separated words, let's grab the first clean word
    const cleanWord = wordStr.split(',')[0].trim().toUpperCase();
    if (!cleanWord || cleanWord === 'PASS') return;

    setSelectedWord(cleanWord);
    setLoadingDef(true);
    setDefinition(null);
    try {
      const def = await fetchWordDefinition(cleanWord);
      setDefinition(def);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDef(false);
    }
  };

  const [selectedBreakdown, setSelectedBreakdown] = useState<{ word: string; breakdown: string; score: number } | null>(null);

  return (
    <div className="w-full max-w-[420px] bg-slate-900/60 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col space-y-3 select-none mx-auto">
      <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Play Timeline</span>

      <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-hide">
        {moves.slice().reverse().map((move, reverseIdx) => {
          const chronologicalIdx = moves.length - 1 - reverseIdx;
          const isLatestMove = reverseIdx === 0;

          const isPass = !move.word || move.word === 'PASS' || move.word.startsWith('[') || move.word.startsWith('SWAP');
          const hasBreakdown = !!move.breakdown;

          // Extract all words formed on this turn (stored in move.word)
          const wordsFormedOnTurn = move.word ? move.word.split(',').map((w: string) => w.trim().toUpperCase()) : [];

          return (
            <div
              key={chronologicalIdx}
              className={`flex items-center justify-between p-2.5 rounded-xl text-xs gap-2.5 transition-all ${
                isLatestMove
                  ? 'bg-indigo-950/70 border border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                  : 'bg-slate-850/80 border border-slate-800 shadow-sm hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase truncate">
                    {getUsername(move.player_id)}
                  </span>
                  {isLatestMove && !isPass && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-emerald-500 text-slate-950 rounded-md tracking-wider shadow-xs animate-pulse">
                      LATEST PLAY
                    </span>
                  )}
                </div>

                {isPass ? (
                  <span className="text-slate-500 font-black italic text-[11px] truncate">{move.word || 'PASSED'}</span>
                ) : (
                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-black">
                    {wordsFormedOnTurn.map((w: string, wIdx: number) => (
                      <button
                        key={wIdx}
                        onClick={() => handleWordClick(w)}
                        className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/80 hover:text-white transition-all underline cursor-pointer truncate shadow-xs"
                        title="Click to view dictionary definition"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 font-black text-right shrink-0">
                <span className={`text-[11px] ${isPass ? 'text-slate-500' : isLatestMove ? 'text-emerald-300 font-extrabold' : 'text-emerald-400'}`}>
                  {isPass ? '0' : `+${move.score}`} pts
                </span>
                {hasBreakdown && (
                  <button
                    onClick={() => setSelectedBreakdown({ word: move.word, breakdown: move.breakdown, score: move.score })}
                    className="w-4 h-4 rounded-full bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 flex items-center justify-center text-[9px] font-black cursor-pointer transition-colors shadow-xs"
                    title="View tile scoring breakdown"
                  >
                    i
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {moves.length === 0 && (
          <div className="text-center py-6 text-xs text-gray-500 font-bold uppercase tracking-wider">
            No moves played yet
          </div>
        )}
      </div>

      {/* Dictionary Definition Modal */}
      {selectedWord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex flex-col">
                <h4 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                  {selectedWord}
                </h4>
                {definition?.partOfSpeech && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">
                    {definition.partOfSpeech}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedWord(null)}
                className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[10px] text-white/60 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingDef ? (
              <div className="py-6 text-center text-xs text-gray-400 animate-pulse font-bold">
                Fetching definition...
              </div>
            ) : (
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                {definition?.definition}
              </p>
            )}

            <button
              onClick={() => setSelectedWord(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Score Decision Breakdown Modal */}
      {selectedBreakdown && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-emerald-500/30 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex flex-col">
                <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                  Score Breakdown
                </h4>
                <span className="text-[10px] font-black text-white/70">
                  {selectedBreakdown.word} (+{selectedBreakdown.score} pts)
                </span>
              </div>
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[10px] text-white/60 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1.5 font-mono text-[11px] text-emerald-300 leading-relaxed break-words">
              {selectedBreakdown.breakdown}
            </div>

            <button
              onClick={() => setSelectedBreakdown(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
