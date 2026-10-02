import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Flame, Trophy, Pause, Play } from 'lucide-react';
import type { ScrambleGameMode } from '../engine/types';

interface ScrambleHeaderProps {
  score: number;
  streak: number;
  remainingSeconds: number;
  mode: ScrambleGameMode;
  targetLengths?: number[];
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export const ScrambleHeader: React.FC<ScrambleHeaderProps> = ({
  score,
  streak,
  remainingSeconds,
  mode,
  isPaused = false,
  onTogglePause,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLowTime = mode === 'timed' && remainingSeconds <= 15;

  return (
    <div className="w-full max-w-xl mx-auto mb-2 sm:mb-3 flex items-center justify-between gap-2 p-2 sm:p-3 rounded-2xl bg-slate-900/90 border border-indigo-500/20 shadow-md">
      {/* Score */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black shadow-[0_0_10px_rgba(234,179,8,0.4)]">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 leading-tight">Score</div>
          <div className="text-sm sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 leading-tight">
            {score.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Streak Multiplier */}
      {streak > 0 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-orange-500/30 to-rose-500/30 border border-orange-500/40"
        >
          <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400 animate-bounce" />
          <span className="text-[10px] sm:text-xs font-black text-orange-300">{streak}x Streak</span>
        </motion.div>
      )}

      {/* Timer or Untimed Badge + Pause Button */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {onTogglePause && (
          <button
            onClick={onTogglePause}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
            title={isPaused ? 'Resume Game' : 'Pause Game'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 fill-current" /> : <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />}
          </button>
        )}

        <div
          className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center font-black ${
            isPaused
              ? 'bg-amber-600 text-slate-950 shadow-[0_0_10px_rgba(217,119,6,0.6)]'
              : isLowTime
              ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.8)]'
              : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]'
          }`}
        >
          <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="text-right">
          <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 leading-tight">
            {isPaused ? 'Paused' : mode === 'timed' ? 'Time Left' : 'Mode'}
          </div>
          <div
            className={`text-sm sm:text-lg font-black font-mono leading-tight ${
              isPaused ? 'text-amber-300' : isLowTime ? 'text-rose-400' : 'text-cyan-300'
            }`}
          >
            {mode === 'timed' ? formatTime(remainingSeconds) : 'Untimed'}
          </div>
        </div>
      </div>
    </div>
  );
};
