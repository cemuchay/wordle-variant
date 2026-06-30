import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TutorialCell } from './TutorialCell';
import { ChevronLeft, ChevronRight, ChevronDown, Lightbulb } from 'lucide-react';
import { Z_INDEX } from '../constants/ui';

interface TutorialModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  'how-to-play',
  'sample-game',
  'colors',
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

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

interface KbStatuses {
  [key: string]: 'correct' | 'present' | 'absent';
}

const MiniKeyboard = ({ statuses }: { statuses: KbStatuses }) => (
  <div className="flex flex-col items-center gap-0.5 mt-3">
    {KEYBOARD_ROWS.map((row, ri) => (
      <div key={ri} className="flex gap-0.5">
        {row.map((letter) => {
          const s = statuses[letter];
          let cls = 'bg-gray-600/40 border-gray-600/40 text-gray-400';
          if (s === 'correct') cls = 'bg-correct border-correct text-white';
          else if (s === 'present') cls = 'bg-present border-present text-white';
          else if (s === 'absent') cls = 'bg-absent border-absent text-gray-500';
          return (
            <div
              key={letter}
              className={`flex items-center justify-center w-5 h-5 rounded-[3px] text-[7px] font-bold uppercase border ${cls}`}
            >
              {letter}
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

export const TutorialModal = ({ onComplete, onSkip }: TutorialModalProps) => {
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
      case 'how-to-play':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-correct/10 p-3 rounded-2xl border border-correct/20 mb-4">
              <Lightbulb className="w-6 h-6 text-correct" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-2">
              How to Play
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-6 max-w-xs">
              Find the hidden <span className="text-white font-bold">5-letter</span> word. You have{' '}
              <span className="text-white font-bold">6 tries</span>.
              After each guess, the tiles change color to show how close you are.
            </p>
            <div className="flex flex-col items-center gap-1">
              {Array.from({ length: 6 }).map((_, ri) => (
                <div key={ri} className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, ci) => (
                    <TutorialCell key={ci} letter="" status="empty" small delay={(ri * 5 + ci) * 0.02} />
                  ))}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-4">
              Start with a word containing common vowels like A, E, I, O, U
            </p>
          </div>
        );

      case 'sample-game':
        return (
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              Example Game
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Target: <span className="text-white font-bold">STORM</span> — 5-guess replay:
            </p>

            <div className="space-y-2 mb-3 w-full max-w-[240px]">
              {/* Guess 1 */}
              <div className="space-y-0.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider text-left">Guess 1</p>
                <div className="flex gap-1 justify-center">
                  <TutorialCell letter="S" status="correct" delay={0} />
                  <TutorialCell letter="L" status="absent" delay={0.04} />
                  <TutorialCell letter="I" status="absent" delay={0.08} />
                  <TutorialCell letter="M" status="present" delay={0.12} />
                  <TutorialCell letter="E" status="absent" delay={0.16} />
                </div>
                <p className="text-[8px] text-gray-500 text-left">S correct! M is in the word.</p>
              </div>

              {/* Guess 2 */}
              <div className="space-y-0.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider text-left">Guess 2</p>
                <div className="flex gap-1 justify-center">
                  <TutorialCell letter="T" status="present" delay={0} />
                  <TutorialCell letter="R" status="present" delay={0.04} />
                  <TutorialCell letter="A" status="absent" delay={0.08} />
                  <TutorialCell letter="M" status="present" delay={0.12} />
                  <TutorialCell letter="P" status="absent" delay={0.16} />
                </div>
                <p className="text-[8px] text-gray-500 text-left">T, R appear. M still misplaced.</p>
              </div>

              {/* Hint Banner */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 justify-center mb-0.5">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-wider">Hint Used</span>
                </div>
                <p className="text-[8px] text-gray-400">Revealed: <span className="text-white font-bold">"O" at position 3</span></p>
                <p className="text-[8px] text-red-400 font-bold">-100 points</p>
              </div>

              {/* Guess 3 */}
              <div className="space-y-0.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider text-left">Guess 3</p>
                <div className="flex gap-1 justify-center">
                  <TutorialCell letter="S" status="correct" delay={0} />
                  <TutorialCell letter="T" status="correct" delay={0.04} />
                  <TutorialCell letter="O" status="correct" delay={0.08} />
                  <TutorialCell letter="N" status="absent" delay={0.12} />
                  <TutorialCell letter="E" status="absent" delay={0.16} />
                </div>
                <p className="text-[8px] text-gray-500 text-left">O locks in position 3.</p>
              </div>

              {/* Guess 4 */}
              <div className="space-y-0.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider text-left">Guess 4</p>
                <div className="flex gap-1 justify-center">
                  <TutorialCell letter="S" status="correct" delay={0} />
                  <TutorialCell letter="T" status="correct" delay={0.04} />
                  <TutorialCell letter="O" status="correct" delay={0.08} />
                  <TutorialCell letter="R" status="correct" delay={0.12} />
                  <TutorialCell letter="K" status="absent" delay={0.16} />
                </div>
                <p className="text-[8px] text-gray-500 text-left">R locks in. One to go!</p>
              </div>

              {/* Guess 5 */}
              <div className="space-y-0.5">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider text-left">Guess 5</p>
                <div className="flex gap-1 justify-center">
                  <TutorialCell letter="S" status="correct" delay={0} />
                  <TutorialCell letter="T" status="correct" delay={0.04} />
                  <TutorialCell letter="O" status="correct" delay={0.08} />
                  <TutorialCell letter="R" status="correct" delay={0.12} />
                  <TutorialCell letter="M" status="correct" delay={0.16} />
                </div>
                <p className="text-[8px] text-green-400 font-bold text-left">Solved in 5! ✨</p>
              </div>
            </div>

            <MiniKeyboard statuses={{
              S: 'correct', T: 'correct', O: 'correct', R: 'correct', M: 'correct',
              L: 'absent', I: 'absent', E: 'absent', A: 'absent', P: 'absent',
              N: 'absent', K: 'absent',
            }} />
          </div>
        );

      case 'colors':
        return (
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-4">
              What the Colors Mean
            </h3>

            <div className="space-y-3 w-full max-w-[260px] text-left">
              <div className="bg-black/20 border border-correct/20 rounded-xl p-3.5">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-5 h-5 rounded bg-correct border border-correct shrink-0" />
                  <span className="text-[11px] font-black text-correct uppercase tracking-wider">Green</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Letter is in the word <span className="text-white">and</span> in the correct position. Keep it here.
                </p>
              </div>

              <div className="bg-black/20 border border-present/20 rounded-xl p-3.5">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-5 h-5 rounded bg-present border border-present shrink-0" />
                  <span className="text-[11px] font-black text-present uppercase tracking-wider">Yellow</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Letter is in the word but <span className="text-white">not</span> in this position. Try it somewhere else.
                </p>
              </div>

              <div className="bg-black/20 border border-gray-700 rounded-xl p-3.5">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-5 h-5 rounded bg-absent border border-absent shrink-0" />
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Gray</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Not in the word at all. <span className="text-white font-bold">Do not</span> reuse these letters.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-1 text-[10px] text-left w-full max-w-[260px]">
              <p className="text-correct font-bold uppercase tracking-wider">✅ Do: Keep green letters in place. Move yellow letters.</p>
              <p className="text-red-400 font-bold uppercase tracking-wider">❌ Don't: Reuse gray letters. Put yellow letters in the same spot.</p>
            </div>
          </div>
        );

      case 'scoring':
        return (
          <div className="flex flex-col items-center text-center">
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              Scoring &amp; Hints
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              How your score breaks down:
            </p>

            <div className="space-y-2 w-full max-w-[240px] text-left mb-4">
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Base Score</span>
                  <span className="text-white font-bold">+500</span>
                </div>
                <p className="text-[9px] text-gray-600">100 pts × 5 guesses</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Hint Penalty</span>
                  <span className="text-red-400 font-bold">-100</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3 text-yellow-500 shrink-0" />
                  <p className="text-[9px] text-gray-500">Using a hint deducts 100 pts</p>
                </div>
              </div>

              <div className="bg-correct/10 border border-correct/20 rounded-xl p-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Final Score</span>
                  <span className="text-correct font-bold">400</span>
                </div>
                <p className="text-[9px] text-gray-600">500 base − 100 hint penalty</p>
              </div>
            </div>

            <div className="space-y-2 w-full max-w-[240px] text-left">
              <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Hint Rules</p>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                <p className="text-[9px] text-gray-400">Unlocks after <span className="text-white font-bold">2 guesses</span></p>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                <p className="text-[9px] text-gray-400">Reveals <span className="text-white font-bold">1 undiscovered letter</span> + position</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-[9px] text-red-400 font-bold">Locked on the last guess or when 1 letter remains!</p>
              </div>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-correct/10 p-3 rounded-2xl border border-correct/20 mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              You're Ready!
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Here's a quick recap before you start:
            </p>

            <div className="space-y-2 text-left w-full max-w-[260px] mb-5">
              <div className="bg-correct/10 border border-correct/20 rounded-lg px-3 py-2">
                <p className="text-[10px] text-correct font-bold uppercase tracking-wider">✅ DO</p>
                <p className="text-[10px] text-gray-400">Use green letters in place. Move yellow letters around. Use hints wisely — they cost points!</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">❌ DON'T</p>
                <p className="text-[10px] text-gray-400">Reuse gray letters. Put yellow letters back in the same spot.</p>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <p className="text-[10px] text-gray-400">Hints unlock after <span className="text-white font-bold">2 guesses</span>. Using one costs <span className="text-red-400 font-bold">-100 pts</span>.</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400">Word length changes daily — <span className="text-white">4 to 7 letters</span>.</p>
              </div>
            </div>

            <button
              onClick={onComplete}
              className="w-full bg-correct text-black font-black py-3.5 rounded-xl text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.AUTH_MODAL }}>
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Step indicator */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? 'bg-correct w-5' : 'bg-gray-700 w-1.5'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
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
        <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-gray-800/60 shrink-0">
          <button
            onClick={onSkip}
            className="text-[10px] text-gray-600 font-bold uppercase tracking-wider hover:text-gray-400 transition-colors cursor-pointer"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {!hasScrolledToBottom ? (
              <div className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-500 animate-pulse">
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="font-medium">Scroll</span>
              </div>
            ) : (
              <button
                onClick={goNext}
                className="flex items-center gap-1 bg-correct text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
              >
                {isLast ? 'Start Playing' : 'Next'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
