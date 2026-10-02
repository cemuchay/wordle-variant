import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { ScrambleConfig, ScrambleGameMode } from '../engine/types';
import { Play, Sparkles, Clock, Infinity as InfinityIcon, Loader2, AlertCircle, History } from 'lucide-react';

interface ScrambleConfigModalProps {
  isOpen: boolean;
  onStartGame: (config: ScrambleConfig) => void;
  onClose?: () => void;
  onOpenHistory?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

const AVAILABLE_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10];

export const ScrambleConfigModal: React.FC<ScrambleConfigModalProps> = ({
  isOpen,
  onStartGame,
  onOpenHistory,
  isLoading = false,
  errorMessage = null,
}) => {
  const [selectedLengths, setSelectedLengths] = useState<number[]>([5]);
  const [mode, setMode] = useState<ScrambleGameMode>('timed');
  const [durationSeconds, setDurationSeconds] = useState<number>(90);
  const [useScrabbleDict] = useState<boolean>(true);

  if (!isOpen) return null;

  const toggleLength = (len: number) => {
    if (selectedLengths.includes(len)) {
      if (selectedLengths.length > 1) {
        setSelectedLengths(selectedLengths.filter((l) => l !== len));
      }
    } else {
      if (selectedLengths.length < 3) {
        setSelectedLengths([...selectedLengths, len].sort((a, b) => a - b));
      }
    }
  };

  const handleStart = () => {
    onStartGame({
      selectedLengths,
      mode,
      durationSeconds: mode === 'timed' ? durationSeconds : 0,
      wordsPerSpool: selectedLengths.length === 1 && selectedLengths[0] <= 4 ? 8 : 6,
      useScrabbleDict,
      seed: Date.now().toString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-3xl bg-slate-900 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.25)] text-slate-100 my-auto"
      >
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex p-2.5 sm:p-3 rounded-2xl bg-gradient-to-tr from-pink-500 via-amber-400 to-cyan-400 text-slate-950 font-black mb-2 sm:mb-3 shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
            Word Scramble Matrix
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-medium">
            Form valid words from the rainbow tile pool!
          </p>
        </div>

        {/* 1. Target Lengths (Select 1 to 3) */}
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Target Word Lengths (Select up to 3)
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {AVAILABLE_LENGTHS.map((len) => {
              const isSelected = selectedLengths.includes(len);
              return (
                <button
                  key={len}
                  onClick={() => toggleLength(len)}
                  className={`
                    py-2 rounded-xl font-black text-sm transition-all duration-150 border
                    ${
                      isSelected
                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-pink-400 shadow-[0_0_12px_rgba(244,63,94,0.6)] scale-105'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                    }
                  `}
                >
                  {len}L
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Selected:{' '}
            <span className="text-amber-400 font-bold">
              {selectedLengths.map((l) => `${l}L`).join(', ')}
            </span>{' '}
            (Only words of these lengths will be accepted)
          </div>
        </div>

        {/* 2. Game Mode */}
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Game Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('timed')}
              className={`
                p-3.5 rounded-2xl flex items-center gap-3 border transition-all text-left
                ${
                  mode === 'timed'
                    ? 'bg-gradient-to-r from-cyan-950/70 to-blue-900/60 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }
              `}
            >
              <Clock className={`w-6 h-6 ${mode === 'timed' ? 'text-cyan-400' : 'text-slate-500'}`} />
              <div>
                <div className="font-bold text-sm text-slate-100">Timed Rush</div>
                <div className="text-[11px] text-slate-400">Board refills as you score</div>
              </div>
            </button>

            <button
              onClick={() => setMode('untimed')}
              className={`
                p-3.5 rounded-2xl flex items-center gap-3 border transition-all text-left
                ${
                  mode === 'untimed'
                    ? 'bg-gradient-to-r from-purple-950/70 to-indigo-900/60 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }
              `}
            >
              <InfinityIcon className={`w-6 h-6 ${mode === 'untimed' ? 'text-purple-400' : 'text-slate-500'}`} />
              <div>
                <div className="font-bold text-sm text-slate-100">Untimed Puzzle</div>
                <div className="text-[11px] text-slate-400">Fixed pool, clear the grid</div>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Duration Selector (if Timed) */}
        {mode === 'timed' && (
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Time Limit
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[45, 60, 90, 120].map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setDurationSeconds(seconds)}
                  className={`
                    py-2 rounded-xl text-xs font-bold border transition-all
                    ${
                      durationSeconds === seconds
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }
                  `}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error message banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 flex items-center gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Start Game Button */}
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(52,211,153,0.7)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>PREPARING BOARD...</span>
            </>
          ) : (
            <>
              <Play className="w-6 h-6 fill-current" />
              <span>START GAME</span>
            </>
          )}
        </button>

        {/* View Game History inside Word Scramble Lobby */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="w-full mt-3 py-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/60 text-xs font-bold text-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span>View Word Scramble History</span>
          </button>
        )}
      </motion.div>
    </div>
  );
};
