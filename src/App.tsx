import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDailyConfig, checkGuess, getHint, updateStats, syncStatsFromLocalStorage, submitScoreToCloud } from './lib/gameLogic';
import { getWordLists, } from './data/words';
import type { GuessResult, LetterStatus } from './types/game';
import { DatePicker } from './components/DatePicker';
import { Grid } from './components/Grid';
import { Keyboard } from './components/Keyboard';
import { generateShareText } from './lib/share';
import { ShareButton } from './components/ShareButton';
import { RotateCcw, Lightbulb, HelpCircle, BarChart2, } from 'lucide-react';
import { Toast } from './components/Toast';
import { getLossMessage, getWinMessage } from './lib/messages';
import { InfoModal } from './components/InfoModal';
import { StatsModal } from './components/StatsModal';
import { useAuth } from './hooks/useAuth';

// Helper to get initial state from localStorage
const getSavedState = (date: string) => {
  const saved = localStorage.getItem(`wordle-${date}`);
  return saved ? JSON.parse(saved) : null;
};

export default function App() {
  /**
 * One-time cleanup for Beta testers
 * Ensures old, buggy localStorage data is wiped for the new 5-letter version.
 */
  const MIGRATION_KEY = 'wordle_v2_cleared';

  if (!localStorage.getItem(MIGRATION_KEY)) {
    // 1. Find all keys that start with our game prefix
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.startsWith('wordle-')
    );

    // 2. Remove them
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // 3. Mark as cleared so this block is skipped on next reload
    localStorage.setItem(MIGRATION_KEY, 'true');

    console.log(`🧹 Beta Cleanup: Removed ${keysToRemove.length} old save files.`);
  }

  syncStatsFromLocalStorage();

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
  const [toast, setToast] = useState({ show: false, message: "" });
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const { user, signInWithGoogle, signOut } = useAuth();

  const triggerToast = (msg: string) => {
    setToast({ show: true, message: msg });
  };

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

    // 1. Dynamic Validation based on current length
    const { valid } = getWordLists(config.length);

    // Using .has() on a Set is O(1) performance vs O(n) for Array.includes
    if (!valid.has(upperGuess)) {
      triggerToast("Not in word list, buddy.");
      return;
    }

    // 2. Process Result
    const result = checkGuess(upperGuess, config.word);
    const newGuesses = [...guesses, result];

    // 3. Update keyboard letter colors
    const newStatuses = { ...letterStatuses };
    result.forEach((res) => {
      // Only update if we haven't already found the 'correct' spot for this letter
      if (newStatuses[res.letter] !== 'correct') {
        newStatuses[res.letter] = res.status;
      }
    });

    // 4. Update Game States
    setGuesses(newGuesses);
    setLetterStatuses(newStatuses);
    setCurrentGuess("");

    // 5. Check Win/Loss
    const won = upperGuess === config.word;
    const lost = newGuesses.length === config.maxAttempts;

    if (won || lost) {
      setIsGameOver(true);

      const finalMessage = won
        ? getWinMessage(newGuesses.length)
        : getLossMessage(config.word);

      const existingSave = localStorage.getItem(`wordle-${date}`);
      const alreadyFinished = existingSave && JSON.parse(existingSave).status !== 'playing';

      if (!alreadyFinished) {
        updateStats(won, newGuesses.length);
      }

      setTimeout(() => {
        triggerToast(finalMessage);
      }, 500); // Wait for the tile animations to finish
    }

    // 6. Persistence
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

  //hints
  const [usedHint, setUsedHint] = useState(false);

  const handleHint = () => {
    // Guard clause: Only allowed after 3rd attempt and if not used yet
    if (guesses.length < 3 || usedHint || isGameOver) return;

    const hint = getHint(config.word, guesses);

    if (hint) {
      setUsedHint(true);
      triggerToast(`Pitiful. There is a "${hint.letter}" at position ${hint.index + 1}.`);
    } else {
      // This handles the edge case where they found all letters but haven't won
      triggerToast("You've found all the letters. Just use your brain.");
    }
  };

  // sync to cloud

  useEffect(() => {
  if (user && isGameOver) {
    // Only sync if the game is actually finished
    const currentSave = localStorage.getItem(`wordle-${date}`);
    if (currentSave) {
      const saveData = JSON.parse(currentSave);
      if (saveData.status !== 'playing') {
        submitScoreToCloud(
          user.id,
          date,
          config,
          guesses,
          usedHint
        ).then(score => {
          if (score) triggerToast(`Synced to Leaderboard! Score: ${score}`);
        });
      }
    }
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [user, isGameOver]);

  return (
    <main className="h-svh flex flex-col bg-dark text-white overflow-hidden p-2 sm:p-4">

      <Toast
        isVisible={toast.show}
        message={toast.message}
        onClose={() => setToast({ ...toast, show: false })}
      />
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)}  user={user}/>

      {/* Minimal Top Bar - Replaces the big header */}
      <div className="flex justify-between items-center px-2 py-2 max-w-md mx-auto w-full border-b border-gray-800 mb-2">
        <span className="font-black text-lg tracking-tighter uppercase">Wordle Variant</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-gray-500">{config.length}L</span>
          {user ? (
            <div className="group relative">
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-7 h-7 rounded-full border border-gray-700 cursor-pointer"
              />
              {/* Tooltip-style Logout */}
              <button
                onClick={signOut}
                className="absolute top-10 right-0 bg-red-500 text-[10px] px-2 py-1 rounded hidden group-hover:block whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-[10px] font-bold bg-white text-black px-3 py-1 rounded-full uppercase tracking-tighter hover:bg-gray-200 transition-colors"
            >
              Login
            </button>
          )}
          <button
            onClick={() => setIsInfoOpen(true)}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <HelpCircle size={20} />
          </button>
          {guesses.length >= 3 && !isGameOver && (
            <button
              onClick={handleHint}
              disabled={usedHint}
              className={`p-1.5 rounded-full transition-all ${usedHint
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-yellow-500 hover:bg-yellow-500/10 animate-pulse'
                }`}
              title="Reveal a hint (at the cost of your dignity)"
            >
              <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
            </button>
          )}
          <button onClick={() => setIsStatsOpen(true)} className="text-gray-500 hover:text-white p-1">
            <BarChart2 size={18} />
          </button>
          <button
            onClick={() => window.location.reload()}
            className="p-1.5 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white active:rotate-180 duration-500"
            title="Refresh Game"
          >
            <RotateCcw size={18} />
          </button>
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
      {isGameOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-700 text-center shadow-2xl max-w-sm w-full">
            <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-tighter">
              {guesses[guesses.length - 1].every(r => r.status === 'correct') ? '' : 'Nice Try!'}
            </h2>
            <p className="text-gray-400 mb-6 font-mono text-sm">
              The word was <span className="text-white font-bold">{config.word}</span>
            </p>

            <div className="mb-8">
              <ShareButton
                text={generateShareText(
                  date,
                  guesses,
                  config.maxAttempts,
                  guesses[guesses.length - 1].every(r => r.status === 'correct'),
                  usedHint
                )}
              />
            </div>

            <button
              onClick={() => {
                handleDateChange(new Date().toISOString().split('T')[0])
                setIsGameOver(false)
              }}
              className="text-gray-500 text-sm hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}