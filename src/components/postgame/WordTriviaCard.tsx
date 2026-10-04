import React, { useState, useEffect } from "react";
import { BookOpen, Sparkles, Volume2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWordDefinition, type DictionaryDefinition } from "../../utils/wordgrid/dictionary";

interface WordTriviaCardProps {
  word: string;
  isWon?: boolean;
  attemptsCount?: number;
  maxAttempts?: number;
  date?: string;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
  }),
};

export const WordTriviaCard: React.FC<WordTriviaCardProps> = ({
  word,
  isWon = true,
  attemptsCount,
  maxAttempts = 6,
  date,
}) => {
  const [definitionData, setDefinitionData] = useState<DictionaryDefinition | null>(null);
  const [phonetic, setPhonetic] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (!word) return;
    let isMounted = true;
    setLoading(true);
    setCurrentIndex(0);
    setDirection(0);

    const loadDetails = async () => {
      try {
        const def = await fetchWordDefinition(word, date);
        if (!isMounted) return;
        setDefinitionData(def);
        if (def.phonetic) {
          setPhonetic(def.phonetic);
        }
      } catch (e) {
        console.error("Failed to load trivia definition:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [word, date]);

  const playPronunciation = () => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.85;
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const meanings = definitionData?.meanings || (definitionData?.definition ? [{
    partOfSpeech: definitionData.partOfSpeech || 'WORD',
    definition: definitionData.definition,
  }] : []);

  const total = meanings.length;
  const currentMeaning = meanings[currentIndex] || meanings[0];

  const handlePrev = () => {
    if (total <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  };

  const handleNext = () => {
    if (total <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  };

  return (
    <div className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md relative overflow-hidden text-left flex flex-col justify-between gap-2 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-indigo-500/15 rounded-lg border border-indigo-500/30 text-indigo-400">
            <BookOpen size={14} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
            Word Trivia & Definitions
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <Sparkles size={10} className="text-amber-400" />
          <span className="text-[8px] font-black uppercase tracking-wider text-gray-300">
            {isWon ? `Solved in ${attemptsCount}/${maxAttempts}` : "Daily Word"}
          </span>
        </div>
      </div>

      {/* Word, Phonetics and Audio Button */}
      <div className="flex items-center justify-between gap-2 my-0.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
            {word}
          </h3>
          {phonetic && (
            <span className="text-xs font-mono text-cyan-300/80">
              {phonetic}
            </span>
          )}
          {currentMeaning?.partOfSpeech && (
            <span className="text-[9px] font-black uppercase text-indigo-300 bg-indigo-950/80 border border-indigo-600/40 px-1.5 py-0.5 rounded">
              {currentMeaning.partOfSpeech}
            </span>
          )}
        </div>

        <button
          onClick={playPronunciation}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white border border-white/10 transition-all cursor-pointer shrink-0"
          title="Listen to pronunciation"
        >
          <Volume2 size={15} />
        </button>
      </div>

      {/* Carousel Definition Content */}
      <div className="min-h-[48px] flex flex-col justify-center relative overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 py-1">
            <Loader2 size={12} className="animate-spin text-indigo-400" />
            <span>Looking up definitions...</span>
          </div>
        ) : total > 0 ? (
          <div className="relative w-full">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="w-full text-xs text-slate-200 leading-snug"
              >
                <p className="line-clamp-3">
                  {currentMeaning.definition}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-xs text-gray-300 leading-snug">
            A valid English word used in today's daily puzzle.
          </p>
        )}
      </div>

      {/* Carousel Controls Footer (Shown when multiple meanings exist) */}
      {!loading && total > 1 && (
        <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-0.5">
          {/* Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {meanings.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                  idx === currentIndex
                    ? "w-4 bg-gradient-to-r from-pink-500 to-cyan-400"
                    : "w-1.5 bg-slate-700 hover:bg-slate-500"
                }`}
                title={`Meaning ${idx + 1}`}
              />
            ))}
          </div>

          {/* Previous / Next Arrow Controls */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-mono font-bold mr-1.5">
              {currentIndex + 1} of {total}
            </span>
            <button
              onClick={handlePrev}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer active:scale-95"
              title="Previous definition"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer active:scale-95"
              title="Next definition"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

