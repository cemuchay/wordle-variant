/* eslint-disable @typescript-eslint/no-unused-vars */
import { BarChart2, HelpCircle, Lightbulb, MessageSquare, RotateCcw, X, SettingsIcon, Share, Trophy, Clock } from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { GameOverModal } from './components/GameOverModal';
import { Grid } from './components/Grid';
import { InfoModal } from './components/InfoModal';
import { Keyboard } from './components/Keyboard';
import { StatsModal } from './components/StatsModal';
import { Toast } from './components/Toast';
import { getWordLists, } from './data/words';
import { useAuth } from './hooks/useAuth';
import { calculateSkillIndex, checkGuess, fetchAndSyncCloudStats, getDailyConfig, getHint, getLetterStatuses, syncGameState, syncStatsFromLocalStorage, syncWithRetry, updateStats } from './lib/gameLogic';
import { getLossMessage, getWinMessage } from './lib/messages';
import { supabase } from './lib/supabaseClient';
import type { AppUser, GuessResult, LetterStatus } from './types/game';
import { CloudSyncMenu } from './components/SyncCloudModal';
import { useWordleStats } from './hooks/useStats';
// import { useRegisterSW } from 'virtual:pwa-register/react';
import ChatRoom from './components/chatRoom';
// import PWAInstallBanner from './components/PWAInstallBanner';
// import { NotificationToggle } from './components/NotificationToggle';
// import ReloadPrompt from './components/ReloadPrompt';
import { SettingsModal } from './components/SettingsModal';
import { useApp } from './context/AppContext';
import { ChallengeModal } from './components/ChallengeModal';
import { useChallenge, type Challenge, type ChallengeParticipant } from './hooks/useChallenge';
import { useChat } from './hooks/useChat';
import { motion } from 'framer-motion';

const APP_VERSION = "1.0.4";

