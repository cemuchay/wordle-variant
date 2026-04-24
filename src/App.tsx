import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDailyConfig, checkGuess } from './lib/gameLogic';
import { VALID_GUESSES_5 } from './data/words';
import type { GuessResult, LetterStatus } from './types/game';
import { DatePicker } from './components/DatePicker';
import { Grid } from './components/Grid';
import { Keyboard } from './components/Keyboard';

// Helper to get initial state from localStorage
const getSavedState = (date: string) => {
  const saved = localStorage.getItem(`wordle-${date}`);
  return saved ? JSON.parse(saved) : null;
};

export default function App() {
  const [date, setDate] = useState(() =>
    new URLSearchParams(window.location.search).get('date') ||
    new Date().toISOString().split('T')[0]
  );

  const config = useMemo(() => getDailyConfig(date), [date]);

  // Initialize state from storage or defaults
  const [guesses, setGuesses] = useState<GuessResult[][]>(() => getSavedState(date)?.guesses || []);
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>(() => getSavedState(date)?.letterStatuses || {});
  const [currentGuess, setCurrentGuess] = useState("");
  const [isGameOver, setIsGameOver] = useState(() => {
    const saved = getSavedState(date);
    return saved?.status === 'won' || saved?.status === 'lost';
  });

  const handleDateChange = (newDate: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('date', newDate);
    window.history.pushState({}, '', url);

    // Reset all states for the new date
    const saved = getSavedState(newDate);
    setDate(newDate);
    setGuesses(saved?.guesses || []);
    setLetterStatuses(saved?.letterStatuses || {});
    setCurrentGuess("");
    setIsGameOver(saved?.status === 'won' || saved?.status === 'lost');
  };

  const onChar = useCallback((char: string) => {
    if (isGameOver) return;
    setCurrentGuess(prev => {
      if (prev.length < config.length) return prev + char;
      return prev;
    });
  }, [config.length, isGameOver]);

  const onDelete = useCallback(() => {
    if (isGameOver) return;
    setCurrentGuess(prev => prev.slice(0, -1));
  }, [isGameOver]);

  const onEnter = useCallback(() => {
    if (isGameOver || currentGuess.length !== config.length) return;

    const upperGuess = currentGuess.toUpperCase();
    const allWords = [...VALID_GUESSES_5];

    if (!allWords.includes(upperGuess)) {
      alert("Not in word list");
      return;
    }

    const result = checkGuess(upperGuess, config.word);
    const newGuesses = [...guesses, result];

    // Calculate new letter statuses
    const newStatuses = { ...letterStatuses };
    result.forEach((res) => {
      if (newStatuses[res.letter] !== 'correct') {
        newStatuses[res.letter] = res.status;
      }
    });

    // Update States
    setGuesses(newGuesses);
    setLetterStatuses(newStatuses);
    setCurrentGuess("");

    // Win/Loss Check
    const won = upperGuess === config.word;
    const lost = newGuesses.length === config.maxAttempts;

    if (won || lost) {
      setIsGameOver(true);
      setTimeout(() => alert(won ? "🎉 Genius!" : `💥 Word was: ${config.word}`), 100);
    }

    // Persist
    localStorage.setItem(`wordle-${date}`, JSON.stringify({
      date,
      guesses: newGuesses,
      letterStatuses: newStatuses,
      status: won ? 'won' : (lost ? 'lost' : 'playing')
    }));
  }, [currentGuess, config, guesses, letterStatuses, date, isGameOver]);

  // Physical Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;

      const key = e.key.toUpperCase();
      if (key === 'ENTER') onEnter();
      else if (key === 'BACKSPACE') onDelete();
      else if (/^[A-Z]$/.test(key)) onChar(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEnter, onDelete, onChar]);

  return (
    <main className="h-svh flex flex-col bg-dark text-white overflow-hidden p-2 sm:p-4">

      {/* Minimal Top Bar - Replaces the big header */}
      <div className="flex justify-between items-center px-2 py-2 max-w-md mx-auto w-full border-b border-gray-800 mb-2">
        <span className="font-black text-lg tracking-tighter uppercase">Wordle Variant</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-gray-500">{config.length}L</span>
          <DatePicker currentDate={date} onDateChange={handleDateChange} />
        </div>
      </div>

      {/* Grid Area - This will now shrink or grow to fit available space */}
      <div className="flex-1 flex items-center justify-center min-h-0 w-full px-2">
        <div className="scale-[0.85] sm:scale-100 transition-transform origin-center">
          <Grid
            wordLength={config.length}
            maxAttempts={config.maxAttempts}
            guesses={guesses}
            currentGuess={currentGuess}
          />
        </div>
      </div>

      {/* Keyboard Section - Forced to stay at the bottom, slightly more compact */}
      <div className="w-full max-w-[500px] mx-auto pt-2 pb-2 shrink-0">
        <Keyboard
          onChar={onChar}
          onDelete={onDelete}
          onEnter={onEnter}
          letterStatuses={letterStatuses}
        />
      </div>

      {/* Game Over Modal logic remains same... */}
    </main>
  );
}