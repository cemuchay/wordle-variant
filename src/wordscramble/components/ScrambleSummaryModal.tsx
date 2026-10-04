import React from 'react';
import type { ScrambleGameState } from '../engine/types';
import { ModalLayout } from '../../components/layout/ModalLayout';
import { Trophy, Flame, RotateCcw, Share2, BookOpen } from 'lucide-react';

interface ScrambleSummaryModalProps {
  isOpen: boolean;
  gameState: ScrambleGameState;
  onPlayAgain: () => void;
  onReturnToLobby?: () => void;
  onOpenSettings?: () => void;
}

export const ScrambleSummaryModal: React.FC<ScrambleSummaryModalProps> = ({
  isOpen,
  gameState,
  onPlayAgain,
  onReturnToLobby,
}) => {
  if (!isOpen) return null;

  const handleShare = () => {
    const text = `🌈 Word Scramble Matrix\nScore: ${gameState.score.toLocaleString()} pts\nWords Found: ${
      gameState.foundWords.length
    }\nHighest Streak: ${gameState.highestStreak}x\nMode: ${
      gameState.config.mode
    } (${gameState.config.selectedLengths.map((l) => `${l}L`).join(', ')})`;

    if (navigator.share) {
      navigator.share({ title: 'Word Scramble Score', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Score copied to clipboard!');
    }
  };

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onReturnToLobby}
      showCloseButton={false}
      maxWidth="md"
      containerClassName="bg-slate-900 border border-indigo-500/40 shadow-[0_0_60px_rgba(99,102,241,0.3)] text-slate-100 p-4 sm:p-6"
    >
      <div className="text-center mb-4 sm:mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 text-slate-950 font-black mb-2 shadow-[0_0_25px_rgba(251,146,60,0.6)]">
          <Trophy className="w-8 h-8 sm:w-9 sm:h-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-cyan-400">
          Game Over!
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1">
          Excellent game! Here is your performance breakdown:
        </p>
      </div>

      {/* Big Score Card */}
      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
          <div className="text-[10px] font-bold uppercase text-slate-400">Final Score</div>
          <div className="text-xl font-black text-amber-300 mt-0.5">
            {gameState.score.toLocaleString()}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
          <div className="text-[10px] font-bold uppercase text-slate-400">Words Found</div>
          <div className="text-xl font-black text-cyan-300 mt-0.5">
            {gameState.foundWords.length}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
          <div className="text-[10px] font-bold uppercase text-slate-400">Best Streak</div>
          <div className="text-xl font-black text-rose-400 mt-0.5 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-current" />
            <span>{gameState.highestStreak}x</span>
          </div>
        </div>
      </div>

      {/* Base Spool Words */}
      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-indigo-500/20 mb-6">
        <div className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Base Spool Words in this Game:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {gameState.secretSpoolWords.map((w, idx) => {
            const wasFound = gameState.foundWords.some((f) => f.word === w);
            return (
              <span
                key={`${w}_${idx}`}
                className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                  wasFound
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {w} {wasFound && '✓'}
              </span>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onPlayAgain}
            className="py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.5)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>

          <button
            onClick={handleShare}
            className="py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span>SHARE</span>
          </button>
        </div>

        {onReturnToLobby && (
          <button
            onClick={onReturnToLobby}
            className="w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Return to More Games Lobby
          </button>
        )}
      </div>
    </ModalLayout>
  );
};