const getSavedState = (date: string) => {
  const saved = localStorage.getItem(`wordle-${date}`);
  return saved ? JSON.parse(saved) : null;
};

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { toast, triggerToast, setToast, preferences, unreadCount, setUnreadCount, date, isLoadingDate } = useApp();
  const [isGameOver, setIsGameOver] = useState(false);

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
  useEffect(() => {
    checkVersionAndRefresh();
  }, []);

  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const ICON_SIZE = 16;

  // Initialize the hook
  const { stats, refresh, updateOptimistically } = useWordleStats(user, isStatsOpen, date);
  const { sendMessage } = useChat(user?.id || "");

  const handleChallengeCreated = (challenge: Challenge, invitedUsernames: string[]) => {
    const mentions = invitedUsernames.map(name => `@${name}`).join(' ');
    const message = `${mentions} I challenge you to a ${challenge.mode} ${challenge.word_length}-letter Wordle! 🏆 \n\n Join here: ${window.location.origin}${window.location.pathname}?challenge=${challenge.id}`;

    sendMessage(message, undefined, invitedUsernames);
    triggerToast(`Challenge created and shared in chat!`, 3000);
  };

  // --- Challenge System ---
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('challenge');
  });
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [activeParticipation, setActiveParticipation] = useState<ChallengeParticipant | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { submitChallengeResult, startChallenge } = useChallenge(user);
  const timerRef = useRef<number | null>(null);
  const [guesses, setGuesses] = useState<GuessResult[][]>([]);
  const [letterStatuses, setLetterStatuses] = useState<Record<string, LetterStatus>>({});
  const [currentGuess, setCurrentGuess] = useState("");

  const handleTimeExpired = useCallback(async () => {
    if (activeParticipation && !isGameOver) {
      setIsGameOver(true);
      triggerToast("Time's up!", 3000);
      await submitChallengeResult(activeParticipation.id, {
        status: 'timed_out',
        score: 0,
        attempts: guesses.length,
        guesses: guesses
      });
      setIsChallengeModalOpen(true); // Show leaderboard
    }
  }, [activeParticipation, isGameOver, guesses, submitChallengeResult, triggerToast]);

  const handleStartChallenge = useCallback(async (challenge: Challenge, participation: ChallengeParticipant) => {
    setActiveChallenge(challenge);
    setActiveParticipation(participation);
    setIsChallengeModalOpen(false);

    // If it was already completed, we just show the results (handled by isGameOver check later)
    if (participation.status === 'pending') {
      await startChallenge(participation.id);
    }

    // Set up timer for LIVE mode
    if (challenge.mode === 'LIVE' && challenge.max_time) {
      const startedAt = participation.started_at ? new Date(participation.started_at).getTime() : Date.now();
      const endTime = startedAt + challenge.max_time * 60 * 1000;
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    }

    // Load participation guesses if any
    if (participation.guesses && participation.guesses.length > 0) {
      setGuesses(participation.guesses);
      setLetterStatuses(getLetterStatuses(participation.guesses));
      if (participation.status === 'completed' || participation.status === 'timed_out') {
        setIsGameOver(true);
      }
    } else {
      setGuesses([]);
      setLetterStatuses({});
      setIsGameOver(false);
    }
    setCurrentGuess("");
  }, [startChallenge]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isGameOver) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isGameOver]);

  const [isGameOverModal, setIsGameOverModal] = useState(false)
  const [usedHint, setUsedHint] = useState(false);
  const [hintRecord, setHintRecord] = useState<{ letter: string, index: number, row?: number } | null>(null);
  const [gameMessage, setGameMessage] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Handles automatic updates of the app

  // useRegisterSW({ onRegistered: (r: any) => console.log('SW Registered', r) });

  const config = activeChallenge ? {
    word: activeChallenge.target_word,
    length: activeChallenge.word_length as 3 | 4 | 5 | 6 | 7,
    maxAttempts: 6
  } : getDailyConfig(date as string);

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

    if (activeChallenge && activeParticipation) {
      if (won || lost) {
        setIsGameOver(true);
        const skillScore = calculateSkillIndex(newGuesses.length, 6, false, newGuesses);
        await submitChallengeResult(activeParticipation.id, {
          status: 'completed',
          score: skillScore,
          attempts: newGuesses.length,
          guesses: newGuesses
        });
        setIsChallengeModalOpen(true);
      }
      return;
    }

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


  if (isLoadingDate) {
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

          <ChallengeModal
            isOpen={isChallengeModalOpen}
            onClose={() => setIsChallengeModalOpen(false)}
            user={user}
            onStartChallenge={handleStartChallenge}
            onChallengeCreated={handleChallengeCreated}
            initialChallengeId={new URLSearchParams(window.location.search).get('challenge')}
          />
          <CloudSyncMenu status={syncStatus} />

          <div className="w-full max-w-lg mx-auto flex flex-col gap-3 mb-4">
            {/* Top Row: Brand & User Profile */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-correct/10 px-3 py-1 rounded-full border border-correct/20">
                  <h1 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                    Wordle Variant<span className="text-correct">.</span>
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-2 bg-white/5 pl-1 pr-3 py-1 rounded-full border border-white/10 group relative">
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-6 h-6 rounded-full border border-white/10"
                    />
                    <span className="text-[10px] font-black uppercase text-gray-400">
                      {user.user_metadata.full_name?.split(' ')[0]}
                    </span>
                    <button
                      onClick={signOut}
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-[9px] font-black px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
                    >
                      LOGOUT
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="text-[10px] font-black bg-white text-black px-4 py-1.5 rounded-full uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Login
                  </button>
                )}

                <button onClick={() => setIsSettingsOpen(true)} className="text-gray-500 hover:text-white transition-colors">
                  <SettingsIcon size={18} />
                </button>
              </div>
            </div>

            {/* Bottom Row: Game Actions */}
            <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsChallengeModalOpen(true)}
                  className={`p-2 rounded-xl transition-all ${activeChallenge ? 'bg-correct text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                  title="Challenges"
                >
                  <Trophy size={ICON_SIZE} />
                </button>
                <button
                  onClick={() => setIsStatsOpen(true)}
                  className="p-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                  title="Statistics"
                >
                  <BarChart2 size={ICON_SIZE} />
                </button>
                <button
                  onClick={() => setIsInfoOpen(true)}
                  className="p-2 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                  title="How to play"
                >
                  <HelpCircle size={ICON_SIZE} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {timeLeft !== null && (
                  <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
                    <Clock size={14} className="text-red-500 animate-pulse" />
                    <span className="text-xs font-black text-red-500 tabular-nums">
                      {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                  {guesses.length >= 3 && !isGameOver && (
                    <button
                      onClick={handleHint}
                      className={`p-2 transition-all rounded-xl ${usedHint ? 'text-yellow-500/30' : 'text-yellow-500 bg-yellow-500/10 animate-pulse'}`}
                      title={usedHint ? "Hint Used" : "Get Hint"}
                    >
                      <Lightbulb size={ICON_SIZE} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (activeChallenge) {
                        setActiveChallenge(null);
                        setActiveParticipation(null);
                        setTimeLeft(null);
                        window.location.replace(window.location.pathname);
                      } else {
                        window.location.reload();
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition-all active:rotate-180 duration-500"
                    title="Reset"
                  >
                    <RotateCcw size={ICON_SIZE} />
                  </button>
                  {isGameOver && (
                    <button
                      onClick={() => setIsGameOverModal(true)}
                      className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                    >
                      <Share size={ICON_SIZE} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Grid Area - This will now shrink or grow to fit available space */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 gap-4">
            {activeChallenge && (
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-correct">Challenge Active</span>
                <h2 className="text-lg font-black uppercase tracking-tighter text-white">
                  vs {activeChallenge.creator_profile?.username || 'Opponent'}
                </h2>
              </motion.div>
            )}

            <div className="scale-[0.85] sm:scale-100 transition-transform origin-center">
              {
                guesses.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <p className="text-[14px] text-gray-400 tracking-tighter">Enter any {config.length} letter word ...</p>
                  </div>
                ) : null
              }

              <Grid
                wordLength={config.length}
                maxAttempts={config.maxAttempts}
                guesses={guesses}
                currentGuess={currentGuess}
                hintRecord={hintRecord}
                isChallengeMode={!!activeChallenge}
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