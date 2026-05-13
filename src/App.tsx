/* eslint-disable @typescript-eslint/no-unused-vars */
import { BarChart2, HelpCircle, Lightbulb, MessageSquare, RotateCcw, X, SettingsIcon, Share } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GameOverModal } from './components/GameOverModal';
import { Grid } from './components/Grid';
import { InfoModal } from './components/InfoModal';
import { Keyboard } from './components/Keyboard';
import { StatsModal } from './components/StatsModal';
import { Toast } from './components/Toast';
import { getWordLists, } from './data/words';
import { useAuth } from './hooks/useAuth';
import { checkGuess, fetchAndSyncCloudStats, getDailyConfig, getHint, getLetterStatuses, syncGameState, syncStatsFromLocalStorage, syncWithRetry, updateStats } from './lib/gameLogic';
import { getLossMessage, getWinMessage } from './lib/messages';
import { supabase } from './lib/supabaseClient';
import type { AppUser, GuessResult, LetterStatus } from './types/game';
import { getServerDate } from './lib/time';
import { CloudSyncMenu } from './components/SyncCloudModal';
import { useWordleStats } from './hooks/useStats';
// import { useRegisterSW } from 'virtual:pwa-register/react';
import ChatRoom from './components/chatRoom';
// import PWAInstallBanner from './components/PWAInstallBanner';
// import { NotificationToggle } from './components/NotificationToggle';
// import ReloadPrompt from './components/ReloadPrompt';
import { SettingsModal } from './components/SettingsModal';
import { useApp } from './context/AppContext';

const APP_VERSION = "1.0.4";

