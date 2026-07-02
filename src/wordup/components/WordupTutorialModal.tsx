import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, Swords, Zap, Trophy, GraduationCap } from 'lucide-react';

interface WordupTutorialModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  'welcome',
  'live-mode',
  'async-mode',
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

export const WordupTutorialModal = ({ onComplete, onSkip }: WordupTutorialModalProps) => {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <div className="bg-correct/10 p-3 rounded-2xl border border-correct/20 mb-4">
              <Swords className="w-6 h-6 text-correct" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-2">
              Welcome to WordUp
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-6 max-w-xs">
              WordUp is a <span className="text-white font-bold">multiplayer trivia battle</span> game.
              Compete against friends or players worldwide in fast-paced word challenges.
            </p>

            <div className="space-y-3 w-full max-w-[260px] text-left">
              <div className="bg-correct/10 border border-correct/20 rounded-xl p-3.5 flex items-center gap-3">
                <Zap className="w-5 h-5 text-correct shrink-0" />
                <div>
                  <p className="text-[11px] font-black text-correct uppercase tracking-wider">Live Mode</p>
                  <p className="text-[10px] text-gray-400">Real-time battles. Timed. Ranked.</p>
                </div>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 flex items-center gap-3">
                <Swords className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <p className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">1 v 1 Challenge</p>
                  <p className="text-[10px] text-gray-400">Play at your pace. Challenge friends.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'live-mode':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-correct/10 p-3 rounded-2xl border border-correct/20 mb-4">
              <Zap className="w-6 h-6 text-correct" fill="currentColor" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              Live Mode
            </h3>
            <p className="text-xs text-gray-400 mb-4 max-w-xs">
              Jump into real-time 1v1 battles against real opponents or bots.
            </p>

            <div className="space-y-2 w-full max-w-[260px] text-left mb-4">
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">7 Rounds</p>
                <p className="text-[10px] text-gray-400">Each match has 7 questions across your chosen category.</p>
              </div>
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">Timed Questions</p>
                <p className="text-[10px] text-gray-400">You have <span className="text-white font-bold">10 seconds</span> per question. Answer fast for more points!</p>
              </div>
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">Speed Bonus</p>
                <p className="text-[10px] text-gray-400">Faster answers earn <span className="text-correct font-bold">11–20 points</span>. Points decay over time.</p>
              </div>
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">Categories</p>
                <p className="text-[10px] text-gray-400">Choose from Mixed, Geography, Science, History, and more!</p>
              </div>
            </div>

            <div className="flex gap-2">
              <span className="text-[9px] font-black uppercase bg-correct/10 text-correct border border-correct/20 px-2 py-0.5 rounded-lg">vs Players</span>
              <span className="text-[9px] font-black uppercase bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-lg">vs Bots</span>
            </div>
          </div>
        );

      case 'async-mode':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 mb-4">
              <Swords className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              1 v 1 Challenge
            </h3>
            <p className="text-xs text-gray-400 mb-4 max-w-xs">
              Play at your own pace. Challenge friends and take your time answering.
            </p>

            <div className="space-y-2 w-full max-w-[260px] text-left mb-4">
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">No Timer Pressure</p>
                <p className="text-[10px] text-gray-400">Answer when you're ready. Your opponent plays their turn later.</p>
              </div>
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">Challenge Friends</p>
                <p className="text-[10px] text-gray-400">Invite specific players or search for opponents by name.</p>
              </div>
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">Play Anytime</p>
                <p className="text-[10px] text-gray-400">Start a match and finish it whenever it's your turn — no rush.</p>
              </div>
              <div className="bg-black/20 border border-gray-700 rounded-xl p-3">
                <p className="text-[11px] font-black text-white uppercase tracking-wider mb-1">Ranked</p>
                <p className="text-[10px] text-gray-400">Every match affects your ELO rating. Climb the ranks!</p>
              </div>
            </div>

            <span className="text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-lg">Challenge Friends</span>
          </div>
        );

      case 'scoring':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-yellow-500/10 p-3 rounded-2xl border border-yellow-500/20 mb-4">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              Scoring &amp; Ranking
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              How your performance is measured:
            </p>

            <div className="space-y-2 w-full max-w-[240px] text-left mb-4">
              <div className="bg-correct/10 border border-correct/20 rounded-xl p-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Correct Answer</span>
                  <span className="text-correct font-bold">11–20 pts</span>
                </div>
                <p className="text-[9px] text-gray-500">Speed bonus: faster = more points</p>
              </div>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Final Round (7)</span>
                  <span className="text-pink-400 font-bold">×2 Points</span>
                </div>
                <p className="text-[9px] text-gray-500">All points are DOUBLED! Make it count.</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <p className="text-[11px] font-black text-yellow-400 uppercase tracking-wider mb-1">ELO Rating</p>
                <p className="text-[9px] text-gray-500">Win = gain ELO. Lose = lose ELO. Determines your rank.</p>
              </div>
            </div>

            <div className="w-full max-w-[240px] text-left">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Ranks</p>
              <div className="grid grid-cols-5 gap-1">
                <div className="bg-amber-600/20 border border-amber-600/30 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] font-black text-amber-500 uppercase">Bronze</p>
                  <p className="text-[7px] text-gray-500">0+</p>
                </div>
                <div className="bg-slate-300/20 border border-slate-300/30 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] font-black text-slate-300 uppercase">Silver</p>
                  <p className="text-[7px] text-gray-500">800+</p>
                </div>
                <div className="bg-yellow-400/20 border border-yellow-400/30 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] font-black text-yellow-400 uppercase">Gold</p>
                  <p className="text-[7px] text-gray-500">1100+</p>
                </div>
                <div className="bg-cyan-400/20 border border-cyan-400/30 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] font-black text-cyan-400 uppercase">Diamond</p>
                  <p className="text-[7px] text-gray-500">1400+</p>
                </div>
                <div className="bg-purple-400/20 border border-purple-400/30 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] font-black text-purple-400 uppercase">Master</p>
                  <p className="text-[7px] text-gray-500">1700+</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="bg-correct/10 p-3 rounded-2xl border border-correct/20 mb-4">
              <GraduationCap className="w-6 h-6 text-correct" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-1">
              You're Ready!
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Quick recap before you jump in:
            </p>

            <div className="space-y-2 text-left w-full max-w-[260px] mb-5">
              <div className="bg-correct/10 border border-correct/20 rounded-lg px-3 py-2">
                <p className="text-[10px] text-correct font-bold uppercase tracking-wider">🎮 Two Modes</p>
                <p className="text-[10px] text-gray-400"><span className="text-correct font-bold">Live</span> for real-time battles. <span className="text-indigo-400 font-bold">1v1 Challenge</span> for relaxed play.</p>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">📋 7 Rounds</p>
                <p className="text-[10px] text-gray-400">Each match has 7 questions. Round 7 = <span className="text-pink-400 font-bold">double points</span>!</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <p className="text-[10px] text-gray-400">Climb from <span className="text-amber-400 font-bold">Bronze</span> to <span className="text-purple-400 font-bold">Master</span>. Every match counts.</p>
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-120 p-4">
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

export default WordupTutorialModal;
