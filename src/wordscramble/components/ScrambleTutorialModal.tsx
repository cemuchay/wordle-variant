import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  Sparkles,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { ModalLayout } from '../../components/layout/ModalLayout';

interface ScrambleTutorialModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  'welcome',
  'staging-and-selection',
  'timed-and-bonus',
  'milestones-and-streaks',
  'ready',
] as const;

const TOTAL = STEPS.length;

const slideVariants = {
  enter: ({ direction }: { direction: number }) => ({
    x: direction > 0 ? 250 : -250,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: ({ direction }: { direction: number }) => ({
    x: direction < 0 ? 250 : -250,
    opacity: 0,
  }),
};

export const ScrambleTutorialModal: React.FC<ScrambleTutorialModalProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const current = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOTAL - 1;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 24) {
      setHasScrolledToBottom(true);
    }
  }, []);

  useEffect(() => {
    setHasScrolledToBottom(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      const timer = setTimeout(() => {
        const el = scrollRef.current;
        if (el && el.scrollHeight <= el.clientHeight + 4) {
          setHasScrolledToBottom(true);
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [stepIndex]);

  if (!isOpen) return null;

  const goNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setDirection(1);
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (isFirst) return;
    setDirection(-1);
    setStepIndex((i) => i - 1);
  };

  const renderStep = () => {
    switch (current) {
      case 'welcome':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-gradient-to-tr from-pink-500/20 via-amber-500/20 to-cyan-500/20 p-3 rounded-2xl border border-pink-500/30 mb-3.5">
              <Sparkles className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              Welcome to Word Scramble
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Word Scramble is a fast-paced anagram puzzle and word matrix game. Unscramble valid words from the letter pool, rack up massive score streaks, and race against the clock!
            </p>

            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3.5 text-left w-full space-y-2">
              <p className="text-xs text-amber-300 font-black uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                <span>Core Objective:</span>
              </p>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4 font-medium">
                <li>Form valid words matching your selected target lengths (e.g. 5L, 4L+5L).</li>
                <li>Each tile has a Scrabble letter point value with rainbow color coding.</li>
                <li>Discover secret original spool words for a <span className="text-amber-300 font-bold">+50% score bonus</span>!</li>
              </ul>
            </div>
          </div>
        );

      case 'staging-and-selection':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 mb-3.5">
              <Layers className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              Building Words & Controls
            </h3>
            <p className="text-xs text-slate-300 mb-3.5">
              Select letters directly on screen or type seamlessly on your keyboard:
            </p>

            <div className="space-y-2.5 w-full text-left">
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2.5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-pink-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0">1</span>
                <div>
                  <p className="text-xs font-black text-white uppercase">Tap or Type Letters</p>
                  <p className="text-[10px] text-slate-400">Tap letters from the matrix below to move them up into the submission tray, or type directly on desktop.</p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2.5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-cyan-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0">2</span>
                <div>
                  <p className="text-xs font-black text-white uppercase">Reorder & Unstage</p>
                  <p className="text-[10px] text-slate-400">Tap staged letters to remove them, or use the ◀ ▶ buttons on the rack to quickly swap letter positions.</p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2.5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-indigo-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0">🔀</span>
                <div>
                  <p className="text-xs font-black text-white uppercase">Shuffle Letter Pool</p>
                  <p className="text-[10px] text-slate-400">Tap <span className="font-bold text-cyan-300">Shuffle</span> (or press Spacebar) anytime to spot new anagram combinations.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'timed-and-bonus':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 mb-3.5">
              <Timer className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              Time Bonuses & Speed Decay
            </h3>
            <p className="text-xs text-slate-300 mb-3.5">
              In Timed Rush mode, quick thinking keeps your game alive indefinitely:
            </p>

            <div className="space-y-2.5 w-full text-left">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3">
                <p className="text-xs font-black text-emerald-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Time Bonus on Submissions</span>
                </p>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Every correct word adds <span className="text-emerald-400 font-bold">+2s to +6s</span> back to the clock. High-value words and fast submissions award extra bonus seconds!
                </p>
              </div>

              <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3">
                <p className="text-xs font-black text-rose-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Progressive Clock Decay</span>
                </p>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  As you clear more words (10, 20, 30+), the clock decay accelerates (<span className="text-rose-400 font-bold">1.1x up to 1.5x</span> speed). Stay sharp and keep your word stream flowing!
                </p>
              </div>
            </div>
          </div>
        );

      case 'milestones-and-streaks':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-pink-500/10 p-3 rounded-2xl border border-pink-500/20 mb-3.5">
              <Trophy className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              Milestones & Streaks
            </h3>
            <p className="text-xs text-slate-300 mb-3.5">
              Unlock prestigious ranks and boost your multiplier:
            </p>

            <div className="grid grid-cols-2 gap-2 w-full text-left">
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5">
                <span className="text-xl">🥉</span>
                <p className="text-[11px] font-black text-amber-300 mt-1">5 Words</p>
                <p className="text-[9px] text-slate-400">Bronze Wordsmith unlocked.</p>
              </div>
              <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-2.5">
                <span className="text-xl">🥈</span>
                <p className="text-[11px] font-black text-cyan-300 mt-1">10 Words</p>
                <p className="text-[9px] text-slate-400">Silver Striker unlocked.</p>
              </div>
              <div className="bg-slate-900/90 border border-yellow-500/30 rounded-xl p-2.5">
                <span className="text-xl">🥇</span>
                <p className="text-[11px] font-black text-yellow-300 mt-1">15 Words</p>
                <p className="text-[9px] text-slate-400">Golden Anagramist unlocked.</p>
              </div>
              <div className="bg-slate-900/90 border border-fuchsia-500/30 rounded-xl p-2.5">
                <span className="text-xl">👑</span>
                <p className="text-[11px] font-black text-fuchsia-300 mt-1">25+ Words</p>
                <p className="text-[9px] text-slate-400">Diamond Scramble Master.</p>
              </div>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-cyan-500/20 p-3 rounded-2xl border border-emerald-500/30 mb-3.5">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              Ready to Scramble?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              You are ready to enter the matrix! Form words, trigger time extensions, hit milestone achievements, and set new high scores.
            </p>

            <button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-purple-600/30"
            >
              Start Playing
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onSkip}
      showCloseButton={false}
      maxWidth="sm"
      containerClassName="bg-slate-950 border border-slate-800 shadow-2xl p-0 flex flex-col max-h-[85vh] overflow-hidden"
    >
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex
                  ? 'bg-gradient-to-r from-pink-500 to-cyan-400 w-5'
                  : 'bg-slate-800 w-1.5'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
          {stepIndex + 1} of {TOTAL}
        </span>
      </div>

      {/* Step Content */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <AnimatePresence mode="wait" custom={{ direction }}>
          <motion.div
            key={current}
            custom={{ direction }}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation Controls */}
      <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-white/5 shrink-0">
        <button
          onClick={onSkip}
          className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
        >
          Skip Guide
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 px-3 py-2 text-[10px] text-slate-300 font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}

          {!hasScrolledToBottom ? (
            <div className="flex items-center gap-1 px-3 py-2 text-[10px] text-amber-400 font-bold animate-pulse">
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Scroll</span>
            </div>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-1 bg-gradient-to-r from-pink-500 to-cyan-500 text-slate-950 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shadow-md"
            >
              {isLast ? 'Start' : 'Next'}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </ModalLayout>
  );
};

export default ScrambleTutorialModal;
