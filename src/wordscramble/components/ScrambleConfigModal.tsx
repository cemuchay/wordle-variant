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
  const [primaryLength, setPrimaryLength] = useState<number>(5);
  const [additionalLengths, setAdditionalLengths] = useState<number[]>([]);
  const [mode, setMode] = useState<ScrambleGameMode>('timed');
  const [durationSeconds, setDurationSeconds] = useState<number>(90);
  const [useScrabbleDict] = useState<boolean>(true);
  const [step, setStep] = useState<'configure' | 'confirm'>('configure');

  if (!isOpen) return null;

  const selectedLengths = Array.from(new Set([primaryLength, ...additionalLengths])).sort((a, b) => a - b);

  const handleSelectPrimaryLength = (len: number) => {
    setPrimaryLength(len);
    setAdditionalLengths((prev) => prev.filter((l) => l !== len));
  };

  const handleToggleAdditionalLength = (len: number) => {
    if (len === primaryLength) return;
    if (additionalLengths.includes(len)) {
      setAdditionalLengths((prev) => prev.filter((l) => l !== len));
    } else {
      if (additionalLengths.length < 2) {
        setAdditionalLengths((prev) => [...prev, len].sort((a, b) => a - b));
      } else {
        setAdditionalLengths((prev) => [prev[1], len].sort((a, b) => a - b));
      }
    }
  };

  const handleProceedToConfirm = () => {
    setStep('confirm');
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

  const isAutoSubmitEnabled = selectedLengths.length === 1;

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
            {step === 'confirm' ? 'Confirm your game configuration' : 'Form valid words from the rainbow tile pool!'}
          </p>
        </div>

        {step === 'configure' ? (
          <>
            {/* 1. Target Lengths (2-Row Design) */}
            <div className="space-y-3 mb-5">
              {/* Row 1: Primary Length */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-pink-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Primary Word Length (Pick 1)
                  </span>
                  <span className="text-[11px] font-black text-pink-400">
                    {primaryLength}L Main
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {AVAILABLE_LENGTHS.map((len) => {
                    const isSelected = primaryLength === len;
                    return (
                      <button
                        key={len}
                        onClick={() => handleSelectPrimaryLength(len)}
                        className={`
                          py-2 rounded-xl font-black text-xs sm:text-sm transition-all duration-150 border cursor-pointer
                          ${
                            isSelected
                              ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-pink-400 shadow-[0_0_12px_rgba(244,63,94,0.6)] scale-105'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                          }
                        `}
                      >
                        {len}L
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Additional Lengths */}
              <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Additional Lengths (Optional, max 2)
                  </span>
                  <span className="text-[11px] font-bold text-cyan-400">
                    {additionalLengths.length}/2 Selected
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {AVAILABLE_LENGTHS.map((len) => {
                    const isPrimary = primaryLength === len;
                    const isSelected = additionalLengths.includes(len);
                    return (
                      <button
                        key={len}
                        disabled={isPrimary}
                        onClick={() => handleToggleAdditionalLength(len)}
                        className={`
                          py-2 rounded-xl font-black text-xs sm:text-sm transition-all duration-150 border cursor-pointer
                          ${
                            isPrimary
                              ? 'bg-slate-900 text-slate-600 border-slate-800 opacity-40 cursor-not-allowed'
                              : isSelected
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)] scale-105'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                          }
                        `}
                      >
                        {len}L
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                <span>
                  Active:{' '}
                  <span className="text-amber-400 font-bold">
                    {selectedLengths.map((l) => `${l}L`).join(', ')}
                  </span>
                </span>
                {isAutoSubmitEnabled ? (
                  <span className="text-emerald-400 font-bold">⚡ Auto-submit enabled</span>
                ) : (
                  <span className="text-amber-300 font-bold">Manual SUBMIT button</span>
                )}
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

            {/* Continue to Review / Confirmation Button */}
            <button
              onClick={handleProceedToConfirm}
              className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(52,211,153,0.7)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>CONTINUE</span>
            </button>
          </>
        ) : (
          /* Step 2: Confirmation / Review Screen */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Game Setup Summary
              </h3>

              <div className="flex items-center justify-between py-2 border-b border-slate-700/60">
                <span className="text-xs text-slate-300">Target Word Lengths:</span>
                <span className="text-sm font-black text-amber-400">
                  {selectedLengths.map((l) => `${l} Letters`).join(', ')}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-700/60">
                <span className="text-xs text-slate-300">Game Mode:</span>
                <span className="text-sm font-bold text-cyan-300">
                  {mode === 'timed' ? `Timed Rush (${durationSeconds}s)` : 'Untimed Puzzle'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-700/60">
                <span className="text-xs text-slate-300">Auto-Submit:</span>
                <span className={`text-xs font-black ${isAutoSubmitEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isAutoSubmitEnabled
                    ? '⚡ Enabled (Single Length)'
                    : '⏸ Disabled (Multi-Length: Manual SUBMIT button)'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-300">Dictionary:</span>
                <span className="text-xs font-medium text-slate-300">Official Scrabble / English Validated</span>
              </div>
            </div>

            {/* Error message banner */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 flex items-center gap-2.5 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('configure')}
                disabled={isLoading}
                className="w-1/3 py-3.5 rounded-2xl font-bold text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={isLoading}
                className="w-2/3 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(52,211,153,0.7)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>STARTING...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>CONFIRM & START</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* View Game History inside Word Scramble Lobby */}
        {onOpenHistory && step === 'configure' && (
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
