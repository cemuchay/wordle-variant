import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScrambleConfig, ScrambleGameMode, ScrambleSessionStats } from '../engine/types';
import { LocalStorageScrambleRepository } from '../storage/ScrambleRepository';
import {
  Play,
  Sparkles,
  Clock,
  Infinity as InfinityIcon,
  RotateCcw,
  Trash2,
  Trophy,
  History,
  Flame,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface ScrambleLobbyProps {
  onStartNewGame: (config: ScrambleConfig) => void;
  onResumeGame: (savedState: any) => void;
  onBackToMenu?: () => void;
}

const AVAILABLE_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10];

export const ScrambleLobby: React.FC<ScrambleLobbyProps> = ({
  onStartNewGame,
  onResumeGame,
  onBackToMenu,
}) => {
  const repository = useMemo(() => new LocalStorageScrambleRepository(), []);
  const [activeTab, setActiveTab] = useState<'create' | 'pending' | 'history'>('create');
  const [pendingGame, setPendingGame] = useState<any | null>(null);
  const [historySessions, setHistorySessions] = useState<ScrambleSessionStats[]>([]);

  // Game configuration form state: 2-Row selector design
  // Row 1: Primary Target Length (strictly 1 length selected)
  const [primaryLength, setPrimaryLength] = useState<number>(5);
  // Row 2: Additional Accepted Lengths (optional, up to max 2 additional lengths)
  const [additionalLengths, setAdditionalLengths] = useState<number[]>([]);

  const [mode, setMode] = useState<ScrambleGameMode>('timed');
  const [durationSeconds, setDurationSeconds] = useState<number>(90);
  const [maxCapacity, setMaxCapacity] = useState<number>(30);
  const [useScrabbleDict] = useState<boolean>(true);

  // Load storage data
  const loadData = useCallback(async () => {
    const active = await repository.loadActiveGame();
    setPendingGame(active);
    const sessions = await repository.getSessions();
    setHistorySessions(sessions);
  }, [repository]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combined selected lengths for game logic
  const selectedLengths = useMemo(() => {
    return Array.from(new Set([primaryLength, ...additionalLengths])).sort((a, b) => a - b);
  }, [primaryLength, additionalLengths]);

  const handleSelectPrimaryLength = (len: number) => {
    setPrimaryLength(len);
    // Remove from additional lengths if it was there
    setAdditionalLengths((prev) => prev.filter((l) => l !== len));
  };

  const handleToggleAdditionalLength = (len: number) => {
    if (len === primaryLength) return; // Cannot add primary length as additional

    if (additionalLengths.includes(len)) {
      setAdditionalLengths((prev) => prev.filter((l) => l !== len));
    } else {
      if (additionalLengths.length < 2) {
        setAdditionalLengths((prev) => [...prev, len].sort((a, b) => a - b));
      } else {
        // Replace oldest additional selection if max 2 reached
        setAdditionalLengths((prev) => [prev[1], len].sort((a, b) => a - b));
      }
    }
  };

  const handleLaunchGame = () => {
    // Dynamic words per spool based on selected lengths
    const wordsPerSpool = selectedLengths.length === 1 && selectedLengths[0] <= 4 ? 8 : 6;
    onStartNewGame({
      selectedLengths,
      mode,
      durationSeconds: mode === 'timed' ? durationSeconds : 0,
      wordsPerSpool,
      maxCapacity,
      useScrabbleDict,
      seed: Date.now().toString(),
    });
  };

  const handleDeletePendingGame = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to discard your unfinished game?')) {
      await repository.clearActiveGame();
      setPendingGame(null);
    }
  };

  const isAutoSubmitEnabled = selectedLengths.length === 1;

  // Best all-time score
  const highestOverallScore = useMemo(() => {
    if (historySessions.length === 0) return 0;
    return Math.max(...historySessions.map((s) => s.score));
  }, [historySessions]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col space-y-5 animate-in fade-in duration-200">
      {/* Top Banner / Navigation */}
      <header className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="p-2 sm:p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>More Games</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 via-amber-400 to-cyan-400 text-slate-950 font-black text-sm shadow-md">
              🔀
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
                Word Scramble Lobby
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">
                Rainbow Anagram Matrix & Word Puzzle Arena
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Stats */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Best Score</span>
              <span className="text-xs font-black text-amber-300">{highestOverallScore.toLocaleString()} pts</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs (Create Game / Pending Game / History) */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'create'
              ? 'bg-gradient-to-r from-pink-500/20 via-amber-500/20 to-cyan-500/20 text-white border border-pink-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>New Game</span>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'pending'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-white border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Pending Game</span>
          {pendingGame && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-2.5 right-3" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span>Game History ({historySessions.length})</span>
        </button>
      </div>

      {/* Tab Body */}
      <AnimatePresence mode="wait">
        {activeTab === 'create' && (
          <motion.div
            key="create-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Col: Setup Configuration */}
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
              {/* 2-Row Word Length Selector */}
              <div className="space-y-4">
                {/* Row 1: Primary Target Length */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-pink-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center text-[10px] font-black">1</span>
                      <span>Primary Word Length (Pick 1)</span>
                    </h2>
                    <span className="text-[11px] font-black text-pink-400">
                      {primaryLength} Letters Main
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
                                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                            }
                          `}
                        >
                          {len}L
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 2: Additional Accepted Lengths */}
                <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-black">2</span>
                      <span>Additional Accepted Lengths (Optional, max 2)</span>
                    </h2>
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
                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                            }
                          `}
                        >
                          {len}L
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    Accepts additional shorter or longer anagram words alongside your primary {primaryLength}L words.
                  </div>
                </div>

                {/* Active Selection Summary */}
                <div className="text-[11px] text-slate-400 px-1 flex items-center justify-between">
                  <span>
                    Active Game Lengths:{' '}
                    <strong className="text-amber-400 font-bold">
                      {selectedLengths.map((l) => `${l}L`).join(', ')}
                    </strong>
                  </span>
                  {isAutoSubmitEnabled ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      ⚡ Auto-submit enabled (Single Length)
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold">Manual SUBMIT button required</span>
                  )}
                </div>
              </div>

              {/* Game Mode */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-black">2</span>
                  <span>Game Mode</span>
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('timed')}
                    className={`
                      p-3.5 rounded-2xl flex items-center gap-3 border transition-all text-left cursor-pointer
                      ${
                        mode === 'timed'
                          ? 'bg-gradient-to-r from-cyan-950/70 to-blue-900/60 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
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
                      p-3.5 rounded-2xl flex items-center gap-3 border transition-all text-left cursor-pointer
                      ${
                        mode === 'untimed'
                          ? 'bg-gradient-to-r from-purple-950/70 to-indigo-900/60 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
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

              {/* Duration (Timed only) */}
              {mode === 'timed' && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-black">3</span>
                    <span>Time Duration</span>
                  </h2>
                  <div className="grid grid-cols-4 gap-2">
                    {[45, 60, 90, 120].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setDurationSeconds(sec)}
                        className={`
                          py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                          ${
                            durationSeconds === sec
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:border-slate-600'
                          }
                        `}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid Letter Capacity Cap */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">
                      {mode === 'timed' ? '4' : '3'}
                    </span>
                    <span>Grid Letter Pool Cap</span>
                  </h2>
                  <span className="text-xs font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                    {maxCapacity === 0 ? '✨ Auto (Balanced)' : `${maxCapacity} Max Tiles`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 24, 30, 36].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => setMaxCapacity(cap)}
                      className={`
                        py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                        ${
                          maxCapacity === cap
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-md'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:border-slate-600'
                        }
                      `}
                    >
                      {cap === 0 ? 'Auto ✨' : `${cap} Tiles`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {maxCapacity === 0
                    ? 'Engine automatically sizes grid capacity based on selected word lengths and spooled words.'
                    : 'Hard cap ensures letter tiles never overflow the grid matrix during refills.'}
                </p>
              </div>
            </div>

            {/* Right Col: Setup Preview & Start Button */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                  Game Configuration Summary
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Target Lengths:</span>
                    <span className="font-black text-amber-400">
                      {selectedLengths.map((l) => `${l} Letters`).join(', ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Game Mode:</span>
                    <span className="font-black text-cyan-300">
                      {mode === 'timed' ? `Timed Rush (${durationSeconds}s)` : 'Untimed Puzzle'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Grid Cap:</span>
                    <span className="font-bold text-emerald-300">
                      Hard capped at {maxCapacity} tiles (no overflow)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400">Auto-Submit:</span>
                    <span className={`font-bold ${isAutoSubmitEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isAutoSubmitEnabled ? 'Enabled (Single Length)' : 'Manual SUBMIT Button'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-400">Dictionary:</span>
                    <span className="text-slate-200 font-medium">Scrabble / English Validated</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Form valid words quickly to build up streaks and score bonus rainbow multipliers!
                  </span>
                </div>
              </div>

              {/* Big Launch Button */}
              <button
                onClick={handleLaunchGame}
                className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_30px_rgba(52,211,153,0.6)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START NEW GAME</span>
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'pending' && (
          <motion.div
            key="pending-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {pendingGame ? (
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-amber-500/40 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-100">Unfinished In-Progress Game</h3>
                      <p className="text-[11px] text-slate-400">
                        Saved on {new Date(pendingGame.savedAt || Date.now()).toLocaleDateString()}{' '}
                        {new Date(pendingGame.savedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-amber-950 text-amber-300 border border-amber-500/40">
                    {pendingGame.config?.mode || 'Game'} In Progress
                  </span>
                </div>

                {/* Score & Progress Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Current Score</span>
                    <div className="text-lg font-black text-amber-300 mt-0.5">
                      {(pendingGame.score || 0).toLocaleString()} pts
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Words Cleared</span>
                    <div className="text-lg font-black text-cyan-300 mt-0.5">
                      {(pendingGame.foundWords || []).length}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Current Streak</span>
                    <div className="text-lg font-black text-rose-400 mt-0.5 flex items-center gap-1">
                      <Flame className="w-4 h-4 fill-current" />
                      <span>{pendingGame.streak || 0}x</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {pendingGame.config?.mode === 'timed' ? 'Time Remaining' : 'Status'}
                    </span>
                    <div className="text-lg font-black text-emerald-300 mt-0.5">
                      {pendingGame.config?.mode === 'timed'
                        ? `${pendingGame.remainingSeconds || 0}s`
                        : 'Active'}
                    </div>
                  </div>
                </div>

                {/* Target Configurations */}
                <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Word Lengths:</span>
                  <span className="font-bold text-amber-400">
                    {(pendingGame.config?.selectedLengths || []).map((l: number) => `${l}L`).join(', ')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleDeletePendingGame}
                    className="py-3 px-4 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/50 text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Discard Game</span>
                  </button>

                  <button
                    onClick={() => onResumeGame(pendingGame)}
                    className="flex-1 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-slate-950 shadow-[0_0_25px_rgba(251,146,60,0.5)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>RESUME UNFINISHED GAME</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">
                  No Unfinished Games
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  You do not have any pending games in progress. Start a new game anytime!
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-2 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create New Game</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Top High Score Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                <span className="text-[10px] font-bold uppercase text-slate-400">Total Games Played</span>
                <div className="text-2xl font-black text-cyan-300 mt-1">
                  {historySessions.length}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                <span className="text-[10px] font-bold uppercase text-slate-400">All-Time High Score</span>
                <div className="text-2xl font-black text-amber-300 mt-1">
                  {highestOverallScore.toLocaleString()} pts
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                <span className="text-[10px] font-bold uppercase text-slate-400">Total Words Formed</span>
                <div className="text-2xl font-black text-emerald-300 mt-1">
                  {historySessions.reduce((acc, s) => acc + (s.totalWordsCount || 0), 0)}
                </div>
              </div>
            </div>

            {/* List of Game Sessions */}
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {historySessions.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-700/40">
                        {item.gameMode}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {item.selectedLengths.map((l) => `${l}L`).join(', ')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1">
                      {item.totalWordsCount} words found ·{' '}
                      {new Date(item.completedAt).toLocaleDateString()}{' '}
                      {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {item.longestWord && (
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Longest: <strong className="text-slate-300 font-bold">{item.longestWord}</strong>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-black text-emerald-400">
                      {item.score.toLocaleString()} pts
                    </div>
                    {item.highestStreak > 1 && (
                      <div className="text-[10px] text-orange-400 font-bold flex items-center justify-end gap-0.5 mt-0.5">
                        <Flame className="w-3 h-3 fill-current" />
                        <span>{item.highestStreak}x streak</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {historySessions.length === 0 && (
                <div className="p-12 rounded-3xl bg-slate-900/80 border border-slate-800 text-center text-slate-500 text-xs">
                  No games played yet. Start your first game from the New Game tab!
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScrambleLobby;
