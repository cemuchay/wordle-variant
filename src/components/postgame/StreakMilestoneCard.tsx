import React from "react";
import { Flame, Trophy, BarChart2 } from "lucide-react";
import type { GameStats, GuessResult } from "../../types/game";

interface StreakMilestoneCardProps {
  stats: GameStats | null;
  guesses?: GuessResult[][];
  isWon?: boolean;
}

interface MilestoneTheme {
  name: string;
  gradient: string;
  shadow: string;
  text: string;
  badgeBg: string;
  badgeBorder: string;
  flameColor: string;
}

const MILESTONE_CONFIGS: { target: number; theme: MilestoneTheme }[] = [
  {
    target: 7,
    theme: {
      name: "Bronze Spark",
      gradient: "bg-linear-to-r from-red-500 to-rose-500",
      shadow: "shadow-red-500/50",
      text: "text-rose-400",
      badgeBg: "bg-red-500/15",
      badgeBorder: "border-red-500/30",
      flameColor: "text-red-400 fill-red-400/30",
    },
  },
  {
    target: 14,
    theme: {
      name: "Solar Flare",
      gradient: "bg-linear-to-r from-orange-500 to-amber-500",
      shadow: "shadow-orange-500/50",
      text: "text-orange-400",
      badgeBg: "bg-orange-500/15",
      badgeBorder: "border-orange-500/30",
      flameColor: "text-orange-400 fill-orange-400/30",
    },
  },
  {
    target: 30,
    theme: {
      name: "Golden Beacon",
      gradient: "bg-linear-to-r from-amber-400 to-yellow-300",
      shadow: "shadow-yellow-400/50",
      text: "text-yellow-400",
      badgeBg: "bg-yellow-500/15",
      badgeBorder: "border-yellow-500/30",
      flameColor: "text-yellow-400 fill-yellow-400/30",
    },
  },
  {
    target: 50,
    theme: {
      name: "Emerald Surge",
      gradient: "bg-linear-to-r from-emerald-500 to-teal-400",
      shadow: "shadow-emerald-500/50",
      text: "text-emerald-400",
      badgeBg: "bg-emerald-500/15",
      badgeBorder: "border-emerald-500/30",
      flameColor: "text-emerald-400 fill-emerald-400/30",
    },
  },
  {
    target: 100,
    theme: {
      name: "Cyan Tempest",
      gradient: "bg-linear-to-r from-cyan-500 to-blue-500",
      shadow: "shadow-cyan-500/50",
      text: "text-cyan-400",
      badgeBg: "bg-cyan-500/15",
      badgeBorder: "border-cyan-500/30",
      flameColor: "text-cyan-400 fill-cyan-400/30",
    },
  },
  {
    target: 250,
    theme: {
      name: "Indigo Nebula",
      gradient: "bg-linear-to-r from-indigo-500 to-blue-600",
      shadow: "shadow-indigo-500/50",
      text: "text-indigo-400",
      badgeBg: "bg-indigo-500/15",
      badgeBorder: "border-indigo-500/30",
      flameColor: "text-indigo-400 fill-indigo-400/30",
    },
  },
  {
    target: 365,
    theme: {
      name: "Violet Eclipse",
      gradient: "bg-linear-to-r from-purple-500 to-violet-600",
      shadow: "shadow-purple-500/50",
      text: "text-purple-400",
      badgeBg: "bg-purple-500/15",
      badgeBorder: "border-purple-500/30",
      flameColor: "text-purple-400 fill-purple-400/30",
    },
  },
  {
    target: 500,
    theme: {
      name: "Fuchsia Nova",
      gradient: "bg-linear-to-r from-pink-500 to-fuchsia-500",
      shadow: "shadow-pink-500/50",
      text: "text-pink-400",
      badgeBg: "bg-pink-500/15",
      badgeBorder: "border-pink-500/30",
      flameColor: "text-pink-400 fill-pink-400/30",
    },
  },
  {
    target: 1000,
    theme: {
      name: "Prismatic Legend",
      gradient: "bg-linear-to-r from-rose-500 via-yellow-400 via-emerald-400 via-cyan-400 to-purple-500",
      shadow: "shadow-purple-500/50",
      text: "text-amber-300",
      badgeBg: "bg-purple-500/15",
      badgeBorder: "border-purple-500/30",
      flameColor: "text-amber-400 fill-amber-400/30",
    },
  },
];

