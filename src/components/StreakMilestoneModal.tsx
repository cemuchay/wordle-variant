import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Sparkles, Trophy, X, ChevronRight } from 'lucide-react';
import { Z_INDEX } from '../constants/ui';

interface MilestoneDetail {
  milestone: number;
  type: string;
}

export const StreakMilestoneModal: React.FC = () => {
  const [unlockedDetail, setUnlockedDetail] = useState<MilestoneDetail | null>(null);

  useEffect(() => {
    const handleMilestoneUnlocked = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as MilestoneDetail;
      if (detail && detail.milestone) {
        setUnlockedDetail(detail);
      }
    };

    window.addEventListener('streak-milestone-unlocked', handleMilestoneUnlocked);
    return () => window.removeEventListener('streak-milestone-unlocked', handleMilestoneUnlocked);
  }, []);

  if (!unlockedDetail) return null;

  const milestoneValue = unlockedDetail.milestone;
  const milestoneTitle = milestoneValue === 365 ? '365 Days (1 Year)' : `${milestoneValue} Days`;

  const handleClose = () => {
    setUnlockedDetail(null);
  };

  const handleViewCabinet = () => {
    setUnlockedDetail(null);
    window.dispatchEvent(
      new CustomEvent('open-stats-modal', { detail: { tab: 'stats' } })
    );
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none"
        style={{ zIndex: Z_INDEX.USER_PROFILE + 50 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-gray-950 to-black border border-amber-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center space-y-5 overflow-hidden"
        >
          {/* Background Ambient Orbs */}
          <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer z-10"
          >
            <X size={18} />
          </button>

          {/* Header Trophy Icon */}
          <div className="relative inline-flex items-center justify-center pt-2">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative p-4 bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border-2 border-amber-500/40 rounded-3xl text-amber-400 shadow-xl">
              <Flame size={48} className="fill-amber-400/20 animate-bounce" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-400 text-[10px] font-black uppercase tracking-widest">
              <Sparkles size={12} /> Milestone Unlocked!
            </div>
            <h2 className="text-2xl font-black uppercase tracking-wider text-white">
              {milestoneTitle} Streak! 🔥
            </h2>
            <p className="text-xs text-gray-300 font-medium leading-relaxed max-w-xs mx-auto">
              Outstanding consistency! You completed {milestoneValue} consecutive daily puzzles without breaking your streak.
            </p>
          </div>

          {/* Trophy Info Card */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-left">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400 shrink-0">
              <Trophy size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                New Trophy Awarded
              </div>
              <div className="text-xs font-bold text-white truncate">
                {milestoneTitle} Trophy Badge
              </div>
              <div className="text-[9px] text-gray-400 font-semibold truncate">
                Permanently saved to your Trophy Cabinet
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleViewCabinet}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black uppercase text-xs py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View Trophy Cabinet</span>
              <ChevronRight size={15} />
            </button>

            <button
              onClick={handleClose}
              className="w-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold uppercase text-[11px] tracking-wider py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Keep Playing
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
