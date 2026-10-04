import React from 'react';
import type { ScrambleSessionStats } from '../engine/types';
import { History, Flame } from 'lucide-react';
import { ModalLayout } from '../../components/layout/ModalLayout';

interface GameHistoryModalProps {
  isOpen: boolean;
  sessions: ScrambleSessionStats[];
  onClose: () => void;
}

export const GameHistoryModal: React.FC<GameHistoryModalProps> = ({
  isOpen,
  sessions,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={true}
      maxWidth="lg"
      containerClassName="bg-slate-900 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.25)] text-slate-100 p-4 sm:p-6"
    >
      <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4">
        <div className="p-2 rounded-xl bg-indigo-900/60 border border-indigo-500/40 text-indigo-300">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400">
            Game History
          </h3>
          <p className="text-[11px] text-slate-400">Your recent games & scores</p>
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {sessions.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-2"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                  {item.gameMode}
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {item.selectedLengths.map((l) => `${l}L`).join(', ')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {item.totalWordsCount} words found ·{' '}
                {new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-base font-black text-emerald-400">
                {item.score.toLocaleString()} pts
              </div>
              {item.highestStreak > 1 && (
                <div className="text-[10px] text-orange-400 font-bold flex items-center justify-end gap-0.5 mt-0.5">
                  <Flame className="w-3 h-3 fill-current" />
                  <span>{item.highestStreak}x streak</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-xs">
            No games played yet. Finish your first run to see your stats here!
          </div>
        )}
      </div>
    </ModalLayout>
  );
};

