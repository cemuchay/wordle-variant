import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, Crown, Sparkles } from 'lucide-react';

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

const EMOJI_BURST = ['🔥', '✨', '⚡', '🎉', '💥', '🚀', '🌟', '💎', '🌈', '🎯', '👑', '💫'];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

export const ScrambleWordSplash: React.FC<ScrambleWordSplashProps> = ({
  splash,
  onDismiss,
}) => {
  // Generate random explosion particle trajectories for each splash
  const particles: Particle[] = useMemo(() => {
    if (!splash) return [];
    const count = 12;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const distance = 140 + Math.random() * 160;
      return {
        id: i,
        emoji: EMOJI_BURST[(i + splash.word.length) % EMOJI_BURST.length],
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotate: Math.random() * 720 - 360,
        scale: 0.8 + Math.random() * 0.8,
      };
    });
  }, [splash]);

  if (!splash) return null;

  const isSpool = Boolean(splash.isSecretSpoolBonus);
  const isHighStreak = (splash.streak || 0) >= 2;

  return (
    <AnimatePresence>
      <div
        key={`${splash.word}_${splash.timestamp}`}
        onClick={onDismiss}
        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none overflow-hidden"
      >
        {/* Instant subtle shockwave backdrop flash */}
        <motion.div
          initial={{ opacity: 0.4, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`absolute w-96 h-96 rounded-full blur-3xl ${
            isSpool
              ? 'bg-amber-400/40'
              : 'bg-gradient-to-tr from-cyan-400/35 via-purple-500/35 to-pink-500/35'
          }`}
        />

        {/* Flying Particle Bursts radiating outwards */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.2 }}
            animate={{
              opacity: [1, 1, 0],
              x: p.x,
              y: p.y,
              scale: p.scale,
              rotate: p.rotate,
            }}
            transition={{ duration: 0.85, ease: [0.2, 0.9, 0.3, 1] }}
            className="absolute text-2xl sm:text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          >
            {p.emoji}
          </motion.div>
        ))}

        {/* Instant Impact Splash Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.2, y: 20 }}
          animate={{
            opacity: 1,
            scale: [0.2, 1.15, 1],
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.7, y: -40 }}
          transition={{
            duration: 0.4,
            times: [0, 0.6, 1],
            ease: [0.175, 0.885, 0.32, 1.275],
          }}
          className="relative px-6 py-4 rounded-3xl backdrop-blur-2xl flex flex-col items-center text-center shadow-[0_20px_70px_rgba(0,0,0,0.8)] border-2 pointer-events-auto cursor-pointer"
          style={{
            background: isSpool
              ? 'linear-gradient(135deg, rgba(30, 20, 5, 0.95), rgba(70, 40, 10, 0.95), rgba(20, 10, 30, 0.95))'
              : 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95))',
            borderColor: isSpool ? 'rgba(251, 191, 36, 0.9)' : 'rgba(34, 211, 238, 0.85)',
          }}
        >
          {/* Top Banner Tag */}
          <div className="flex items-center gap-2 mb-1">
            {isSpool ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-black tracking-widest uppercase flex items-center gap-1 shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                <Crown className="w-3 h-3 fill-current" />
                ORIGINAL SPOOL BONUS (+50%)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-300" />
                SPLASH! WORD ACCEPTED
              </span>
            )}

            {isHighStreak && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500 text-rose-300 text-[10px] font-black flex items-center gap-1">
                <Flame className="w-3 h-3 fill-current" />
                {splash.streak}x STREAK
              </span>
            )}
          </div>

          {/* Word in Huge Glowing Font */}
          <motion.div
            initial={{ letterSpacing: '0.1em' }}
            animate={{ letterSpacing: ['0.1em', '0.25em', '0.15em'] }}
            transition={{ duration: 0.4 }}
            className={`text-3xl sm:text-5xl font-black font-mono tracking-wider text-transparent bg-clip-text ${
              isSpool
                ? 'bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.8)]'
                : 'bg-gradient-to-r from-pink-400 via-cyan-300 to-emerald-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.7)]'
            }`}
          >
            {splash.word.toUpperCase()}
          </motion.div>

          {/* Points Flash */}
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: [0.5, 1.3, 1], rotate: [0, 5, 0] }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mt-2 px-4 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-sm sm:text-base flex items-center gap-1.5 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>+{splash.score} PTS</span>
          </motion.div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ScrambleWordSplash;

