import { AnimatePresence, motion } from 'framer-motion';
import { Star, Timer, Trophy, Zap } from 'lucide-react';
import React, { useMemo } from 'react';

export interface ScrambleWordSplashData {
  milestoneCount: number; // 5, 10, 15, 20, etc.
  latestWord: string;
  totalScore: number;
  streak?: number;
  timeBonus?: number;
  timestamp: number;
  title?: string;
}

interface ScrambleWordSplashProps {
  splash: ScrambleWordSplashData | null;
  onDismiss?: () => void;
}

const MILESTONE_TITLES: Record<number, { title: string; subtitle: string; emoji: string; color: string }> = {
  5: { title: 'BRONZE WORDSMITH', subtitle: '5 Words Cleared! Keep rolling!', emoji: '🥉', color: 'from-amber-600 via-yellow-500 to-amber-700' },
  10: { title: 'SILVER STRIKER', subtitle: '10 Words Cleared! Time decay accelerating!', emoji: '🥈', color: 'from-slate-300 via-cyan-300 to-indigo-300' },
  15: { title: 'GOLDEN ANAGRAMIST', subtitle: '15 Words Cleared! Blazing efficiency!', emoji: '🥇', color: 'from-yellow-400 via-amber-300 to-yellow-600' },
  20: { title: 'PLATINUM MASTER', subtitle: '20 Words Cleared! Unstoppable flow!', emoji: '💎', color: 'from-cyan-400 via-teal-300 to-blue-500' },
  25: { title: 'DIAMOND SCRAMBLER', subtitle: '25 Words Cleared! Legendary mastery!', emoji: '👑', color: 'from-fuchsia-400 via-pink-400 to-purple-500' },
  30: { title: 'MYTHIC VOCABULARY', subtitle: '30 Words Cleared! Godlike word wizardry!', emoji: '⚡', color: 'from-emerald-400 via-teal-300 to-cyan-400' },
  35: { title: 'ANAGRAM GOD', subtitle: '35 Words Cleared! Incredible speed & accuracy!', emoji: '🌟', color: 'from-amber-300 via-rose-400 to-purple-500' },
  40: { title: 'GRAND CHAMPION', subtitle: '40 Words Cleared! Supreme Scramble Titan!', emoji: '🏆', color: 'from-pink-500 via-yellow-300 to-cyan-400' },
};

const EMOJI_BURST = ['🎉', '✨', '⚡', '🔥', '💥', '🚀', '🌟', '💎', '🌈', '🎯', '👑', '💫'];

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
  // Generate celebratory particle burst for each milestone
  const particles: Particle[] = useMemo(() => {
    if (!splash) return [];
    const count = 16;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.3 - 0.15);
      const distance = 160 + Math.random() * 180;
      return {
        id: i,
        emoji: EMOJI_BURST[i % EMOJI_BURST.length],
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotate: Math.random() * 720 - 360,
        scale: 0.9 + Math.random() * 0.9,
      };
    });
  }, [splash]);

  if (!splash) return null;

  const milestoneInfo = MILESTONE_TITLES[splash.milestoneCount] || {
    title: `${splash.milestoneCount} WORDS CLEARED!`,
    subtitle: 'Phenomenal word scrambling achievement!',
    emoji: '🏆',
    color: 'from-pink-400 via-amber-300 to-cyan-400',
  };

  return (
    <AnimatePresence>
      <div
        key={`milestone_${splash.milestoneCount}_${splash.timestamp}`}
        onClick={onDismiss}
        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none overflow-hidden"
      >
        {/* Fullscreen Golden/Rainbow Radial Glow Flash */}
        <motion.div
          initial={{ opacity: 0.6, scale: 0.6 }}
          animate={{ opacity: 0, scale: 2.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl bg-gradient-to-tr from-amber-500/40 via-purple-600/40 to-cyan-400/40"
        />

        {/* Flying Particle Bursts */}
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
            transition={{ duration: 1.1, ease: [0.2, 0.9, 0.3, 1] }}
            className="absolute text-3xl sm:text-4xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]"
          >
            {p.emoji}
          </motion.div>
        ))}

        {/* Epic Milestone Splash Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: 30 }}
          animate={{
            opacity: 1,
            scale: [0.3, 1.12, 1],
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.7, y: -40 }}
          transition={{
            duration: 0.45,
            times: [0, 0.65, 1],
            ease: [0.175, 0.885, 0.32, 1.275],
          }}
          className="relative px-7 py-5 sm:px-10 sm:py-6 rounded-3xl backdrop-blur-2xl flex flex-col items-center text-center shadow-[0_25px_80px_rgba(0,0,0,0.85)] border-2 border-amber-400/90 pointer-events-auto cursor-pointer max-w-sm sm:max-w-md mx-4"
          style={{
            background: 'linear-gradient(135deg, rgba(20, 15, 35, 0.96), rgba(45, 25, 60, 0.96), rgba(15, 23, 42, 0.96))',
          }}
        >
          {/* Milestone Badge Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full bg-amber-500/25 border border-amber-400 text-amber-300 text-[11px] sm:text-xs font-black tracking-widest uppercase flex items-center gap-1.5 shadow-[0_0_14px_rgba(251,191,36,0.6)]">
              <Trophy className="w-3.5 h-3.5 fill-current text-amber-400" />
              MILESTONE UNLOCKED
            </span>
          </div>

          {/* Huge Number & Emoji */}
          <div className="flex items-center justify-center gap-3 my-1">
            <span className="text-4xl sm:text-5xl">{milestoneInfo.emoji}</span>
            <div className="text-4xl sm:text-6xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.9)]">
              {splash.milestoneCount} WORDS
            </div>
          </div>

          {/* Milestone Title */}
          <div className={`text-base sm:text-lg font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r ${milestoneInfo.color} drop-shadow-md`}>
            {milestoneInfo.title}
          </div>

          <p className="text-xs text-slate-300 font-medium mt-0.5 max-w-xs">
            {milestoneInfo.subtitle}
          </p>

          {/* Latest Word & Score Highlights */}
          <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
            <div className="px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-mono text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-current" />
              <span>{splash.latestWord}</span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1 shadow-[0_0_15px_rgba(52,211,153,0.7)]">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{splash.totalScore.toLocaleString()} PTS</span>
            </div>

            {Boolean(splash.timeBonus && splash.timeBonus > 0) && (
              <div className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs flex items-center gap-1 shadow-[0_0_12px_rgba(251,191,36,0.7)]">
                <Timer className="w-3 h-3 fill-current" />
                <span>+{splash.timeBonus}s</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ScrambleWordSplash;

