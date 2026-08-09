// src/components/freeplay/FreePlayModal.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Shuffle, Trophy, RotateCcw, Flame, CheckCircle, ArrowLeft, Gamepad2 } from 'lucide-react';
import { GameArea } from '../layout/GameArea';
import { ArchiveDatePicker } from './ArchiveDatePicker';
import { getDailyConfigSub } from '../../lib/game-logic/helpers/getDailyConfig';
import { validateWordInDictionary } from '../../utils/wordgrid/dictionary';
import {
  getArchiveGame,
  saveArchiveGame,
  getCompletedArchiveDates,
  getYesterdayArchiveDate,
  getAllValidArchiveDates,
  FIRST_ARCHIVE_DATE,
  type ArchiveGameRecord,
} from '../../utils/archiveDb';
import {
  getGuestFreePlayState,
  saveGuestFreePlayState,
  getTodayDateString,
  type GuestFreePlayState,
} from '../../utils/guestFreePlay';
import type { GuessResult, LetterStatus } from '../../types/game';
import { useApp } from '../../context/AppContext';

interface FreePlayModalProps {
  isOpen: boolean;
  initialMode?: 'guest' | 'archive';
  onClose: () => void;
}

export const FreePlayModal = ({
  isOpen,
  initialMode = 'archive',
  onClose,
}: FreePlayModalProps) => {
  const { triggerToast } = useApp();
  const [mode, setMode] = useState<'guest' | 'archive'>(initialMode);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return initialMode === 'guest' ? getTodayDateString() : getYesterdayArchiveDate();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  // Game puzzle configuration & state
  const [targetWord, setTargetWord] = useState<string>('');
  const [wordLength, setWordLength] = useState<number>(5);
  const [maxAttempts, setMaxAttempts] = useState<number>(6);

  const [guesses, setGuesses] = useState<GuessResult[][]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isWon, setIsWon] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [isShake, setIsShake] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load completed archive dates from IndexedDB
  const refreshCompletedDates = useCallback(async () => {
    const dates = await getCompletedArchiveDates();
    setCompletedDates(dates);
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshCompletedDates();
    }
  }, [isOpen, refreshCompletedDates]);

  // Load game puzzle state based on mode & selectedDate
  const loadPuzzle = useCallback(async () => {
    setIsLoading(true);
    setCurrentGuess('');
    setIsShake(false);

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
          reconstructStateFromGuesses(config.word.toUpperCase(), saved.guesses, config.length, config.maxAttempts || 6);
        } else {
          setGuesses([]);
          setLetterStatuses({});
          setIsGameOver(false);
          setIsWon(false);
          setScore(0);
        }
      } else {
        // Archive mode
        const config = await getDailyConfigSub(true, selectedDate);
        setTargetWord(config.word.toUpperCase());
        setWordLength(config.length);
        setMaxAttempts(config.maxAttempts || 6);

        // Load archive record from IndexedDB
        const record = await getArchiveGame(selectedDate);
        if (record) {
          reconstructStateFromGuesses(config.word.toUpperCase(), record.guesses, config.length, config.maxAttempts || 6);
        } else {
          setGuesses([]);
          setLetterStatuses({});
          setIsGameOver(false);
          setIsWon(false);
          setScore(0);
        }
      }
    } catch (err) {
      console.warn('[FreePlayModal] Error loading puzzle:', err);
      triggerToast('Failed to load puzzle config.');
    } finally {
      setIsLoading(false);
    }
  }, [mode, selectedDate, triggerToast]);

  useEffect(() => {
    if (isOpen) {
      loadPuzzle();
    }
  }, [isOpen, loadPuzzle]);

  // Reconstruct game board & keyboard statuses from stored raw guess strings
  const reconstructStateFromGuesses = (
    word: string,
    rawGuesses: string[],
    length: number,
    attemptsMax: number
  ) => {
    const evaluatedGuesses: GuessResult[][] = [];
    const newLetterStatuses: Record<string, LetterStatus> = {};

    rawGuesses.forEach((guessStr) => {
      const evalRow = evaluateGuess(word, guessStr);
      evaluatedGuesses.push(evalRow);

      evalRow.forEach((res) => {
        const char = res.char.toUpperCase();
        const current = newLetterStatuses[char];
        if (res.status === 'correct') {
          newLetterStatuses[char] = 'correct';
        } else if (res.status === 'present' && current !== 'correct') {
          newLetterStatuses[char] = 'present';
        } else if (res.status === 'absent' && !current) {
          newLetterStatuses[char] = 'absent';
        }
      });
    });

    setGuesses(evaluatedGuesses);
    setLetterStatuses(newLetterStatuses);

    const won = rawGuesses.length > 0 && rawGuesses[rawGuesses.length - 1].toUpperCase() === word;
    const over = won || rawGuesses.length >= attemptsMax;

    setIsWon(won);
    setIsGameOver(over);
    setScore(won ? Math.max(100, 1000 - (rawGuesses.length - 1) * 150) : 0);
  };

  // Evaluate guess against target word
  const evaluateGuess = (target: string, guess: string): GuessResult[] => {
    const targetArr = target.split('');
    const guessArr = guess.toUpperCase().split('');
    const result: GuessResult[] = new Array(guessArr.length);
    const targetUsed = new Array(targetArr.length).fill(false);

    // 1st pass: Correct matches
    guessArr.forEach((char, i) => {
      if (char === targetArr[i]) {
        result[i] = { char, status: 'correct' };
        targetUsed[i] = true;
      }
    });

    // 2nd pass: Present / Absent
    guessArr.forEach((char, i) => {
      if (result[i]) return;
      const foundIdx = targetArr.findIndex((tc, idx) => tc === char && !targetUsed[idx]);
      if (foundIdx !== -1) {
        result[i] = { char, status: 'present' };
        targetUsed[foundIdx] = true;
      } else {
        result[i] = { char, status: 'absent' };
      }
    });

    return result;
  };

  // On Key stroke / character input
  const handleChar = (char: string) => {
    if (isGameOver || isLoading) return;
    if (currentGuess.length < wordLength) {
      setCurrentGuess((prev) => (prev + char).toUpperCase());
    }
  };

  // On Backspace
  const handleDelete = () => {
    if (isGameOver || isLoading) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  // On Enter / Guess submission
  const handleEnter = async () => {
    if (isGameOver || isLoading) return;

    if (currentGuess.length < wordLength) {
      setIsShake(true);
      triggerToast(`Word must be ${wordLength} letters long!`);
      setTimeout(() => setIsShake(false), 500);
      return;
    }

    const isValid = await validateWordInDictionary(currentGuess);
    if (!isValid) {
      setIsShake(true);
      triggerToast(`"${currentGuess}" is not a valid word!`);
      setTimeout(() => setIsShake(false), 500);
      return;
    }

    // Process valid guess
    const evalRow = evaluateGuess(targetWord, currentGuess);
    const newGuesses = [...guesses, evalRow];
    const newRawGuesses = newGuesses.map((row) => row.map((r) => r.char).join(''));

    // Update letter statuses
    const newStatuses = { ...letterStatuses };
    evalRow.forEach((res) => {
      const char = res.char.toUpperCase();
      const curr = newStatuses[char];
      if (res.status === 'correct') {
        newStatuses[char] = 'correct';
      } else if (res.status === 'present' && curr !== 'correct') {
        newStatuses[char] = 'present';
      } else if (res.status === 'absent' && !curr) {
        newStatuses[char] = 'absent';
      }
    });

    const won = currentGuess.toUpperCase() === targetWord;
    const over = won || newGuesses.length >= maxAttempts;
    const calcScore = won ? Math.max(100, 1000 - (newGuesses.length - 1) * 150) : 0;

    setGuesses(newGuesses);
    setLetterStatuses(newStatuses);
    setCurrentGuess('');
    setIsWon(won);
    setIsGameOver(over);
    setScore(calcScore);

    // Save locally
    if (mode === 'guest') {
      saveGuestFreePlayState({
        word: targetWord,
        guesses: newRawGuesses,
        isGameOver: over,
        isWon: won,
        score: calcScore,
        attempts: newGuesses.length,
      });
    } else {
      const record: ArchiveGameRecord = {
        date: selectedDate,
        word: targetWord,
        guesses: newRawGuesses,
        isGameOver: over,
        isWon: won,
        score: calcScore,
        attempts: newGuesses.length,
        playedAt: new Date().toISOString(),
        completedAt: over ? new Date().toISOString() : undefined,
      };
      await saveArchiveGame(record);
      refreshCompletedDates();
    }
  };

  // Shuffle to random unplayed date
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden animate-in fade-in duration-200">
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
      <div className="flex-1 flex flex-col items-center justify-between w-full max-w-lg mx-auto p-2 min-h-0 overflow-y-auto">
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
                className={`w-full p-3.5 rounded-2xl border mb-2 shadow-lg flex items-center justify-between gap-3 ${
                  isWon
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
                    : 'bg-rose-950/90 border-rose-500/60 text-rose-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/10 shrink-0">
                    {isWon ? <CheckCircle size={22} className="text-emerald-400" /> : <X size={22} className="text-rose-400" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      {isWon ? 'Puzzle Solved!' : 'Better Luck Next Time!'}
                    </h3>
                    <p className="text-xs font-bold text-gray-300">
                      The word was <span className="text-white font-black tracking-widest">{targetWord}</span>
                    </p>
                  </div>
                </div>

                {isWon && (
                  <div className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase shrink-0 shadow-md">
                    +{score} pts
                  </div>
                )}
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
  );
};
