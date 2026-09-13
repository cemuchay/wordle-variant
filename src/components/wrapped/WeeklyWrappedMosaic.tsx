/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Download,
  Share2,
  Film,
  Sparkles,
  Flame,
  X,
} from 'lucide-react';
import type { UserAward } from '../../types/awards';
import type { ScoreRecord, LeaderboardEntry } from '../WeeklyWrappedModal';
import { ProtectedAvatar } from '../chat/ProtectedAvatar';

interface WeeklyWrappedMosaicProps {
  userId?: string;
  username: string;
  avatarUrl: string | null;
  weeklyScores: ScoreRecord[];
  userRank: { rank: number; entry: LeaderboardEntry } | null;
  weeklyAwards: UserAward[];
  gameDate: string;
  onSwitchToSlides: () => void;
  onClose: () => void;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface ThemeOption {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  canvasColor: string;
}

export interface DayTheme extends ThemeOption {
  name: string;
}

const THEME_POOL: ThemeOption[] = [
  { bg: 'from-rose-950/80 via-red-900/40 to-slate-950', border: 'border-rose-500/40', text: 'text-rose-400', badgeBg: 'bg-rose-500/20', canvasColor: '#f43f5e' },
  { bg: 'from-cyan-950/80 via-teal-900/40 to-slate-950', border: 'border-cyan-500/40', text: 'text-cyan-400', badgeBg: 'bg-cyan-500/20', canvasColor: '#06b6d4' },
  { bg: 'from-amber-950/80 via-orange-900/40 to-slate-950', border: 'border-amber-500/40', text: 'text-amber-400', badgeBg: 'bg-amber-500/20', canvasColor: '#f59e0b' },
  { bg: 'from-emerald-950/80 via-green-900/40 to-slate-950', border: 'border-emerald-500/40', text: 'text-emerald-400', badgeBg: 'bg-emerald-500/20', canvasColor: '#10b981' },
  { bg: 'from-violet-950/80 via-fuchsia-900/40 to-slate-950', border: 'border-violet-500/40', text: 'text-violet-400', badgeBg: 'bg-violet-500/20', canvasColor: '#8b5cf6' },
  { bg: 'from-yellow-950/80 via-amber-900/40 to-slate-950', border: 'border-yellow-500/40', text: 'text-yellow-400', badgeBg: 'bg-yellow-500/20', canvasColor: '#eab308' },
  { bg: 'from-fuchsia-950/80 via-pink-900/40 to-slate-950', border: 'border-fuchsia-500/40', text: 'text-fuchsia-400', badgeBg: 'bg-fuchsia-500/20', canvasColor: '#ec4899' },
  { bg: 'from-indigo-950/80 via-blue-900/40 to-slate-950', border: 'border-indigo-500/40', text: 'text-indigo-400', badgeBg: 'bg-indigo-500/20', canvasColor: '#6366f1' },
  { bg: 'from-teal-950/80 via-emerald-900/40 to-slate-950', border: 'border-teal-500/40', text: 'text-teal-400', badgeBg: 'bg-teal-500/20', canvasColor: '#14b8a6' },
  { bg: 'from-purple-950/80 via-pink-900/40 to-slate-950', border: 'border-purple-500/40', text: 'text-purple-400', badgeBg: 'bg-purple-500/20', canvasColor: '#a855f7' },
  { bg: 'from-sky-950/80 via-indigo-900/40 to-slate-950', border: 'border-sky-500/40', text: 'text-sky-400', badgeBg: 'bg-sky-500/20', canvasColor: '#38bdf8' },
  { bg: 'from-orange-950/80 via-red-900/40 to-slate-950', border: 'border-orange-500/40', text: 'text-orange-400', badgeBg: 'bg-orange-500/20', canvasColor: '#f97316' },
];

export const WeeklyWrappedMosaic: React.FC<WeeklyWrappedMosaicProps> = ({
  userId,
  username,
  avatarUrl,
  weeklyScores,
  userRank,
  weeklyAwards,
  onSwitchToSlides,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const mosaicRef = useRef<HTMLDivElement>(null);

  // Derive resolved avatar URL following the same pattern as ProtectedAvatar
  const resolvedAvatarUrl = useMemo(() => {
    let url = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;
    if (userId) {
      const isExternal = avatarUrl && (
        avatarUrl.startsWith("http://") ||
        avatarUrl.startsWith("https://")
      ) && !avatarUrl.includes("supabase.co") && !avatarUrl.includes("dicebear.com") && !avatarUrl.includes("ui-avatars.com");

      if (isExternal || !avatarUrl) {
        url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/avatar-proxy?uid=${userId}`;
      }
    }
    return url;
  }, [userId, avatarUrl, username]);

  // Shuffle/randomize theme colors from pool so every week recap is unique & colorful
  const dayThemes: DayTheme[] = useMemo(() => {
    const poolCopy = [...THEME_POOL];
    for (let i = poolCopy.length - 1; i > 0; i--) {
      // eslint-disable-next-line react-hooks/purity
      const j = Math.floor(Math.random() * (i + 1));
      [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
    }
    return DAY_NAMES.map((name, idx) => ({
      name,
      ...poolCopy[idx % poolCopy.length],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Preload user avatar for canvas drawing with CORS handling and fallback
  useEffect(() => {
    if (!resolvedAvatarUrl) {
      avatarImageRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvatarLoaded(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolvedAvatarUrl;
    img.onload = () => {
      avatarImageRef.current = img;
      setAvatarLoaded(true);
    };
    img.onerror = () => {
      // Fallback try without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.src = resolvedAvatarUrl;
      fallbackImg.onload = () => {
        avatarImageRef.current = fallbackImg;
        setAvatarLoaded(true);
      };
      fallbackImg.onerror = () => {
        avatarImageRef.current = null;
        setAvatarLoaded(false);
      };
    };
  }, [resolvedAvatarUrl]);

  // Aggregate stats
  const gamesPlayed = weeklyScores.length;
  const gamesWon = weeklyScores.filter((s) => s.status === 'won').length;
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const totalScore = weeklyScores.reduce((sum, s) => sum + (s.skill_score || 0), 0);

  // Helper to parse guess rows
  const getParsedGuesses = (score: ScoreRecord) => {
    if (!score.guesses || !Array.isArray(score.guesses)) return [];
    return score.guesses.map((row: any) => {
      if (Array.isArray(row)) {
        return row.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            return {
              letter: (item.letter || '').toUpperCase(),
              status: item.status || 'absent',
            };
          }
          return { letter: String(item).toUpperCase(), status: 'correct' };
        });
      }
      return [];
    });
  };

  // High-Resolution 2400x3200 Canvas Renderer for Download / Social Sharing
  const generateHighResCanvas = (): HTMLCanvasElement => {
    const width = 2400;
    const height = 3200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Full Deep Space Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(0.3, '#0f0728');
    bgGrad.addColorStop(0.7, '#1b092b');
    bgGrad.addColorStop(1, '#030712');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Vibrant Rainbow Ambient Orbs
    const drawOrb = (cx: number, cy: number, radius: number, color: string) => {
      ctx.save();
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      orbGrad.addColorStop(0, color);
      orbGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawOrb(400, 500, 600, 'rgba(236, 72, 153, 0.25)'); // Magenta
    drawOrb(2000, 1000, 700, 'rgba(56, 189, 248, 0.2)'); // Cyan
    drawOrb(600, 2200, 800, 'rgba(245, 158, 11, 0.2)'); // Amber
    drawOrb(1800, 2800, 600, 'rgba(168, 85, 247, 0.25)'); // Violet

    // 3. Header Title & Brand
    ctx.fillStyle = '#6366f1';
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VARIANT WEEKLY WRAPPED', width / 2, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 110px sans-serif';
    ctx.fillText('WEEKLY RECAP MOSAIC', width / 2, 260);

    // 4. Hero Profile Card Box
    const heroY = 340;
    const heroH = 340;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(160, heroY, width - 320, heroH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(160, heroY, width - 320, heroH);

    // Avatar inside Hero
    const avatarCx = 320;
    const avatarCy = heroY + heroH / 2;
    const avatarR = 100;

    if (avatarLoaded && avatarImageRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImageRef.current, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 90px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(username.charAt(0).toUpperCase(), avatarCx, avatarCy);
      ctx.textBaseline = 'alphabetic';
    }

    // Username & Rank Info
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 80px sans-serif';
    ctx.fillText(`@${username}`, 470, heroY + 130);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '700 44px sans-serif';
    ctx.fillText(`${gamesWon}/${gamesPlayed} Wins · ${totalScore} Total Pts · ${winRate}% Win Rate`, 470, heroY + 220);

    // Global Rank Pill
    if (userRank) {
      const rankText = `🏆 #${userRank.rank} GLOBAL RANK`;
      ctx.font = '900 42px sans-serif';
      const rankWidth = ctx.measureText(rankText).width + 60;
      const rankX = width - 220 - rankWidth;
      const rankY = heroY + (heroH - 90) / 2;

      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fillRect(rankX, rankY, rankWidth, 90);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(rankX, rankY, rankWidth, 90);

      ctx.fillStyle = '#fbbf24';
      ctx.fillText(rankText, rankX + 30, rankY + 60);
    }

    // 5. Render Facebook-Memories Style Dynamic Asymmetric Mosaic Collage
    const rainbowColors = dayThemes.map((t: DayTheme) => ({ header: t.canvasColor, border: t.canvasColor }));

    // Dynamic collage coordinates & organic tilt angles (Facebook memories / polaroid style)
    const cardLayouts = [
      { x: 160, y: 730, w: 990, h: 560, rot: -0.015 },  // Mon (subtle left tilt)
      { x: 1210, y: 750, w: 1030, h: 540, rot: 0.012 },  // Tue (slight right tilt)
      { x: 170, y: 1330, w: 1020, h: 550, rot: 0.010 },  // Wed
      { x: 1230, y: 1320, w: 1010, h: 570, rot: -0.012 }, // Thu
      { x: 160, y: 1920, w: 1000, h: 550, rot: -0.008 }, // Fri
      { x: 1200, y: 1930, w: 1040, h: 550, rot: 0.015 },  // Sat
      { x: 180, y: 2510, w: 2040, h: 480, rot: -0.003 }, // Sun (Full wide spotlight)
    ];

    DAY_NAMES.forEach((dayName, idx) => {
      const layout = cardLayouts[idx];
      const { x, y, w, h, rot } = layout;
      const isFullWidth = idx === 6;

      const theme = rainbowColors[idx % rainbowColors.length];
      const dayScore = weeklyScores[idx];

      ctx.save();
      // Center of card for subtle natural rotation
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(rot);
      ctx.translate(-(x + w / 2), -(y + h / 2));

      // Draw rounded card container with soft shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 15;

      const r = 32; // Corner radius
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fill();
      ctx.restore();

      // Card border
      ctx.strokeStyle = `${theme.border}77`;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Header Banner inside card
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + 84);
      ctx.lineTo(x, y + 84);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fillStyle = `${theme.header}25`;
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = theme.header;
      ctx.font = '900 38px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(dayName.toUpperCase(), x + 35, y + 56);

      if (dayScore) {
        // Status Badge
        ctx.textAlign = 'right';
        ctx.font = '900 32px sans-serif';
        ctx.fillStyle = dayScore.status === 'won' ? '#34d399' : '#f87171';
        const statusTxt = dayScore.status === 'won' ? '✓ WON' : '✕ LOST';
        ctx.fillText(statusTxt, x + w - 35, y + 56);

        // Render Word Guesses Grid
        const parsedGuesses = getParsedGuesses(dayScore);
        const maxRows = Math.min(6, parsedGuesses.length);
        const tileSize = isFullWidth ? 56 : 50;
        const tileGap = 10;
        const gridStartX = x + 35;
        const gridStartY = y + 115;

        parsedGuesses.slice(0, maxRows).forEach((guessRow, rIdx) => {
          guessRow.forEach((charObj: any, cIdx: number) => {
            const tx = gridStartX + cIdx * (tileSize + tileGap);
            const ty = gridStartY + rIdx * (tileSize + tileGap);

            let tileBg = '#374151';
            let charColor = '#ffffff';
            if (charObj.status === 'correct') {
              tileBg = '#22c55e';
              charColor = '#000000';
            } else if (charObj.status === 'present') {
              tileBg = '#eab308';
              charColor = '#000000';
            }

            ctx.fillStyle = tileBg;
            ctx.beginPath();
            const tr = 8;
            ctx.roundRect ? ctx.roundRect(tx, ty, tileSize, tileSize, tr) : ctx.rect(tx, ty, tileSize, tileSize);
            ctx.fill();

            ctx.fillStyle = charColor;
            ctx.font = `900 ${Math.round(tileSize * 0.52)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(charObj.letter || '', tx + tileSize / 2, ty + tileSize / 2);
            ctx.textBaseline = 'alphabetic';
          });
        });

        // =========================================================
        // 🌟 REFINED YELLOW SCORE BADGE BOX (Clean, elegant, non-chunky)
        // =========================================================
        const hlW = isFullWidth ? 620 : 340;
        const hlH = 220;
        const hlX = x + w - hlW - 35;
        const hlY = y + 120;

        // Softer golden yellow pill container with subtle shadow
        ctx.save();
        ctx.shadowColor = 'rgba(234, 179, 8, 0.35)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        const hr = 20;
        ctx.roundRect ? ctx.roundRect(hlX, hlY, hlW, hlH, hr) : ctx.rect(hlX, hlY, hlW, hlH);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Refined typography inside Yellow Box (clean, balanced font weight)
        ctx.fillStyle = '#1e1b4b'; // Deep navy/black for premium contrast
        ctx.textAlign = 'center';

        ctx.font = '700 24px sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText('SCORE', hlX + hlW / 2, hlY + 50);

        // Elegant score text (lighter weight & balanced size so it's not overly bold)
        ctx.font = '700 50px sans-serif';
        const guessesCount = parsedGuesses.length;
        const scoreLabel = dayScore.status === 'won' ? `${guessesCount} / 6` : 'Unsolved';
        ctx.fillText(scoreLabel, hlX + hlW / 2, hlY + 115);

        if (dayScore.skill_score) {
          ctx.font = '600 40px sans-serif';
          ctx.fillStyle = '#3f3f46';
          ctx.fillText(`${dayScore.skill_score}`, hlX + hlW / 2, hlY + 175);
        }
      } else {
        // Unplayed Day Placeholder
        ctx.fillStyle = '#6b7280';
        ctx.font = '700 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No puzzle completed', x + w / 2, y + h / 2 + 10);
      }

      ctx.restore();
    });

    // 6. Footer Branding & Social Link
    const footerY = height - 140;
    ctx.fillStyle = '#818cf8';
    ctx.font = '900 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY DAILY AT WWW.WORDLE-VARIANT.XYZ', width / 2, footerY);

    ctx.fillStyle = '#6b7280';
    ctx.font = '700 38px sans-serif';
    ctx.fillText('Share your Weekly Recap with friends! 🧩✨', width / 2, footerY + 60);

    return canvas;
  };

  // Download High-Res Image Handler (100% Lossless Pixel-Perfect PNG)
  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const canvas = generateHighResCanvas();
      canvas.toBlob((blob) => {
        if (!blob) {
          setDownloading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Variant-Weekly-Wrapped-${username}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setDownloading(false);
      }, 'image/png');
    } catch (e) {
      console.error('Failed to export mosaic image:', e);
      setDownloading(false);
    }
  };

  // Share Image Handler (100% Lossless Pixel-Perfect PNG)
  const handleShareImage = async () => {
    try {
      const canvas = generateHighResCanvas();
      canvas.toBlob(async (blob) => {
        if (blob && navigator.share && navigator.canShare) {
          const file = new File([blob], `WeeklyWrapped-${username}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${username}'s Weekly Wordle Wrapped`,
              text: `Check out my Weekly Wordle Mosaic! Ranked #${userRank?.rank || 'N/A'} globally. 🔥`,
              files: [file],
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 3000);
            return;
          }
        }
        // Fallback: download if web share API isn't supported
        handleDownloadImage();
      }, 'image/png');
    } catch (e) {
      console.error('Share failed:', e);
      handleDownloadImage();
    }
  };

  return (
    <div className="relative w-full max-w-4xl h-[94vh] my-auto mx-auto bg-slate-950 text-white border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl overflow-hidden select-none flex flex-col justify-between gap-2.5 sm:gap-3">
      {/* Background Rainbow Glow Effects */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER CONTROLS */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 sm:p-1.5 bg-linear-to-br from-amber-500/20 to-yellow-500/20 rounded-lg border border-amber-500/40 text-amber-400">
            <Sparkles size={15} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5 leading-none">
              Weekly Recap Mosaic
              <span className="text-[8px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.2 rounded-full border border-amber-500/40 uppercase">
                Ultra HD
              </span>
            </h2>
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium leading-none mt-0.5">Your 7-day word journey highlighted in high fidelity</p>
          </div>
        </div>

        {/* Switch to Animated Slide Mode & Close */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={onSwitchToSlides}
            className="flex items-center gap-1.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-md shadow-indigo-950 active:scale-95 cursor-pointer"
            title="Play Video Slides"
          >
            <Film size={12} />
            <span className="hidden sm:inline">Play Video Slides</span>
            <span className="sm:hidden">Play</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 bg-white/5 hover:bg-white/15 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* HERO USER RECAP CARD */}
      <div className="relative z-10 bg-linear-to-r from-slate-900/90 via-purple-950/40 to-slate-900/90 border border-white/10 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 shadow-xs backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with fallback */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-amber-400 shadow-xs shrink-0">
            <ProtectedAvatar
              userId={userId}
              src={avatarUrl || undefined}
              username={username}
              className="w-full h-full"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <h3 className="text-xs sm:text-sm font-black text-white truncate">
                @{username}
              </h3>
              {weeklyAwards.length > 0 && (
                <div className="flex items-center gap-1">
                  {weeklyAwards.slice(0, 2).map((award) => (
                    <span
                      key={award.id}
                      className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5"
                    >
                      <Trophy size={9} className="text-amber-400" />
                      {award.award_type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-gray-300 font-bold leading-none mt-1">
              <span>{gamesWon}/{gamesPlayed} Won</span>
              <span>•</span>
              <span className="text-amber-400">{totalScore} Pts</span>
              <span>•</span>
              <span className="text-emerald-400">{winRate}% Rate</span>
            </div>
          </div>
        </div>

        {/* Rank Badge */}
        {userRank && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/40 rounded-lg text-amber-300 shrink-0">
            <Trophy size={14} className="text-amber-400" />
            <div>
              <span className="text-[7px] font-black uppercase tracking-tighter text-amber-400 block leading-none">
                Global Rank
              </span>
              <span className="text-[11px] sm:text-xs font-black text-white leading-none">
                #{userRank.rank}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 7-DAY MOSAIC BENTO GRID (Balanced full-height grid) */}
      <div ref={mosaicRef} className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 flex-1 min-h-0 overflow-y-auto sm:overflow-hidden py-0.5">
        {dayThemes.map((theme: DayTheme, idx: number) => {
          const score = weeklyScores[idx];
          const isSunday = idx === 6;
          const parsedGuesses = score ? getParsedGuesses(score) : [];

          return (
            <motion.div
              key={theme.name}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.02 }}
              className={`relative bg-linear-to-b ${theme.bg} border ${theme.border} rounded-xl p-1.5 sm:p-2.5 flex flex-col justify-between shadow-xs overflow-hidden ${isSunday ? 'col-span-2 sm:col-span-2' : ''
                }`}
            >
              {/* Header: Week day title */}
              <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
                <span className={`text-[9px] font-black uppercase tracking-wider ${theme.text} flex items-center gap-0.5 leading-none`}>
                  <Flame size={9} />
                  {theme.name}
                </span>

                {score ? (
                  <span
                    className={`text-[7px] font-extrabold px-1 py-0 rounded-full leading-tight ${score.status === 'won'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                  >
                    {score.status === 'won' ? '✓' : '✕'}
                  </span>
                ) : (
                  <span className="text-[7px] font-bold text-gray-500 uppercase leading-none">-</span>
                )}
              </div>

              {/* Grid content & Yellow Score Box (Minimized gap and padding) */}
              {score ? (
                <div className="flex items-center justify-between gap-1 my-auto">
                  {/* Guess Word Tile Grid (Compact) */}
                  <div className="space-y-0.5">
                    {parsedGuesses.slice(0, 6).map((row: any, r: number) => (
                      <div key={r} className="flex items-center gap-0.5">
                        {row.map((item: any, c: number) => (
                          <div
                            key={c}
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[2px] flex items-center justify-center font-black text-[7px] uppercase leading-none ${item.status === 'correct'
                              ? 'bg-emerald-500 text-black'
                              : item.status === 'present'
                                ? 'bg-amber-400 text-black'
                                : 'bg-gray-800 text-white/90 border border-white/10'
                              }`}
                          >
                            {item.letter}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* 🌟 YELLOW HIGHLIGHTED SCORE & SKILL GRID BOX (Tight minimal padding) */}
                  <div className="px-1.5 py-0.5 bg-yellow-400 border border-yellow-300 rounded-md text-black shadow-xs text-center shrink-0 min-w-13">
                    <span className="text-[6px] font-black uppercase tracking-tighter block text-black/75 leading-none">
                      SCORE
                    </span>
                    <span className="text-[11px] sm:text-xs font-black block leading-tight text-black">
                      {score.status === 'won' ? `${parsedGuesses.length}/6` : 'FAIL'}
                    </span>
                    {score.skill_score ? (
                      <span className="text-[7px] font-extrabold block text-black/90 leading-none">
                        ⚡ {score.skill_score}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-center py-1 text-[8px] font-bold text-gray-500 italic my-auto">
                  No puzzle
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ACTION BAR FOOTER */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 border-t border-white/10 pt-1.5 shrink-0">
        <div className="text-[9px] text-gray-400 font-semibold">
          High-Fidelity Social Share Card • <span className="text-indigo-400 font-bold">wordle-variant.xyz</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadImage}
            disabled={downloading}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg transition-all border border-white/15 cursor-pointer disabled:opacity-50"
          >
            <Download size={11} />
            <span>{downloading ? 'Exporting...' : 'Download Image'}</span>
          </button>

          <button
            onClick={handleShareImage}
            className="flex items-center gap-1 bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black uppercase text-[10px] px-2.5 py-1 rounded-lg transition-all shadow-sm shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Share2 size={11} />
            <span>{shareSuccess ? 'Shared!' : 'Share Mosaic'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
