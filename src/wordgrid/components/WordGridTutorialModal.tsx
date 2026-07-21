import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, Sparkles, HelpCircle, Shuffle, LayoutGrid } from 'lucide-react';

interface WordGridTutorialModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  'welcome',
  'interactions',
  'shuffle-rules',
  'scoring',
  'ready',
] as const;

const TOTAL = STEPS.length;

const slideVariants = {
  enter: ({ direction }: { direction: number }) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: ({ direction }: { direction: number }) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export const WordGridTutorialModal = ({ onComplete, onSkip }: WordGridTutorialModalProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const current = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOTAL - 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

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

  const goNext = () => {
    if (isLast) { onComplete(); return; }
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
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 mb-4">
              <LayoutGrid className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">
              Welcome to WordGrid
            </h3>
            <p className="text-xs text-white leading-relaxed mb-6">
              WordGrid is a tactical, Scrabble-style multiplayer board game. Place words on the board, build on existing letters, and score points to defeat your opponent!
            </p>

            <div className="bg-[#27272a] border border-white/10 rounded-xl p-4 text-left w-full space-y-2">
              <p className="text-xs text-white font-black uppercase tracking-wider">Basic Rules:</p>
              <ul className="text-[10px] text-white space-y-1.5 list-disc pl-4 font-bold">
                <li>Form valid English words horizontally or vertically.</li>
                <li>All newly placed tiles in a turn must lie along a single straight line.</li>
                <li>At least one placed tile must connect to a letter already on the board (or the center star on the very first turn).</li>
              </ul>
            </div>
          </div>
        );

      case 'interactions':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 mb-4">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">
              How to Place Tiles
            </h3>
            <p className="text-xs text-white mb-4">
              There are two intuitive ways to play tiles from your rack onto the board:
            </p>

            <div className="space-y-3 w-full text-left">
              <div className="bg-[#27272a] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-indigo-600 text-white font-black flex items-center justify-center text-[10px] shrink-0">1</span>
                <div>
                  <p className="text-xs font-black text-white uppercase">Tap to Place</p>
                  <p className="text-[10px] text-white">Tap a letter tile in your rack, then tap an empty spot on the grid.</p>
                </div>
              </div>
              <div className="bg-[#27272a] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-indigo-600 text-white font-black flex items-center justify-center text-[10px] shrink-0">2</span>
                <div>
                  <p className="text-xs font-black text-white uppercase">Drag &amp; Drop</p>
                  <p className="text-[10px] text-white">Simply touch or click a tile from your rack, drag it, and drop it directly onto the grid.</p>
                </div>
              </div>
              <div className="bg-[#27272a] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-rose-600 text-white font-black flex items-center justify-center text-[10px] shrink-0">↩</span>
                <div>
                  <p className="text-xs font-black text-white uppercase">Recall Tiles</p>
                  <p className="text-[10px] text-white">Tap a placed tile on the board to return it to your rack, or use <span className="font-black text-white">Recall All</span>.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'shuffle-rules':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 mb-4">
              <Shuffle className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">
              Shuffle &amp; Rack Actions
            </h3>
            <p className="text-xs text-white mb-4">
              Managing your letters is key to forming high-scoring combinations.
            </p>

            <div className="space-y-3 w-full text-left">
              <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-3.5">
                <p className="text-xs font-black text-white uppercase tracking-wider mb-1">🔀 The Shuffle Button</p>
                <p className="text-[10px] text-white leading-relaxed">
                  Tapping <span className="font-black text-white">Shuffle</span> only rearranges the visual order of the tiles already on your rack. It <span className="text-yellow-500 font-black">does not draw new tiles</span> or change your letters. It simply helps you spot anagrams and has no impact on gameplay fairness!
                </p>
              </div>

              <div className="bg-[#27272a] border border-white/10 rounded-xl p-3.5">
                <p className="text-xs font-black text-white uppercase tracking-wider mb-1">🔄 Exchange Tiles</p>
                <p className="text-[10px] text-white leading-relaxed">
                  Don't like your letters? You can use your turn to select letters and trade them back into the tile bag to draw fresh ones. This costs you your turn!
                </p>
              </div>
            </div>
          </div>
        );

      case 'scoring':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 mb-4">
              <HelpCircle className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">
              Premium Multipliers
            </h3>
            <p className="text-xs text-white mb-4">
              Place tiles on special colored grid spaces to maximize your score:
            </p>

            <div className="grid grid-cols-2 gap-2.5 w-full text-left">
              <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-2.5">
                <span className="text-[9px] font-black uppercase bg-sky-600 text-white px-1.5 py-0.5 rounded">DL</span>
                <p className="text-[11px] font-black text-white mt-1.5">Double Letter</p>
                <p className="text-[9px] text-white/70">Doubles the score of the letter placed here.</p>
              </div>
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-2.5">
                <span className="text-[9px] font-black uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded">TL</span>
                <p className="text-[11px] font-black text-white mt-1.5">Triple Letter</p>
                <p className="text-[9px] text-white/70">Triples the score of the letter placed here.</p>
              </div>
              <div className="bg-orange-950/40 border border-orange-500/30 rounded-xl p-2.5">
                <span className="text-[9px] font-black uppercase bg-orange-600 text-white px-1.5 py-0.5 rounded">DW</span>
                <p className="text-[11px] font-black text-white mt-1.5">Double Word</p>
                <p className="text-[9px] text-white/70">Doubles the total score of the entire word.</p>
              </div>
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5">
                <span className="text-[9px] font-black uppercase bg-rose-600 text-white px-1.5 py-0.5 rounded">TW</span>
                <p className="text-[11px] font-black text-white mt-1.5">Triple Word</p>
                <p className="text-[9px] text-white/70">Triples the total score of the entire word.</p>
              </div>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-green-500/10 p-3 rounded-2xl border border-green-500/20 mb-4">
              <Sparkles className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">
              Ready to Win?
            </h3>
            <p className="text-xs text-white leading-relaxed mb-6">
              You are ready to enter the grid! Form words, use the multipliers, drag or tap tiles to play, and score big! Good luck!
            </p>

            <button
              onClick={onComplete}
              className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              Enter WordGrid
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-120 p-4">
      <div className="bg-[#18181b] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Step indicator */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? 'bg-indigo-500 w-5' : 'bg-gray-800 w-1.5'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-white font-black uppercase tracking-wider">
            {stepIndex + 1} of {TOTAL}
          </span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-4 min-h-0" ref={scrollRef} onScroll={handleScroll}>
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

        {/* Bottom navigation */}
        <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-white/5 shrink-0">
          <button
            onClick={onSkip}
            className="text-[10px] text-white font-black uppercase tracking-wider hover:text-white/70 transition-colors cursor-pointer"
          >
            Skip Guide
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-3 py-2 text-[10px] text-white font-black uppercase tracking-wider hover:text-white/70 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {!hasScrolledToBottom ? (
              <div className="flex items-center gap-1 px-3 py-2 text-[10px] text-white font-black animate-pulse">
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Scroll</span>
              </div>
            ) : (
              <button
                onClick={goNext}
                className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer shadow-md"
              >
                {isLast ? 'Start' : 'Next'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default WordGridTutorialModal;