const getMilestoneProgress = (streak: number) => {
  let prev = 0;
  let target = MILESTONE_CONFIGS[0].target;
  let theme = MILESTONE_CONFIGS[0].theme;

  for (let i = 0; i < MILESTONE_CONFIGS.length; i++) {
    if (streak < MILESTONE_CONFIGS[i].target) {
      target = MILESTONE_CONFIGS[i].target;
      prev = i === 0 ? 0 : MILESTONE_CONFIGS[i - 1].target;
      theme = MILESTONE_CONFIGS[i].theme;
      break;
    }
  }

  if (streak >= MILESTONE_CONFIGS[MILESTONE_CONFIGS.length - 1].target) {
    const last = MILESTONE_CONFIGS[MILESTONE_CONFIGS.length - 1].target;
    const step = 500;
    const overflowSteps = Math.floor((streak - last) / step) + 1;
    target = last + overflowSteps * step;
    prev = target - step;
    theme = MILESTONE_CONFIGS[MILESTONE_CONFIGS.length - 1].theme;
  }

  const progressRatio = Math.max(0, Math.min(1, streak / target));
  const percent = Number((progressRatio * 100).toFixed(1));
  const remaining = Math.max(0, target - streak);

  return { target, prev, percent, remaining, theme };
};

export const StreakMilestoneCard: React.FC<StreakMilestoneCardProps> = ({
  stats,
  guesses,
  isWon = false,
}) => {
  const currentStreak = stats?.currentStreak ?? 0;
  const maxStreak = stats?.maxStreak ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const gamesWon = stats?.gamesWon ?? 0;
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  const milestone = getMilestoneProgress(currentStreak);

  // Guess Distribution logic
  const guessCounts = stats?.guesses || {};
  const maxGuessCount = Math.max(1, ...Object.values(guessCounts).map((v) => Number(v) || 0));

  return (
    <div className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md space-y-3 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5">
          <div className={`p-1 ${milestone.theme.badgeBg} rounded-lg border ${milestone.theme.badgeBorder} ${milestone.theme.text}`}>
            <Flame size={14} />
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest ${milestone.theme.text}`}>
            Streak & Milestones
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
          <Trophy size={12} className="text-yellow-500" />
          <span>Best: {maxStreak}d</span>
        </div>
      </div>

      {/* Streak Progress Bar */}
      <div className="space-y-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase tracking-wide text-white flex items-center gap-1">
            <Flame size={13} className={milestone.theme.flameColor} />
            {currentStreak}d Streak
          </span>
          <span className="text-[9px] font-bold text-gray-400">
            {milestone.remaining > 0 ? `${milestone.remaining}d to ${milestone.target}d Goal (${milestone.percent}%)` : "Goal Reached!"}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-800/90 rounded-full overflow-hidden p-0.5 border border-white/5">
          <div
            style={{ width: `${milestone.percent}%` }}
            className={`h-full ${milestone.theme.gradient} rounded-full transition-all duration-1000 shadow-sm ${milestone.theme.shadow}`}
          />
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="p-2 bg-white/5 rounded-xl border border-white/5 text-center">
          <span className="text-base font-black text-white">{gamesPlayed}</span>
          <p className="text-[8px] uppercase font-bold text-gray-400">Played</p>
        </div>
        <div className="p-2 bg-white/5 rounded-xl border border-white/5 text-center">
          <span className="text-base font-black text-emerald-400">{winRate}%</span>
          <p className="text-[8px] uppercase font-bold text-gray-400">Win Rate</p>
        </div>
        <div className="p-2 bg-white/5 rounded-xl border border-white/5 text-center">
          <span className="text-base font-black text-indigo-400">{gamesWon}</span>
          <p className="text-[8px] uppercase font-bold text-gray-400">Total Wins</p>
        </div>
      </div>

      {/* Guess Distribution Mini Chart */}
      {Object.keys(guessCounts).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-gray-400">
            <BarChart2 size={12} />
            <span>Guess Distribution</span>
          </div>
          <div className="space-y-1">
            {Object.entries(guessCounts).map(([num, count]) => {
              const val = Number(count) || 0;
              const isCurrent = isWon && guesses && guesses.length === parseInt(num);
              const barWidth = Math.max(7, Math.round((val / maxGuessCount) * 100));

              return (
                <div key={num} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-[10px] font-bold text-gray-400 text-right">{num}</span>
                  <div className="flex-1 h-3.5 bg-black/40 rounded-sm overflow-hidden flex items-center">
                    <div
                      style={{ width: `${barWidth}%` }}
                      className={`h-full flex items-center justify-end px-1.5 text-[9px] font-bold text-white transition-all duration-700 ${isCurrent ? "bg-emerald-500 shadow-xs shadow-emerald-500/50 font-black" : "bg-gray-700"
                        }`}
                    >
                      {val}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
