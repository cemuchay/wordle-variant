import React from "react";
import { Flame, Trophy, Award, TrendingUp, BarChart2 } from "lucide-react";
import type { GameStats, GuessResult } from "../../types/game";

interface StreakMilestoneCardProps {
  stats: GameStats | null;
  guesses?: GuessResult[][];
  isWon?: boolean;
}

const MILESTONES = [7, 14, 30, 50, 100, 250, 365, 500, 1000];

const getMilestoneProgress = (streak: number) => {
  let prev = 0;
  let target = MILESTONES[0];

  for (let i = 0; i < MILESTONES.length; i++) {
    if (streak < MILESTONES[i]) {
      target = MILESTONES[i];
      prev = i === 0 ? 0 : MILESTONES[i - 1];
      break;
    }
  }

  if (streak >= MILESTONES[MILESTONES.length - 1]) {
    const last = MILESTONES[MILESTONES.length - 1];
    const step = 500;
    const overflowSteps = Math.floor((streak - last) / step) + 1;
    target = last + overflowSteps * step;
    prev = target - step;
  }

  const range = target - prev;
  const progressRatio = Math.max(0, Math.min(1, (streak - prev) / range));
  const percent = Math.round(progressRatio * 100);
  const remaining = Math.max(0, target - streak);

  return { target, prev, percent, remaining };
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
          <div className="p-1 bg-amber-500/15 rounded-lg border border-amber-500/30 text-amber-400">
            <Flame size={14} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
            Streak & Milestones
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
          <Trophy size={12} className="text-yellow-500" />
          <span>Best: {maxStreak}d</span>
        </div>
      </div>

      {/* Streak Progress Bar */}
      <div className="space-y-1 bg-black/30 p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase tracking-wide text-white flex items-center gap-1">
            <Flame size={13} className="text-orange-400 fill-orange-400/30" />
            {currentStreak}d Streak
          </span>
          <span className="text-[9px] font-bold text-gray-400">
            {milestone.remaining > 0 ? `${milestone.remaining}d to ${milestone.target}d Goal` : "Goal Reached!"}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden p-0.5 border border-white/5">
          <div
            style={{ width: `${milestone.percent}%` }}
            className="h-full bg-linear-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-1000 shadow-sm shadow-orange-500/50"
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
                      className={`h-full flex items-center justify-end px-1.5 text-[9px] font-bold text-white transition-all duration-700 ${
                        isCurrent ? "bg-emerald-500 shadow-xs shadow-emerald-500/50 font-black" : "bg-gray-700"
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
