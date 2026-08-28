/* eslint-disable @typescript-eslint/no-explicit-any */
// src/wordgrid/components/MoveHistory.tsx

import { useState } from 'react';
import { fetchWordDefinition } from '../../utils/wordgrid/dictionary';
import type { DictionaryDefinition } from '../../utils/wordgrid/dictionary';
import { buildPlayerColorMap } from '../../utils/wordgrid/playerColors';
import type { PlayerColorScheme } from '../../utils/wordgrid/playerColors';
import { ProtectedAvatar } from '../../components/chat/ProtectedAvatar';

interface MoveHistoryProps {
  moves: any[];
  player1: any;
  player2: any;
  players?: any[];
  currentUserId?: string;
  profileLookup?: Record<string, { username?: string; avatar_url?: string | null }>;
}

export const MoveHistory = ({ moves, player1, player2, players = [], currentUserId, profileLookup }: MoveHistoryProps) => {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<DictionaryDefinition | null>(null);
  const [loadingDef, setLoadingDef] = useState(false);

  const colorMap: Record<string, PlayerColorScheme> = buildPlayerColorMap([
    ...players.map((p) => p?.id),
    player1?.id,
    player2?.id,
    ...(moves || []).map((m) => m?.player_id),
  ]);

  const resolvePlayer = (id: string) => {
    if (id === 'bot') return { id, username: 'AI (Bot)', avatar_url: null as string | null };
    const fromPlayers = players.find((p) => p.id === id);
    const fromLookup = profileLookup?.[id];
    const isYou = !!currentUserId && id === currentUserId;
    const fallback =
      id === player1?.id ? player1 : id === player2?.id ? player2 : null;
    const username =
      fromPlayers?.username ||
      fromLookup?.username ||
      fallback?.username ||
      'Opponent';
    return {
      id,
      username: isYou ? 'You' : username,
      avatar_url: (fromPlayers?.avatar_url || fromLookup?.avatar_url || null) as
        | string
        | null,
    };
  };

  const schemeOf = (id: string): PlayerColorScheme =>
    colorMap[id] || buildPlayerColorMap([id])[id];

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

          const moveWord = typeof move?.word === 'string' ? move.word : '';
          const isPass = !moveWord || moveWord === 'PASS' || moveWord.startsWith('[') || moveWord.startsWith('SWAP');
          const hasBreakdown = !!move.breakdown;
          const hasBingo = typeof move.breakdown === 'string' && move.breakdown.includes('(Bingo)');

          // Extract all words formed on this turn (stored in move.word)
          const wordsFormedOnTurn = move.word ? move.word.split(',').map((w: string) => w.trim().toUpperCase()) : [];

          const player = resolvePlayer(move.player_id);
          const scheme = schemeOf(move.player_id);

          return (
            <div
              key={chronologicalIdx}
              className={`flex items-center justify-between p-2.5 rounded-xl text-xs gap-2.5 transition-all ${
                isLatestMove
                  ? `bg-slate-850/80 border-2 ${scheme.avatarBorder} shadow-lg`
                  : 'bg-slate-850/80 border border-slate-800 shadow-sm hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {/* Player avatar with per-user color ring */}
                <div className={`shrink-0 rounded-full border-2 ${scheme.avatarBorder}`}>
                  {move.player_id === 'bot' ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm">
                      🤖
                    </div>
                  ) : (
                    <ProtectedAvatar
                      userId={player.id}
                      src={player.avatar_url || undefined}
                      username={player.username}
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold uppercase truncate ${scheme.name}`}>
                      {player.username}
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
                          className={`px-2 py-0.5 rounded-md border transition-all underline cursor-pointer truncate shadow-xs ${scheme.chip}`}
                          title="Click to view dictionary definition"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-black text-right shrink-0">
                {!isPass && hasBingo && (
                  <span className="text-[7px] font-black uppercase px-1 py-0.5 bg-linear-to-r from-fuchsia-600 to-amber-500 text-white rounded-md tracking-wider shadow-xs animate-pulse" title="Used all rack tiles in one play!">
                    🎉 BINGO
                  </span>
                )}
                <span className={`text-[11px] ${isPass ? 'text-slate-500' : scheme.score}`}>
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

export default MoveHistory;
