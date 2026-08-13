import React from 'react';
import { Flame, Trophy } from 'lucide-react';

export interface StreakCounterProps {
  currentStreak: number;
  maxStreak: number;
  size?: 'small' | 'big';
  onClick?: () => void;
  className?: string;
}

const MILESTONES = [50, 100, 250, 365, 500, 1000];

const getMilestoneData = (streak: number) => {
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

  let label = `${target} days`;
  if (target === 365) {
    label = '365 days (1 year)';
  } else if (target === 730) {
    label = '730 days (2 years)';
  } else if (target > 365 && target % 365 === 0) {
    label = `${target} days (${target / 365} years)`;
  }

  const range = target - prev;
  const progressRatio = Math.max(0, Math.min(1, (streak - prev) / range));
  const percent = Math.round(progressRatio * 100);
  const remaining = Math.max(0, target - streak);

  return {
    target,
    prev,
    label,
    percent,
    remaining,
  };
};

export const StreakCounter: React.FC<StreakCounterProps> = ({
  currentStreak = 0,
  maxStreak = 0,
  size = 'small',
  onClick,
  className = '',
}) => {
  const milestone = getMilestoneData(currentStreak);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      window.dispatchEvent(
        new CustomEvent('open-stats-modal', { detail: { tab: 'stats' } })
      );
    }
  };

  if (size === 'small') {
    return (
      <button
        onClick={handleClick}
        className={`shrink-0 px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${className}`}
        title={`Current streak: ${currentStreak} days (Max: ${maxStreak})`}
      >
        <Flame size={13} className="text-amber-400 fill-amber-400/20 shrink-0 animate-pulse" />
        <span>Streak {currentStreak} {currentStreak === 1 ? 'day' : 'days'}</span>
      </button>
    );
  }

  return (
    <div className={`w-full bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 shadow-lg backdrop-blur-sm space-y-3 text-left ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
            <Flame size={22} className="fill-amber-400/20 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              Current Streak
            </div>
            <div className="text-xl font-black text-white leading-tight">
              {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>

        <div className="text-right bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
          <div className="flex items-center justify-end gap-1 text-[9px] font-bold uppercase text-gray-400 tracking-wider">
            <Trophy size={10} className="text-amber-400" /> Maximum
          </div>
          <div className="text-sm font-black text-gray-200">
            {maxStreak} {maxStreak === 1 ? 'day' : 'days'}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-gray-400 uppercase tracking-wider">
            Next Milestone: <strong className="text-amber-300">{milestone.label}</strong>
          </span>
          <span className="text-amber-400 font-mono">
            {milestone.remaining === 0 ? 'Milestone Reached! 🎉' : `${milestone.remaining} ${milestone.remaining === 1 ? 'day' : 'days'} left`}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-linear-to-r from-amber-500 to-yellow-400 transition-all duration-700 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
            style={{ width: `${milestone.percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
