// src/components/freeplay/FreePlayModal.tsx

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Shuffle, CheckCircle, ArrowLeft, Gamepad2, Play, Pause } from 'lucide-react';
import { ModalLayout } from '../layout/ModalLayout';
import { GameArea } from '../layout/GameArea';
import { ArchiveDatePicker } from './ArchiveDatePicker';
import { getDailyConfigSub } from '../../lib/game-logic/helpers/getDailyConfig';
import { checkGuess as evaluateGuess } from '../../lib/game-logic';
import {
  saveArchiveGame,
  getCompletedArchiveDates,
  saveArchiveDraft,
  getArchiveDraft,
  clearArchiveDraft,
  getAllValidArchiveDates,
  getYesterdayArchiveDate,
} from '../../utils/archiveDb';
import { saveGuestFreePlayState, getGuestFreePlayState, getTodayDateString } from '../../utils/guestFreePlay';
import { useApp } from '../../context/AppContext';
import { applyTheme } from '../../utils/theme';
import type { GuessResult, LetterStatus } from '../../types/game';

interface FreePlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'guest' | 'archive';
}

/**
 * Returns the earliest valid archive date that has NOT yet been completed.
 */
const getEarliestUnplayedArchiveDate = (completed: Set<string>): string => {
  const allValid = getAllValidArchiveDates(); // Chronological from earliest (2026-05-18) to yesterday
  const unplayed = allValid.find((d) => !completed.has(d));
  return unplayed || allValid[0] || getYesterdayArchiveDate();
};

