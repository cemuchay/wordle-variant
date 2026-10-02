import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Flame, Trophy } from 'lucide-react';
import type { ScrambleGameMode } from '../engine/types';

interface ScrambleHeaderProps {
  score: number;
  streak: number;
  remainingSeconds: number;
  mode: ScrambleGameMode;
  targetLengths?: number[];
}

export const ScrambleHeader: React.FC<ScrambleHeaderProps> = ({
  score,
  streak,
  remainingSeconds,
  mode,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLowTime = mode === 'timed' && remainingSeconds <= 15;

  return (
    <div className="w-full max-w-xl mx-auto mb-3 flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-indigo-500/20 shadow-lg">
      {/* Score */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-[0_0_12px_rgba(234,179,8,0.5)]">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">Score</div>
          <div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">
            {score.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Streak Multiplier */}
      {streak > 0 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-orange-500/30 to-rose-500/30 border border-orange-500/40"
        >
          <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
          <span className="text-xs font-black text-orange-300">{streak}x Streak</span>
        </motion.div>
      )}

      {/* Timer or Untimed Badge */}
      <div className="flex items-center gap-2">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
            isLowTime
              ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.8)]'
              : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]'
          }`}
        >
          <Timer className="w-5 h-5" />
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400">
            {mode === 'timed' ? 'Time Left' : 'Mode'}
          </div>
          <div
            className={`text-lg font-black font-mono ${
              isLowTime ? 'text-rose-400' : 'text-cyan-300'
            }`}
          >
            {mode === 'timed' ? formatTime(remainingSeconds) : 'Untimed'}
          </div>
        </div>
      </div>
    </div>
  );
};
