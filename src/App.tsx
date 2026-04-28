import { useState, useEffect, useCallback } from 'react';
import { getDailyConfig, checkGuess, getHint, updateStats, syncStatsFromLocalStorage, submitScoreToCloud, syncGameState } from './lib/gameLogic';
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
import { supabase } from './lib/supabaseClient';

const getSavedState = (date: string) => {
  const saved = localStorage.getItem(`wordle-${date}`);
  return saved ? JSON.parse(saved) : null;
};

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth();

  // 1. Initial State
  const [date, setDate] = useState(() =>
    new URLSearchParams(window.location.search).get('date') ||
    new Date().toISOString().split('T')[0]
  );

  const [guesses, setGuesses] = useState<GuessResult[][]>([]);
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});
  const [currentGuess, setCurrentGuess] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameOverModal, setIsGameOverModal] = useState(false)
  const [usedHint, setUsedHint] = useState(false);
  const [hintRecord, setHintRecord] = useState<{ letter: string, index: number } | null>(null);

  const [toast, setToast] = useState<{
    show: boolean, message: string, duration: number | undefined
  }>({ show: false, message: "", duration: undefined });
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const config = getDailyConfig(date);

  const triggerToast = (msg: string, duration?: number) => setToast({ show: true, message: msg, duration: duration });

  // 2. Authoritative Hydration Effect
  useEffect(() => {
    let isMounted = true;

    const loadGameData = async () => {
      // Phase A: Local Load
      const local = getSavedState(date);
      if (isMounted) {
        setGuesses(local?.guesses || []);
        setLetterStatuses(local?.letterStatuses || {});
        setUsedHint(local?.usedHint || false);

        if (local?.hintRecord && !local?.usedHint) {
          setUsedHint(true);
        }
        setHintRecord(local?.hintRecord || null);
        setIsGameOver(local?.status === 'won' || local?.status === 'lost');
        setIsGameOverModal(local?.status === 'won' || local?.status === 'lost');
      }

      // Phase B: Cloud Load (SSoT)
      if (user?.id) {
        const { data, error } = await supabase
          .from('scores')
          .select('*')
          .eq('user_id', user.id)
          .eq('game_date', date)
          .maybeSingle();

        if (!isMounted || error || !data) return;

        const cloudGuesses = data.guesses || [];
        // Only overwrite if cloud has data or game is finished
        if (cloudGuesses.length > 0 || data.status !== 'playing') {
          setGuesses(cloudGuesses);
          setUsedHint(data.hints_used);
          setHintRecord(data.hint_record);
          setIsGameOver(data.status !== 'playing');
          setIsGameOverModal(data.status !== 'playing');

          const newStatuses: Record<string, LetterStatus> = {};
          cloudGuesses.forEach((row: GuessResult[]) => {
            row.forEach((res) => {
              if (newStatuses[res.letter] !== 'correct') {
                newStatuses[res.letter] = res.status;
              }
            });
          });
          setLetterStatuses(newStatuses);

          localStorage.setItem(`wordle-${date}`, JSON.stringify({
            date,
            guesses: cloudGuesses,
            letterStatuses: newStatuses,
            status: data.status,
            usedHint: data.used_hint,
            hintRecord: data.hint_record
          }));
        }
      }
    };

    loadGameData();
    syncStatsFromLocalStorage();
    return () => { isMounted = false; };
  }, [date, user?.id]);

  const handleDateChange = (newDate: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('date', newDate);
    window.history.pushState({}, '', url);
    setDate(newDate);
  };

  const onChar = useCallback((char: string) => {
    if (isGameOver) return;
    setCurrentGuess(prev => (prev.length < config.length ? prev + char : prev));
  }, [config.length, isGameOver]);

  const onDelete = useCallback(() => {
    if (isGameOver) return;
    setCurrentGuess(prev => prev.slice(0, -1));
  }, [isGameOver]);

  const onEnter = useCallback(async () => {
    if (isGameOver || currentGuess.length !== config.length) return;

    const upperGuess = currentGuess.toUpperCase();
    const { valid } = getWordLists(config.length);

    if (!valid.has(upperGuess)) {
      triggerToast("Not in word list.");
      return;
    }

    const result = checkGuess(upperGuess, config.word);
    const newGuesses = [...guesses, result];
    const newStatuses = { ...letterStatuses };

    result.forEach((res) => {
      if (newStatuses[res.letter] !== 'correct') {
        newStatuses[res.letter] = res.status;
      }
    });

    const won = upperGuess === config.word;
    const lost = newGuesses.length === config.maxAttempts;
    const newStatus = won ? 'won' : (lost ? 'lost' : 'playing');

    // Update Local UI
    setGuesses(newGuesses);
    setLetterStatuses(newStatuses);
    setCurrentGuess("");

    if (won || lost) {
      setIsGameOver(true);
      setIsGameOverModal(true);
      updateStats(won, newGuesses.length);
      setTimeout(() => triggerToast(won ? getWinMessage(newGuesses.length) : getLossMessage(config.word), 8500), 500);
    }

    const payload = { date, guesses: newGuesses, letterStatuses: newStatuses, status: newStatus, usedHint, hintRecord, config };
    localStorage.setItem(`wordle-${date}`, JSON.stringify(payload));

    if (user) await syncGameState(user.id, date, payload);
  }, [isGameOver, currentGuess, config, guesses, letterStatuses, date, usedHint, hintRecord, user]);

  // Handle Leaderboard Sync on Game Over
  useEffect(() => {
    if (user && isGameOver) {
      submitScoreToCloud(user.id, date, config, guesses, usedHint)
    }
  }, [user, isGameOver, date, config, guesses, usedHint]);

  // Physical Keyboard
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

  const handleHint = async () => {
    if (guesses.length < 3 || usedHint || isGameOver) return;
    const hint = getHint(config.word, guesses);
    if (hint) {
      setUsedHint(true);
      setHintRecord(hint);
      const payload = { date, guesses, letterStatuses, status: 'playing', usedHint: true, hintRecord: hint, config };
      localStorage.setItem(`wordle-${date}`, JSON.stringify(payload));
      if (user) await syncGameState(user.id, date, payload);
      triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`);
    }
  };


  return (
    <main className="h-svh flex flex-col bg-dark text-white overflow-hidden p-2 sm:p-4">

      <Toast
        isVisible={toast.show}
        message={toast.message}
        duration={toast.duration}
        onClose={() => setToast({ ...toast, show: false })}
      />
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} user={user} />

      <div className="flex flex-col gap-2 w-full max-w-lg mx-auto pb-1 border-b border-gray-800">

        {/* Row 1: Game Identity & Date Selection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] text-white tracking-tighter uppercase">Wordle Variant<span className="text-correct">.</span></h2>
            <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-400 border border-gray-700 me-1">
              {config.length}L
            </span>
          </div>

          <div className="flex items-center gap-1">
            <DatePicker currentDate={date} onDateChange={handleDateChange} />
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-gray-800 rounded-full transition-all text-gray-500 hover:text-white active:rotate-180 duration-500"
              title="Refresh Game"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: User Stats, Hints, and Info */}
        <div className="flex items-center justify-between bg-gray-900/50 py-1 px-2 rounded-xl border border-gray-800/50">
          <div className="flex items-center gap-2">
            {user ? (
              <div className="group relative flex items-center gap-2">
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="w-6 h-6 rounded-full border border-gray-700 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase hidden sm:block">
                  {user.user_metadata.full_name?.split(' ')[0]}
                </span>
                <button
                  onClick={signOut}
                  className="absolute top-8 left-0 bg-red-500 text-[9px] font-black px-2 py-1 rounded-md hidden group-hover:block whitespace-nowrap z-50 shadow-xl"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="text-[9px] font-black bg-white text-black px-3 py-1 rounded-full uppercase tracking-widest hover:bg-gray-200 transition-colors"
              >
                Login
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {guesses.length >= 3 && !isGameOver && (
              <button
                onClick={handleHint}
                disabled={usedHint}
                className={`transition-all ${usedHint ? 'text-gray-700' : 'text-yellow-500 animate-pulse'}`}
              >
                <Lightbulb size={18} fill={usedHint ? "none" : "currentColor"} />
              </button>
            )}

            <button onClick={() => setIsStatsOpen(true)} className="text-gray-400 hover:text-white p-1">
              <BarChart2 size={18} />
            </button>

            <button
              onClick={() => setIsInfoOpen(true)}
              className="text-gray-400 hover:text-white"
            >
              <HelpCircle size={18} />
            </button>
          </div>
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
      {
        isGameOver ? null : <div className="w-full max-w-125 mx-auto pt-2 pb-2 shrink-0">
          <Keyboard
            onChar={onChar}
            onDelete={onDelete}
            onEnter={onEnter}
            letterStatuses={letterStatuses}
          />
        </div>
      }


      {isGameOverModal && (
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
                // handleDateChange(new Date().toISOString().split('T')[0])
                setIsGameOverModal(false)
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