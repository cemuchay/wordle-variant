import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Trophy, ArrowRight } from 'lucide-react';

export interface VictorySplashOverlayProps {
  score: number; // number of guesses used, e.g. 1 to 6
  maxAttempts?: number; // total attempts allowed, default 6
  targetWord?: string;
  onDismiss: () => void;
  durationSeconds?: number; // default 4.5
}

interface ScoreTheme {
  title: string;
  subtitle: string;
  badgeText: string;
  gradientText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeGlow: string;
  cardGlow: string;
  accentColors: string[];
}

const SCORE_THEMES: Record<number, ScoreTheme> = {
  1: {
    title: 'UNBELIEVABLE!',
    subtitle: 'A legendary hole-in-one guess!',
    badgeText: '1 / 6 • HOLE IN ONE',
    gradientText: 'from-amber-300 via-rose-400 to-cyan-300',
    badgeBg: 'bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-cyan-500/20',
    badgeBorder: 'border-amber-400/50',
    badgeGlow: 'shadow-[0_0_25px_rgba(251,191,36,0.5)]',
    cardGlow: 'shadow-[0_0_60px_rgba(236,72,153,0.3)]',
    accentColors: ['#FF0055', '#FF7700', '#FFDD00', '#00FF66', '#00E5FF', '#9D00FF', '#FFFFFF'],
  },
  2: {
    title: 'MAGNIFICENT!',
    subtitle: 'Masterful deduction in just 2 turns!',
    badgeText: '2 / 6 • MASTER CLASS',
    gradientText: 'from-cyan-300 via-teal-200 to-indigo-300',
    badgeBg: 'bg-cyan-500/20',
    badgeBorder: 'border-cyan-400/50',
    badgeGlow: 'shadow-[0_0_25px_rgba(34,211,238,0.5)]',
    cardGlow: 'shadow-[0_0_60px_rgba(34,211,238,0.3)]',
    accentColors: ['#00F5D4', '#00BBF9', '#7B2CBF', '#9B5DE5', '#F15BB5', '#FFFFFF'],
  },
  3: {
    title: 'OUTSTANDING!',
    subtitle: 'Sharp mind! Crushed it on turn 3!',
    badgeText: '3 / 6 • SHARP MIND',
    gradientText: 'from-emerald-300 via-green-200 to-teal-300',
    badgeBg: 'bg-emerald-500/20',
    badgeBorder: 'border-emerald-400/50',
    badgeGlow: 'shadow-[0_0_25px_rgba(52,211,153,0.5)]',
    cardGlow: 'shadow-[0_0_60px_rgba(52,211,153,0.3)]',
    accentColors: ['#10B981', '#34D399', '#6EE7B7', '#FBBF24', '#06B6D4', '#FFFFFF'],
  },
  4: {
    title: 'GREAT JOB!',
    subtitle: 'Solid victory and excellent strategy!',
    badgeText: '4 / 6 • SOLID WIN',
    gradientText: 'from-amber-300 via-orange-300 to-yellow-200',
    badgeBg: 'bg-amber-500/20',
    badgeBorder: 'border-amber-400/50',
    badgeGlow: 'shadow-[0_0_25px_rgba(251,191,36,0.5)]',
    cardGlow: 'shadow-[0_0_60px_rgba(245,158,11,0.3)]',
    accentColors: ['#F59E0B', '#FBBF24', '#F97316', '#EF4444', '#EC4899', '#FFFFFF'],
  },
  5: {
    title: 'WELL DONE!',
    subtitle: 'Patience and persistence paid off!',
    badgeText: '5 / 6 • WELL PLAYED',
    gradientText: 'from-orange-300 via-rose-300 to-pink-300',
    badgeBg: 'bg-orange-500/20',
    badgeBorder: 'border-orange-400/50',
    badgeGlow: 'shadow-[0_0_25px_rgba(249,115,22,0.5)]',
    cardGlow: 'shadow-[0_0_60px_rgba(244,63,94,0.3)]',
    accentColors: ['#FB7185', '#F43F5E', '#FB923C', '#F59E0B', '#C084FC', '#FFFFFF'],
  },
  6: {
    title: 'CLUTCH WIN!',
    subtitle: 'Down to the final wire — nerves of steel!',
    badgeText: '6 / 6 • CLUTCH FINISH',
    gradientText: 'from-fuchsia-400 via-purple-300 to-pink-400',
    badgeBg: 'bg-fuchsia-500/20',
    badgeBorder: 'border-fuchsia-400/50',
    badgeGlow: 'shadow-[0_0_25px_rgba(217,70,239,0.5)]',
    cardGlow: 'shadow-[0_0_60px_rgba(168,85,247,0.3)]',
    accentColors: ['#E879F9', '#D946EF', '#A855F7', '#38BDF8', '#F43F5E', '#FFFFFF'],
  },
};

const RAINBOW_SPECTRUM = [
  '#FF0055',
  '#FF5500',
  '#FFCC00',
  '#00FF66',
  '#00E5FF',
  '#7928CA',
  '#FF00EA',
  '#FFFFFF',
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
  gravity: number;
  friction: number;
  shimmer: boolean;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  colors: string[];
  trail: { x: number; y: number; alpha: number }[];
}