const getSavedState = (date: string) => {
  const saved = localStorage.getItem(`wordle-${date}`);
  return saved ? JSON.parse(saved) : null;
};

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth();

  async function checkVersionAndRefresh() {
    const lastVersion = localStorage.getItem("app_version");

    // Only execute if the version has changed
    if (lastVersion !== APP_VERSION) {
      console.log(`[Version Control] New version detected: ${APP_VERSION}. Cleaning...`);

      // 1. Kill Service Workers
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Clear Cache API
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      // 3. Update version in storage BEFORE reload to prevent loops
      localStorage.setItem("app_version", APP_VERSION);

      // 4. Force hard reload from server
      // The timestamp ensures we hit the network, not a CDN/ISP cache
      const url = new URL(window.location.href);
      url.searchParams.set("v_update", APP_VERSION);

      window.location.replace(url.toString());

      const STORAGE_KEY = "wordle-2026-05-11";

      const wipeIncompleteToday = () => {
        const rawData = localStorage.getItem(STORAGE_KEY);

        if (!rawData) return;

        try {
          const state = JSON.parse(rawData)

          // Condition: It's today's date AND the status is not terminal (not won or lost)
          if (state.status !== "won" && state.status !== "lost") {
            localStorage.removeItem(STORAGE_KEY);
            console.log("Incomplete state for today wiped. Starting fresh.");

            // Optional: reload to ensure the UI doesn't try to use the old object
            window.location.reload();
          }
        } catch (error) {
          console.error("Error parsing game state for wipe-check:", error);
        }
      };

      wipeIncompleteToday();
    }
  }

  // Execute immediately at the start of your entry file
  checkVersionAndRefresh();

  const [date, setDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const ICON_SIZE = 16;

  // Initialize the hook
  const { stats, refresh, updateOptimistically } = useWordleStats(user, isStatsOpen, date);

  const { toast, triggerToast, setToast, preferences, unreadCount, setUnreadCount } = useApp();


  useEffect(() => {
    const syncTime = async () => {
      try {
        // 1. This returns instantly now (either from cache or optimistic client time)

        const serverDate = await getServerDate();
        setDate(prev => prev !== serverDate.formatted ? serverDate.formatted : prev);
        setIsLoading(false);

      } catch (err) {
        // This will catch the 'throw error' from your background sync if it fails
        console.error("Initialization error:", err);
        // Optional: show a toast or error state here
        triggerToast("Error fetching date from server, refresh page")
      }
    };

    syncTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [guesses, setGuesses] = useState<GuessResult[][]>([]);
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});
  const [currentGuess, setCurrentGuess] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameOverModal, setIsGameOverModal] = useState(false)
  const [usedHint, setUsedHint] = useState(false);
  const [hintRecord, setHintRecord] = useState<{ letter: string, index: number, row?: number } | null>(null);
  const [gameMessage, setGameMessage] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Handles automatic updates of the app

  // useRegisterSW({ onRegistered: (r: any) => console.log('SW Registered', r) });

  const config = getDailyConfig(date as string);

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
        const initialGuesses = local?.guesses || [];
        setGuesses(initialGuesses);
        setLetterStatuses(getLetterStatuses(initialGuesses));
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
          localGameMessage = preferences.allowRoasts ? local?.status === 'won' ? getWinMessage(local?.guesses.length) : getLossMessage() : ""
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

          const newStatuses = getLetterStatuses(cloudGuesses);
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
    const newStatuses = getLetterStatuses(newGuesses);

    const won = upperGuess === config.word;
    const lost = newGuesses.length === config.maxAttempts;
    const newStatus = won ? 'won' : (lost ? 'lost' : 'playing');

    // Update Local UI
    setGuesses(newGuesses);
    setLetterStatuses(newStatuses);
    setCurrentGuess("");
    let message = ""

    message = (preferences.allowRoasts ? won ? getWinMessage(newGuesses.length) : lost ? getLossMessage() : "" : "")
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
        setSyncStatus('error');
        triggerToast("Connection lost. Retrying in background...", 5000);
      }
    }


    if (won || lost) {
      setIsGameOver(true);
      setIsGameOverModal(true);
      const updatedStats = updateStats(won, newGuesses.length);
      updateOptimistically(updatedStats);
      await refresh();

      if (lost) triggerToast(`The word is: ${config.word}`, 5000)

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
    if (guesses.length < 3 || isGameOver) return;

    if (usedHint && hintRecord) {
      triggerToast(`Reminder: "${hintRecord.letter}" is at position ${hintRecord.index + 1}.`, 3000);
      return;
    }

    const hint = getHint(config.word, guesses);
    if (hint) {
      const hintWithRow = { ...hint, row: guesses.length };
      setUsedHint(true);
      setHintRecord(hintWithRow);
      const payload = { date, guesses, letterStatuses, status: 'playing', usedHint: true, hintRecord: hintWithRow, config };
      localStorage.setItem(`wordle-${date}`, JSON.stringify(payload));
      if (user) await syncGameState(user.id, date, payload);
      triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`);
    }
  };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Syncing with server...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {
        isChatOpen ? null : (<main className="h-svh flex flex-col bg-dark text-white overflow-hidden p-2 sm:p-4">

          <Toast
            isVisible={toast.show}
            message={toast.message}
            duration={toast.duration}
            onClose={() => setToast({ ...toast, show: false })}
          />
          {/* The PWA Reload Listener */}
          {/* <ReloadPrompt /> */}
          {
            user && (<>
              {/* <PWAInstallBanner /> */}
              <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}

              /></>)
          }

          <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
          <StatsModal isOpen={isStatsOpen} stats={stats} onClose={() => setIsStatsOpen(false)} user={user} isGameOver={isGameOver} />
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
                      className="w-7 h-7 rounded-full border border-gray-700 cursor-pointer"
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

              {/* <button onClick={enableNotifications}>Remind me of daily words</button> */}

              <div className="flex items-center gap-2">
                {guesses.length >= 3 && !isGameOver && (
                  <button
                    onClick={handleHint}
                    className={`transition-all ${usedHint ? 'text-yellow-500/50' : 'text-yellow-500 animate-pulse'}`}
                    title={usedHint ? "Show Hint Reminder" : "Get a Hint"}
                  >
                    <Lightbulb size={ICON_SIZE} fill={usedHint ? "currentColor" : "currentColor"} />
                  </button>
                )}
                <span className="px-1 rounded bg-gray-800 text-[10px] font-mono text-gray-400 border border-gray-700 me-1">
                  {config.length}L
                </span>

                <div className="flex items-center gap-1">
                  {/* <DatePicker currentDate={date} onDateChange={handleDateChange} /> */}
                  <button
                    onClick={() => window.location.reload()}
                    className="p-1 hover:bg-gray-800 rounded-full transition-all text-gray-500 hover:text-white active:rotate-180 duration-500"
                    title="Refresh Game"
                  >
                    <RotateCcw size={ICON_SIZE} />
                  </button>
                </div>

                <button onClick={() => setIsStatsOpen(true)} className="text-gray-400 hover:text-white p-1">
                  <BarChart2 size={ICON_SIZE} />
                </button>

                <button
                  onClick={() => setIsInfoOpen(true)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <HelpCircle size={ICON_SIZE} />
                </button>
                {
                  isGameOver && (
                    <button
                      onClick={() => setIsGameOverModal(true)}
                      className="text-gray-400 hover:text-white p-1"
                    >
                      <Share size={ICON_SIZE} />
                    </button>
                  )
                }
                {
                  user && (<button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-white p-1">
                    <SettingsIcon size={ICON_SIZE} />
                  </button>)
                }
              </div>
            </div>
          </div>

          {/* Grid Area - This will now shrink or grow to fit available space */}
          <div className="flex-1 flex items-center justify-center min-h-0 w-full px-2">
            <div className="scale-[0.85] sm:scale-100 transition-transform origin-center">
              {
                guesses.length === 0 ? (
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-[14px] text-gray-100 tracking-tighter py-3">enter any {config.length} letter word ...</p>  <button
                      onClick={() => setIsInfoOpen(true)}
                      className="text-white py-1 p-2 text-[12px] rounded-md bg-green-500 hover:text-white cursor-pointer "
                    >
                      Help
                    </button>
                  </div>
                ) : null
              }

              <Grid
                wordLength={config.length}
                maxAttempts={config.maxAttempts}
                guesses={guesses}
                currentGuess={currentGuess}
                hintRecord={hintRecord}
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
              stats={stats} />
          )}
        </main>)
      }

      {/* Chat Trigger - Floating Action Button (FAB) */}
      {
        user && (<div className="fixed z-50 top-24 right-4 sm:top-auto sm:bottom-4 sm:right-26">
          {/* Unread Badge - Positioned relative to this container */}
          {unreadCount > 0 && !isChatOpen && (
            <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 z-60 min-w-4.5 h-4.5 sm:min-w-5.5 sm:h-5.5 px-1 bg-white text-red-400 border-2 border-red-950 text-[9px] sm:text-[13px] font-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-in zoom-in duration-300">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}

          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen)
              setUnreadCount(0)
            }}
            className={`transition-all hover:scale-110 active:scale-95 shadow-2xl rounded-xl sm:rounded-2xl p-3 sm:p-4 
    ${isChatOpen ? 'bg-red-500 text-white' : 'bg-correct text-black'}`}
          >
            <div className={`transition-transform duration-300 ${isChatOpen ? 'rotate-90' : 'rotate-0'}`}>
              {isChatOpen ? (
                <X className="w-4 h-4 sm:w-6 sm:h-6" />
              ) : (
                <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6" />
              )}
            </div>
          </button>
        </div>)
      }


      {/* Chat Side Drawer / Overlay */}
      {isChatOpen && (
        <ChatRoom
          user={user as AppUser}
        />)}

      <a href="/privacy" className="text-[10px] text-gray-600 hover:underline">
        Privacy Policy
      </a>
    </div>
  );
}