export const FreePlayModal = ({
  isOpen,
  onClose,
  initialMode = 'archive',
}: FreePlayModalProps) => {
  const { triggerToast } = useApp();

  const [mode, setMode] = useState<'guest' | 'archive'>(initialMode);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return initialMode === 'guest' ? getTodayDateString() : getYesterdayArchiveDate();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  // Puzzle Data
  const [targetWord, setTargetWord] = useState('');
  const [wordLength, setWordLength] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(6);
  const [isLoading, setIsLoading] = useState(true);

  // Game State
  const [guesses, setGuesses] = useState<GuessResult[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [score, setScore] = useState(0);
  const [isShake, setIsShake] = useState(false);

  // Auto-advance Timer State (15s countdown on game over)
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Load completed archive dates & default to earliest unplayed date
  const refreshCompletedDates = useCallback(async () => {
    const dates = await getCompletedArchiveDates();
    setCompletedDates(dates);
    if (initialMode === 'archive') {
      const earliest = getEarliestUnplayedArchiveDate(dates);
      setSelectedDate(earliest);
    }
  }, [initialMode]);

  useEffect(() => {
    if (isOpen) {
      refreshCompletedDates();
    }
  }, [isOpen, refreshCompletedDates]);

  // Sync mode when initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
    if (initialMode === 'guest') {
      setSelectedDate(getTodayDateString());
    }
  }, [initialMode]);

  // Apply dark theme when modal opens
  useEffect(() => {
    if (isOpen) {
      applyTheme('dark');
    }
  }, [isOpen]);

  // Reconstruct game board & keyboard statuses from raw string array
  const reconstructStateFromGuesses = useCallback(
    (word: string, rawGuesses: string[], attemptsMax: number) => {
      const reconstructedGrid: GuessResult[][] = [];
      const newLetterStatuses: Record<string, LetterStatus> = {};

      rawGuesses.forEach((guessStr) => {
        const evalResults = evaluateGuess(guessStr, word);
        const row: GuessResult[] = evalResults.map((res) => {
          const char = res.letter.toUpperCase();
          const status = res.status;

          // Update letter status map for keyboard display
          const existing = newLetterStatuses[char];
          if (status === 'correct') {
            newLetterStatuses[char] = 'correct';
          } else if (status === 'present' && existing !== 'correct') {
            newLetterStatuses[char] = 'present';
          } else if (status === 'absent' && !existing) {
            newLetterStatuses[char] = 'absent';
          }

          return {
            letter: char,
            status,
          };
        });
        reconstructedGrid.push(row);
      });

      setGuesses(reconstructedGrid);
      setLetterStatuses(newLetterStatuses);

      const won = rawGuesses.length > 0 && rawGuesses[rawGuesses.length - 1].toUpperCase() === word;
      const over = won || rawGuesses.length >= attemptsMax;

      setIsWon(won);
      setIsGameOver(over);
      setScore(won ? Math.max(100, 1000 - (rawGuesses.length - 1) * 150) : 0);

      if (over) {
        setAutoAdvanceTimer(15);
        setIsTimerPaused(false);
      }
    },
    [],
  );

  // Fetch puzzle configuration whenever mode or selectedDate changes
  const loadPuzzle = useCallback(async () => {
    setIsLoading(true);
    setCurrentGuess('');
    setIsShake(false);
    setAutoAdvanceTimer(null);
    setIsTimerPaused(false);

    try {
      if (mode === 'guest') {
        const todayStr = getTodayDateString();
        setSelectedDate(todayStr);

        const config = await getDailyConfigSub(false, todayStr);
        setTargetWord(config.word.toUpperCase());
        setWordLength(config.length);
        setMaxAttempts(config.maxAttempts || 6);

        // Load guest state from LocalStorage
        const saved = getGuestFreePlayState();
        if (saved && saved.date === todayStr) {
          reconstructStateFromGuesses(config.word.toUpperCase(), saved.guesses, config.maxAttempts || 6);
        } else {
          setGuesses([]);
          setLetterStatuses({});
          setIsGameOver(false);
          setIsWon(false);
          setScore(0);
        }
      } else {
        // Mode === 'archive'
        const config = await getDailyConfigSub(false, selectedDate);
        setTargetWord(config.word.toUpperCase());
        setWordLength(config.length);
        setMaxAttempts(config.maxAttempts || 6);

        // Check if draft exists in LocalStorage
        const draft = getArchiveDraft(selectedDate);
        if (draft && draft.length > 0) {
          reconstructStateFromGuesses(config.word.toUpperCase(), draft, config.maxAttempts || 6);
        } else {
          setGuesses([]);
          setLetterStatuses({});
          setIsGameOver(false);
          setIsWon(false);
          setScore(0);
        }
      }
    } catch (err) {
      console.error('[FreePlayModal] Error loading puzzle:', err);
      triggerToast('Failed to load puzzle config');
    } finally {
      setIsLoading(false);
    }
  }, [mode, selectedDate, reconstructStateFromGuesses, triggerToast]);

  useEffect(() => {
    if (isOpen) {
      loadPuzzle();
    }
  }, [isOpen, loadPuzzle]);

  // Load next unplayed puzzle
  const handleNextUnplayedPuzzle = useCallback(() => {
    setAutoAdvanceTimer(null);
    setIsTimerPaused(false);

    const allValid = getAllValidArchiveDates();
    const unplayed = allValid.filter((d) => !completedDates.has(d) && d !== selectedDate);

    if (unplayed.length > 0) {
      const nextDate = unplayed[0]; // Earliest remaining unplayed date
      setSelectedDate(nextDate);
      triggerToast(`Loading next archive puzzle: ${nextDate}`);
    } else {
      triggerToast('All available archive puzzles completed! 🏆');
    }
  }, [completedDates, selectedDate, triggerToast]);

  // 15-second countdown timer for auto-advancing to next playable puzzle
  useEffect(() => {
    if (!isGameOver || autoAdvanceTimer === null || isTimerPaused) return;

    if (autoAdvanceTimer <= 0) {
      handleNextUnplayedPuzzle();
      return;
    }

    const interval = setInterval(() => {
      setAutoAdvanceTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGameOver, autoAdvanceTimer, isTimerPaused, handleNextUnplayedPuzzle]);

  // Key Handler: Letter typing
  const handleChar = useCallback(
    (char: string) => {
      if (isGameOver || isLoading) return;
      if (currentGuess.length < wordLength) {
        setCurrentGuess((prev) => (prev + char.toUpperCase()).slice(0, wordLength));
      }
    },
    [isGameOver, isLoading, currentGuess.length, wordLength],
  );

  // Key Handler: Delete letter
  const handleDelete = useCallback(() => {
    if (isGameOver || isLoading) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [isGameOver, isLoading]);

  // Key Handler: Submit guess
  const handleEnter = useCallback(async () => {
    if (isGameOver || isLoading) return;

    if (currentGuess.length !== wordLength) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 500);
      triggerToast(`Word must be ${wordLength} letters`);
      return;
    }

    const evalResults = evaluateGuess(currentGuess, targetWord);
    const newRow: GuessResult[] = evalResults.map((res) => ({
      letter: res.letter.toUpperCase(),
      status: res.status,
    }));

    const newGuesses = [...guesses, newRow];
    setGuesses(newGuesses);
    setCurrentGuess('');

    // Update letter statuses map
    const newLetterStatuses = { ...letterStatuses };
    newRow.forEach((res) => {
      const char = res.letter.toUpperCase();
      const existing = newLetterStatuses[char];
      if (res.status === 'correct') {
        newLetterStatuses[char] = 'correct';
      } else if (res.status === 'present' && existing !== 'correct') {
        newLetterStatuses[char] = 'present';
      } else if (res.status === 'absent' && !existing) {
        newLetterStatuses[char] = 'absent';
      }
    });
    setLetterStatuses(newLetterStatuses);

    // Check Win/Loss conditions
    const won = currentGuess.toUpperCase() === targetWord;
    const over = won || newGuesses.length >= maxAttempts;

    const newRawGuesses = newGuesses.map((row) => row.map((cell) => cell.letter).join(''));

    if (over) {
      setIsGameOver(true);
      setIsWon(won);
      const calcScore = won ? Math.max(100, 1000 - (newGuesses.length - 1) * 150) : 0;
      setScore(calcScore);

      // Start 15-second auto-advance timer
      setAutoAdvanceTimer(15);
      setIsTimerPaused(false);

      if (mode === 'archive') {
        // Save completed archive to IndexedDB and clear draft
        await saveArchiveGame({
          date: selectedDate,
          word: targetWord,
          guesses: newRawGuesses,
          isGameOver: true,
          isWon: won,
          score: calcScore,
          attempts: newGuesses.length,
          playedAt: new Date().toISOString(),
        });
        clearArchiveDraft(selectedDate);
        setCompletedDates((prev) => new Set(prev).add(selectedDate));
      } else {
        // Save Guest game state to LocalStorage
        saveGuestFreePlayState({
          word: targetWord,
          guesses: newRawGuesses,
          isGameOver: true,
          isWon: won,
          score: calcScore,
          attempts: newGuesses.length,
        });
      }
    } else {
      // In-progress save
      if (mode === 'archive') {
        saveArchiveDraft(selectedDate, targetWord, newRawGuesses);
      } else {
        saveGuestFreePlayState({
          word: targetWord,
          guesses: newRawGuesses,
          isGameOver: false,
          isWon: false,
          score: 0,
          attempts: newGuesses.length,
        });
      }
    }
  }, [
    isGameOver,
    isLoading,
    currentGuess,
    wordLength,
    targetWord,
    guesses,
    maxAttempts,
    letterStatuses,
    mode,
    selectedDate,
    triggerToast,
  ]);

  // Shuffle unplayed archive date
  const handleShuffleUnplayed = () => {
    const allValid = getAllValidArchiveDates();
    const unplayed = allValid.filter((d) => !completedDates.has(d));
    const pool = unplayed.length > 0 ? unplayed : allValid;
    const randomDate = pool[Math.floor(Math.random() * pool.length)];
    setSelectedDate(randomDate);
    triggerToast(`Jumped to archive: ${randomDate}`);
  };

  if (!isOpen) return null;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      isOverlay={true}
      zIndex="z-150"
      maxWidth="full"
      theme="dark"
      containerClassName="p-0!"
    >
      <div className="flex flex-col h-full w-full bg-background text-white select-none overflow-hidden animate-in fade-in duration-200">
        {/* Header Bar */}
        <div className="w-full bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <ArrowLeft size={16} /> Exit
            </button>

            {/* Mode Badge & Picker Launcher */}
            {mode === 'archive' ? (
              <button
                onClick={() => setShowDatePicker(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-500/40 rounded-xl text-indigo-200 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                <Calendar size={15} className="text-indigo-400" />
                <span>{selectedDate}</span>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-md">
                  {completedDates.has(selectedDate) ? '✅ Solved' : '🎯 Play'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-black uppercase tracking-wider">
                <Gamepad2 size={15} className="text-emerald-400" />
                <span>Daily Guest Game</span>
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            {mode === 'archive' && (
              <button
                onClick={handleShuffleUnplayed}
                className="p-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Shuffle Random Unplayed Archive"
              >
                <Shuffle size={16} />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Game Screen */}
        <div className="flex-1 flex flex-col items-center justify-between w-full max-w-lg mx-auto p-2 pb-4 sm:pb-6 min-h-0 h-full overflow-y-auto overflow-x-hidden">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest text-indigo-300">Loading Puzzle...</p>
            </div>
          ) : (
            <>
              {/* Completion Banner if game is over */}
              {isGameOver && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`w-full p-4 rounded-2xl border mb-2 shadow-lg flex flex-col gap-3 ${
                    isWon
                      ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
                      : 'bg-rose-950/90 border-rose-500/60 text-rose-100'
                  }`}
                >
                  {/* Status & Revealed Answer */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/10 shrink-0">
                        {isWon ? <CheckCircle size={24} className="text-emerald-400" /> : <X size={24} className="text-rose-400" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider">
                          {isWon ? 'Puzzle Solved!' : 'Better Luck Next Time!'}
                        </h3>
                        <p className="text-xs font-bold text-gray-200">
                          The word was <span className="text-white font-black tracking-widest text-sm bg-white/10 px-2 py-0.5 rounded-md border border-white/20 ml-1">{targetWord}</span>
                        </p>
                      </div>
                    </div>

                    {isWon && (
                      <div className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase shrink-0 shadow-md">
                        +{score} pts
                      </div>
                    )}
                  </div>

                  {/* Auto-Advance Prompt */}
                  <div className="pt-2.5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                      {autoAdvanceTimer !== null && !isTimerPaused ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
                          <span>Next puzzle in <strong className="text-white font-mono text-sm">{autoAdvanceTimer}s</strong>...</span>
                        </>
                      ) : (
                        <span>Play next unplayed puzzle?</span>
                      )}
                    </span>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleNextUnplayedPuzzle}
                        className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Play size={14} /> Play Next
                      </button>
                      {autoAdvanceTimer !== null && !isTimerPaused && (
                        <button
                          onClick={() => setIsTimerPaused(true)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                          title="Pause auto-advance timer"
                        >
                          <Pause size={14} /> Pause
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Core Game Area & Keyboard */}
              <GameArea
                wordLength={wordLength}
                maxAttempts={maxAttempts}
                guesses={guesses}
                currentGuess={currentGuess}
                letterStatuses={letterStatuses}
                hintRecord={null}
                isGameOver={isGameOver}
                isShake={isShake}
                onChar={handleChar}
                onDelete={handleDelete}
                onEnter={handleEnter}
                gameplayType={mode}
              />
            </>
          )}
        </div>

        {/* Archive Date Picker Overlay */}
        {showDatePicker && (
          <ArchiveDatePicker
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setShowDatePicker(false);
            }}
            completedDates={completedDates}
            onClose={() => setShowDatePicker(false)}
            onShuffleUnplayed={handleShuffleUnplayed}
          />
        )}
      </div>
    </ModalLayout>
  );
};