export const VictorySplashOverlay: React.FC<VictorySplashOverlayProps> = ({
  score,
  maxAttempts = 6,
  targetWord,
  onDismiss,
  durationSeconds = 10,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const normalizedScore = Math.min(Math.max(score, 1), maxAttempts);
  const theme = SCORE_THEMES[normalizedScore] || SCORE_THEMES[4];

  // Auto-dismiss countdown
  useEffect(() => {
    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      const remaining = Math.max(0, durationSeconds - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationSeconds, onDismiss]);

  // High-performance Fireworks Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];

    const spawnBurst = (x: number, y: number, colorPool: string[], count = 60) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.2 - 0.1);
        const speed = Math.random() * 7 + 2;
        const color = colorPool[Math.floor(Math.random() * colorPool.length)];
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1,
          decay: Math.random() * 0.015 + 0.01,
          size: Math.random() * 3 + 1.5,
          gravity: 0.12,
          friction: 0.96,
          shimmer: Math.random() > 0.4,
        });
      }
    };

    const launchRocket = (startX?: number, colorPool?: string[]) => {
      const x = startX !== undefined ? startX : width * 0.15 + Math.random() * (width * 0.7);
      const targetY = height * 0.18 + Math.random() * (height * 0.35);
      const colors = colorPool || (Math.random() > 0.3 ? RAINBOW_SPECTRUM : theme.accentColors);
      const color = colors[Math.floor(Math.random() * colors.length)];
      rockets.push({
        x,
        y: height + 10,
        targetY,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -(Math.random() * 4 + 11),
        color,
        colors,
        trail: [],
      });
    };

    // Initial celebratory opening volley
    launchRocket(width * 0.25, RAINBOW_SPECTRUM);
    launchRocket(width * 0.5, theme.accentColors);
    launchRocket(width * 0.75, RAINBOW_SPECTRUM);

    // Periodic launch intervals
    let lastLaunchTime = performance.now();

    const loop = (timestamp: number) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      // Launch new rockets at rhythmic intervals
      if (timestamp - lastLaunchTime > 380) {
        launchRocket();
        if (Math.random() > 0.5) {
          launchRocket();
        }
        lastLaunchTime = timestamp;
      }

      // Update & Draw Rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.15; // rocket gravity deceleration

        r.trail.push({ x: r.x, y: r.y, alpha: 1 });
        if (r.trail.length > 8) r.trail.shift();

        // Draw trail
        ctx.beginPath();
        for (let j = 0; j < r.trail.length; j++) {
          const pt = r.trail[j];
          ctx.strokeStyle = r.color;
          ctx.globalAlpha = (j / r.trail.length) * 0.7;
          ctx.lineWidth = 2.5;
          if (j === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Rocket head spark
        ctx.beginPath();
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 1;
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Explode condition
        if (r.y <= r.targetY || r.vy >= -1) {
          spawnBurst(r.x, r.y, r.colors, 65);
          rockets.splice(i, 1);
        }
      }

      // Update & Draw Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.globalAlpha = p.shimmer ? p.alpha * (0.6 + Math.random() * 0.4) : p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  const progressPercent = Math.max(0, (timeLeft / durationSeconds) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/80 backdrop-blur-md select-none"
    >
      {/* Dynamic Canvas Fireworks Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />

      {/* Radiant Background Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen bg-radial from-violet-600/30 via-transparent to-transparent" />

      {/* Top Bar with 'X' Close Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={onDismiss}
          className="group flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white border border-white/20 backdrop-blur-lg shadow-lg transition-all duration-200 cursor-pointer"
          title="Skip to results (Esc)"
          aria-label="Close victory splash"
        >
          <X className="w-6 h-6 transition-transform group-hover:rotate-90 duration-300" />
        </button>
      </div>

      {/* Main Victory Card */}
      <motion.div
        initial={{ scale: 0.82, y: 25, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 15, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className={`relative z-10 w-[92%] max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900/85 border border-white/20 backdrop-blur-xl flex flex-col items-center text-center text-white ${theme.cardGlow}`}
      >
        {/* Animated Trophy / Sparkle Icon */}
        <motion.div
          animate={{
            rotate: [0, -8, 8, -4, 4, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 ${theme.badgeBg} border ${theme.badgeBorder} ${theme.badgeGlow}`}
        >
          <Trophy className="w-9 h-9 sm:w-11 sm:h-11 text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]" />
        </motion.div>

        {/* Celebratory Tier Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase border mb-3 ${theme.badgeBg} ${theme.badgeBorder} text-white/90`}
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" style={{ animationDuration: '4s' }} />
          <span>{theme.badgeText}</span>
        </motion.div>

        {/* Main Victory Title with Rainbow / Tier Gradient */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-4xl sm:text-5xl font-black tracking-tight uppercase bg-gradient-to-r ${theme.gradientText} bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] mb-2`}
        >
          {theme.title}
        </motion.h1>

        {/* Subtitle / Accolade */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm sm:text-base text-gray-300 font-medium mb-4 max-w-xs"
        >
          {theme.subtitle}
        </motion.p>

        {/* Target Word Display if provided */}
        {targetWord && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-gray-300"
          >
            Word of the Day: <span className="font-extrabold tracking-widest text-yellow-300 uppercase">{targetWord}</span>
          </motion.div>
        )}

        {/* Action Button to Continue Immediately */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onDismiss}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-sm sm:text-base shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-300/30 transition-all cursor-pointer"
        >
          <span>View Game Over & Stats</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>

        {/* Auto-Dismiss Timer Progress Bar */}
        <div className="w-full mt-4 flex flex-col gap-1">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 via-pink-500 to-cyan-400 rounded-full"
              style={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
          <span className="text-[11px] text-gray-400">
            Continuing in {Math.ceil(timeLeft)}s...
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};
export default VictorySplashOverlay;
