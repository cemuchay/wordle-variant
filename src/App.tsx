import { BarChart2, HelpCircle, Lightbulb, RotateCcw, } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GameOverModal } from './components/GameOverModal';
import { Grid } from './components/Grid';
import { InfoModal } from './components/InfoModal';
import { Keyboard } from './components/Keyboard';
import { StatsModal } from './components/StatsModal';
import { Toast } from './components/Toast';
import { getWordLists, } from './data/words';
import { useAuth } from './hooks/useAuth';
import { checkGuess, fetchAndSyncCloudStats, getDailyConfig, getHint, syncGameState, syncStatsFromLocalStorage, syncWithRetry, updateStats } from './lib/gameLogic';
import { getLossMessage, getWinMessage } from './lib/messages';
import { supabase } from './lib/supabaseClient';
import type { GuessResult, LetterStatus } from './types/game';
import { getServerDate } from './lib/time';
import { CloudSyncMenu } from './components/SyncCloudModal';
import { useWordleStats } from './hooks/useStats';

const getSavedState = (date: string) => {
  const saved = localStorage.getItem(`wordle-${date}`);
  return saved ? JSON.parse(saved) : null;
};

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth();


  const [date, setDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Initialize the hook
  const { stats, refresh } = useWordleStats(user, isStatsOpen, date);

  useEffect(() => {
    const syncTime = async () => {
      const serverDate = await getServerDate();
      setDate(serverDate.formatted);
      setIsLoading(false);
    };

    syncTime();
  }, []);


  const [guesses, setGuesses] = useState<GuessResult[][]>([]);
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});
  const [currentGuess, setCurrentGuess] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameOverModal, setIsGameOverModal] = useState(false)
  const [usedHint, setUsedHint] = useState(false);
  const [hintRecord, setHintRecord] = useState<{ letter: string, index: number } | null>(null);
  const [gameMessage, setGameMessage] = useState("")

  const [toast, setToast] = useState<{
    show: boolean, message: string, duration: number | undefined
  }>({ show: false, message: "", duration: undefined });
  const [isInfoOpen, setIsInfoOpen] = useState(false);


  const config = getDailyConfig(date as string);

  const triggerToast = (msg: string, duration?: number) => setToast({ show: true, message: msg, duration: duration });


  const initializeUserStats = async (userId: string) => {
    // 1. First, scrape any local-only legacy data into the aggregate object
    syncStatsFromLocalStorage();

    // 2. Then, sync with the cloud
    // This function's conflict logic ensures that if step 1 found 
    // more games than the cloud has, we keep the local version.
    await fetchAndSyncCloudStats(userId);
  };

  // 2. Authoritative Hydration Effect
  useEffect(() => {
    let isMounted = true;

    const loadGameData = async () => {
      // Phase A: Local Load
      const local = getSavedState(date as string);
      if (isMounted) {
        setGuesses(local?.guesses || []);
        setLetterStatuses(local?.letterStatuses || {});
        setUsedHint(local?.usedHint || false);


        if (local?.hintRecord && !local?.usedHint) {
          setUsedHint(true);
        }
        setHintRecord(local?.hintRecord || null);

        const localGameOver = (local?.status === 'won' || local?.status === 'lost')
        if (localGameOver) refresh()
        let localGameMessage = local?.gameMessage || ""
        setIsGameOver(localGameOver)

        if (localGameOver && !localGameMessage) {
          localGameMessage = local?.status === 'won' ? getWinMessage(local?.guesses.length) : getLossMessage()
        }

        setGameMessage(localGameMessage)
        setIsGameOverModal(localGameOver);

      }

      // Phase B: Cloud Load (SSoT)
      if (user?.id) {
        if (!date) return
        const { data, error } = await supabase
          .from('scores')
          .select('*')
          .eq('user_id', user.id)
          .eq('game_date', date)
          .maybeSingle();

        if (!isMounted || error || !data) return;

        const cloudGuesses = data.guesses || [];
        // Only overwrite if cloud has data or game is finished

        // Only overwrite local if the cloud is actually ahead
        const cloudIsAhead = cloudGuesses.length > (local?.guesses?.length || 0);
        const cloudIsFinished = data.status !== 'playing';
        const localIsFinished = local?.status === 'won' || local?.status === 'lost';

        // If local is finished but cloud isn't, stick with local and trigger a re-sync
        if (localIsFinished && !cloudIsFinished) {
          console.log("Local is ahead (finished). Keeping local and re-syncing...");
          syncGameState(user.id, date, local);
          return; // Don't let cloud overwrite
        }

        if (cloudIsAhead || (cloudIsFinished && !localIsFinished)) {
          setGuesses(cloudGuesses);
          setUsedHint(data.hints_used);
          setHintRecord(data.hint_record);
          setIsGameOver(data.status !== 'playing');
          setIsGameOverModal(data.status !== 'playing');
          setGameMessage(data.game_message)

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
            hintRecord: data.hint_record,
            gameMessage: data.game_message
          }));
        }
      }
    };

    loadGameData();
    if (user) initializeUserStats(user?.id as string)
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user]);

  const onChar = useCallback((char: string) => {
    if (isGameOver) return;
    setCurrentGuess(prev => (prev.length < config.length ? prev + char : prev));
  }, [config.length, isGameOver]);

  const onDelete = useCallback(() => {
    if (isGameOver) return;
    setCurrentGuess(prev => prev.slice(0, -1));
  }, [isGameOver]);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const onEnter = useCallback(async () => {
    if (isGameOver || currentGuess.length !== config.length) return;

    const upperGuess = currentGuess.toUpperCase();
    const { valid } = getWordLists(config.length);

    if (!valid.has(upperGuess)) {
      triggerToast("Not in word list.");
      return;
    }

    // 1. Calculate the new state locally first
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
    let message = ""

    message = (won ? getWinMessage(newGuesses.length) : lost ? getLossMessage() : "")
    const payload = { date, guesses: newGuesses, letterStatuses: newStatuses, status: newStatus, usedHint, hintRecord, config, gameMessage: message };

    /*
    save locally for today first
    */
    localStorage.setItem(`wordle-${date}`, JSON.stringify(payload));

    if (user) {
      setSyncStatus('syncing');
      try {
        const { success } = await syncWithRetry(user.id, date, payload);
        if (success) {
          setSyncStatus('synced');
          // Reset to idle or stay 'synced' for a few seconds
          setTimeout(() => setSyncStatus('idle'), 500);
        }
        else {
          setSyncStatus('error');
        };
      } catch (error) {
        console.log(error)
        setSyncStatus('error');
        triggerToast("Connection lost. Retrying in background...", 5000);

      }
    }


    if (won || lost) {
      setIsGameOver(true);
      setIsGameOverModal(true);
      updateStats(won, newGuesses.length);
      await refresh();

      setTimeout(() => {
        setGameMessage(message)
        triggerToast(message || gameMessage, 8500)
      }, 500);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver, currentGuess, config, guesses, letterStatuses, date, usedHint, hintRecord, user]);

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


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Syncing with server...</div>;
  }

  return (
    <main className="h-svh flex flex-col bg-dark text-white overflow-hidden p-2 sm:p-4">

      <Toast
        isVisible={toast.show}
        message={toast.message}
        duration={toast.duration}
        onClose={() => setToast({ ...toast, show: false })}
      />
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <StatsModal isOpen={isStatsOpen} stats={stats} onClose={() => setIsStatsOpen(false)} user={user} />
      <CloudSyncMenu status={syncStatus} />
      <div className="flex flex-col gap-2 w-full max-w-lg mx-auto pb-1 border-b border-gray-800">


        {/* Row 2: User Stats, Hints, and Info */}
        <div className="flex items-center justify-between bg-custom py-2 px-2 rounded-xl border border-gray-800/50">
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] text-gray-100 tracking-tighter uppercase">Wordle Variant<span className="text-correct">.</span></h2>

          </div>
          <div className="flex items-center gap-2 me-2">
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
            <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-400 border border-gray-700 me-1">
              {config.length}L
            </span>

            <div className="flex items-center gap-1">
              {/* <DatePicker currentDate={date} onDateChange={handleDateChange} /> */}
              <button
                onClick={() => window.location.reload()}
                className="p-2 hover:bg-gray-800 rounded-full transition-all text-gray-500 hover:text-white active:rotate-180 duration-500"
                title="Refresh Game"
              >
                <RotateCcw size={16} />
              </button>
            </div>

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
        <GameOverModal
          isOpen={isGameOverModal}
          onClose={() => setIsGameOverModal(false)}
          guesses={guesses}
          date={date as string}
          config={config}
          usedHint={usedHint}
          gameMessage={gameMessage}
          word={config.word} stats={stats} />
      )}
    </main>
  );
}