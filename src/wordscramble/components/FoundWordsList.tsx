import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FoundWordEntry } from '../engine/types';
import { Sparkles } from 'lucide-react';

interface FoundWordsListProps {
  foundWords: FoundWordEntry[];
}

export const FoundWordsList: React.FC<FoundWordsListProps> = ({ foundWords }) => {
  return (
    <div className="w-full max-w-xl mx-auto mt-2 sm:mt-3 p-2.5 sm:p-3.5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 mb-12">
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 sm:gap-1.5">
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          Discovered Words ({foundWords.length})
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-20 sm:max-h-32 lg:max-h-56 overflow-y-auto pr-1">
        <AnimatePresence>
          {foundWords.map((entry) => (
            <motion.div
              key={entry.word}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-gradient-to-r from-slate-800 to-indigo-950 border border-indigo-500/30 text-[11px] sm:text-xs font-mono font-bold text-slate-100 shadow-sm"
            >
              <span className="tracking-wider">{entry.word}</span>
              <span className="text-[9px] sm:text-[10px] text-amber-400 font-sans">+{entry.score}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {foundWords.length === 0 && (
          <div className="text-[11px] sm:text-xs text-slate-500 italic py-1 sm:py-2">
            No words found yet. Find your first anagram!
          </div>
        )}
      </div>
    </div>
  );
};
