import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDailyConfig, checkGuess } from './lib/gameLogic';
import { VALID_GUESSES_5 } from './data/words';
import type{ GuessResult, LetterStatus } from './types/game';
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
    <main className="h-svh flex flex-col bg-dark text-white overflow-hidden">

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4">
        <header className="mb-6 text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">
            Wordle Variant
          </h1>
          <p className="text-gray-400 text-xs md:text-sm mt-2 font-mono">
            {config.length} LETTERS • {date}
          </p>
        </header>

        <div className="w-full max-w-md">
          <DatePicker currentDate={date} onDateChange={handleDateChange} />
        </div>

        {/* Grid Container - centered and padded */}
        <div className="flex-1 flex items-center justify-center w-full my-4">
          <Grid
          
            wordLength={config.length}
            maxAttempts={config.maxAttempts}
            guesses={guesses}
            currentGuess={currentGuess}
          />
        </div>
      </div>

      {/* Keyboard Section - Forced Centering */}
      <div className="w-full pb-8">
        <div className="max-w-[600px] mx-auto px-2">
          <Keyboard
            onChar={onChar}
            onDelete={onDelete}
            onEnter={onEnter}
            letterStatuses={letterStatuses}
          />
        </div>
      </div>
    </main>
  );
}