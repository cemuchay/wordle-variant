import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame, Zap } from 'lucide-react';

export interface ScrambleWordSplashData {
  word: string;
  score: number;
  streak?: number;
  length: number;
  timestamp: number;
  isSecretSpoolBonus?: boolean;
}

interface ScrambleWordSplashProps {
  splash: ScrambleWordSplashData | null;
  onDismiss?: () => void;
}

const EMOJI_POOL = ['🔥', '✨', '⚡', '🎉', '💥', '🚀', '🌟', '💎', '🌈', '🎯'];

export const ScrambleWordSplash: React.FC<ScrambleWordSplashProps> = ({
  splash,
  onDismiss,
}) => {
  if (!splash) return null;

  // Select celebratory emoji based on word length / score / spool bonus
  const emoji = splash.isSecretSpoolBonus
    ? '👑'
    : EMOJI_POOL[(splash.word.length + splash.score) % EMOJI_POOL.length];
  const isHighStreak = (splash.streak || 0) >= 2;

  return (
    <AnimatePresence>
      <motion.div
        key={`${splash.word}_${splash.timestamp}`}
        initial={{ opacity: 0, scale: 0.5, y: -40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        onClick={onDismiss}
        className="fixed top-12 sm:top-14 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm pointer-events-auto cursor-pointer select-none"
      >
        <div className={`relative overflow-hidden bg-gradient-to-r ${
          splash.isSecretSpoolBonus
            ? 'from-amber-950/95 via-purple-950/95 to-slate-950/95 border-2 border-amber-400/90 shadow-[0_10px_45px_rgba(251,191,36,0.5)]'
            : 'from-slate-950/95 via-indigo-950/95 to-slate-950/95 border-2 border-cyan-400/80 shadow-[0_10px_40px_rgba(6,182,212,0.45)]'
        } rounded-3xl p-3.5 sm:p-4 backdrop-blur-xl flex items-center justify-between gap-3 text-white`}>
          {/* Subtle glowing animated background sweep */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent animate-pulse pointer-events-none" />

          <div className="flex items-center gap-3 min-w-0 z-10">
            {/* Animated emoji badge */}
            <motion.div
              initial={{ rotate: -20, scale: 0.8 }}
              animate={{ rotate: [0, 15, -10, 0], scale: 1.15 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`w-11 h-11 rounded-2xl ${
                splash.isSecretSpoolBonus
                  ? 'bg-gradient-to-tr from-amber-500/40 via-yellow-400/30 to-amber-300/40 border border-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                  : 'bg-gradient-to-tr from-pink-500/30 via-amber-400/20 to-cyan-400/30 border border-cyan-400/40'
              } flex items-center justify-center text-2xl shadow-inner shrink-0`}
            >
              <span>{emoji}</span>
            </motion.div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  splash.isSecretSpoolBonus
                    ? 'text-amber-300'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-amber-200 to-cyan-300'
                } truncate`}>
                  {splash.isSecretSpoolBonus ? '🌟 Original Spool Word!' : 'Word Accepted!'}
                </span>
                {splash.isSecretSpoolBonus && (
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-950/90 border border-amber-500/60 text-amber-300 text-[8px] font-black">
                    +50% BONUS
                  </span>
                )}
                {isHighStreak && (
                  <span className="px-1.5 py-0.2 rounded-md bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[9px] font-black flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5 fill-current" />
                    <span>{splash.streak}x</span>
                  </span>
                )}
              </div>

              <span className="text-lg sm:text-xl font-black tracking-wide text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-mono">
                {splash.word.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0 z-10">
            <motion.div
              initial={{ scale: 0.7 }}
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 0.35 }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 rounded-2xl text-xs sm:text-sm font-black uppercase shadow-[0_0_15px_rgba(52,211,153,0.7)] flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>+{splash.score}</span>
            </motion.div>
            <span className="text-[9px] text-slate-400 font-mono mt-0.5 font-bold">
              {splash.length} Letters
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScrambleWordSplash;
