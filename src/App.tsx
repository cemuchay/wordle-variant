import { Suspense, useEffect, useMemo, useState } from "react";
import { AdminPage } from "./components/admin/AdminPage";
import { AudioConnectionLog } from "./components/challenge/AudioConnectionLog";
import { ChatSkeleton } from "./components/common/Skeletons";
import { DynamicIslandStatus } from "./components/DynamicIslandStatus";
import { GlobalAudioPlayer } from "./components/GlobalAudioPlayer";
import { LandscapeBlocker } from "./components/LandscapeBlocker";
import { AppHeader } from "./components/layout/AppHeader";
import { AppNavigation } from "./components/layout/AppNavigation";
import { GameArea } from "./components/layout/GameArea";
import { ModalsManager } from "./components/layout/ModalsManager";
import { ImageModal } from "./components/common/ImageModal";
import { TransitionLoader } from "./components/layout/TransitionLoader";
import { NotificationsManager } from "./components/notifications/NotificationsManager";
import { UnsubscribePage } from "./components/UnsubscribePage";
import { WeeklyWrappedModal } from "./components/WeeklyWrappedModal";
import { useApp } from "./context/AppContext";
import { useDiscoverChallenges, useMyChallenges } from "./hooks/queries/useChallengeQueries";
import { useAuth } from "./hooks/useAuth";
import { useGameEngine } from "./hooks/useGameEngine";
import { useKeyboard } from "./hooks/useKeyboard";
import { useWordleStats } from "./hooks/useStats";
import { supabase } from "./lib/supabaseClient";
import { type AppUser, type Challenge } from "./types/game";
import { useChallengeStore } from "./store/useChallengeStore";
import { safeLazy } from "./utils/safeLazy";
import { safeLocalStorage, safeSessionStorage } from "./utils/storage";
import { motion, AnimatePresence } from "framer-motion";

const ChatRoom = safeLazy(() => import("./components/chatRoom"));
const StatsModal = safeLazy(() => import("./components/StatsModal").then(m => ({ default: m.StatsModal })));
const ChallengeModal = safeLazy(() => import("./components/ChallengeModal").then(m => ({ default: m.ChallengeModal })));
const InfoModal = safeLazy(() => import("./components/InfoModal").then(m => ({ default: m.InfoModal })));

const fadeVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

export default function App() {
  const { user } = useAuth();
  const isPlayingChallenge = useChallengeStore((s) => s.isPlaying);
  const {
    triggerToast,
    date,
    isLoadingDate,
    unreadCount,
    isChallengeOpen,
    setIsChallengeOpen,
    isChatOpen,
          isChatConversationOpen,
          setIsChatOpen,
          isNotificationsOpen,
          setIsNotificationsOpen,
    setChallengeUnreadCount,
    challengeUnreadCount,
    realtimeStatus,
  } = useApp();

  // Core Game Engine
  const { state, actions, config, isHydrated } = useGameEngine(date as string);

  // Stabilize UI state to wait for reveal animations
  const [stableGuessesCount, setStableGuessesCount] = useState(state.guesses.length);
  const [stableIsHintDisabled, setStableIsHintDisabled] = useState(state.isHintDisabled);

  useEffect(() => {
    if (!state.isRevealing) {
      setStableGuessesCount(state.guesses.length);
      setStableIsHintDisabled(state.isHintDisabled);
    }
  }, [state.guesses.length, state.isRevealing, state.isHintDisabled]);

  // Initial Challenges Fetch using TanStack Query
  const { data: myChallenges } = useMyChallenges(user?.id);
  const { data: discoverChallenges } = useDiscoverChallenges();

  const activeDailyMarathon = useMemo(() => {
    if (!discoverChallenges) return null;
    return discoverChallenges.find((c: { is_bot_marathon: boolean; expires_at: string; id: string }) => c.is_bot_marathon && new Date(c.expires_at) > new Date());
  }, [discoverChallenges]);

  const isMonday = useMemo(() => {
    if (!date) return false;
    const parts = (date as string).split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getDay() === 1;
  }, [date]);

  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);

  useEffect(() => {
    if (myChallenges) {
      const count = myChallenges.filter(
        (c: Challenge) =>
          (c.status === "pending" || c.status === "playing") &&
          new Date(c.challenge.expires_at) > new Date(),
      ).length;
      setChallengeUnreadCount(count);
    }
  }, [myChallenges, setChallengeUnreadCount]);

  // UI State
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [statsActiveTab, setStatsActiveTab] = useState<"stats" | "leaderboard">(
    "leaderboard",
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
  const [isWeeklyWrappedOpen, setIsWeeklyWrappedOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [navLoading] = useState<{ active: boolean; message: string }>({
    active: false,
    message: "",
  });

  // Preload ChatRoom in the background when the app is idle
  useEffect(() => {
    const preloadChat = () => {
      ChatRoom.preload?.();
    };

    if ("requestIdleCallback" in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).requestIdleCallback(preloadChat);
    } else {
      const timer = setTimeout(preloadChat, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-trigger weekly wrapped on Monday logins
  useEffect(() => {
    if (!user || !date) return;

    // Use universal app/server time
    const parts = (date as string).split("-").map(Number);
    const now = new Date(parts[0], parts[1] - 1, parts[2]);

    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday

    if (currentDay === 1) {
      // Current Monday's date string is the universal app/server date
      const mondayStr = date as string;

      const seenKey = `wrapped-seen-${mondayStr}-${user.id}`;
      const alreadySeen = safeLocalStorage.getItem(seenKey);

      if (!alreadySeen) {
        const timer = setTimeout(() => {
          setIsWeeklyWrappedOpen(true);
        }, 0);
        safeLocalStorage.setItem(seenKey, "true");
        return () => clearTimeout(timer);
      }
    }
  }, [user, date]);

  // Mascot Greeting on app open
  useEffect(() => {
    if (!date || isLoadingDate || !isHydrated) return;

    const now = new Date();
    const hour = now.getHours();
    let greeting = "Hello!";
    let face = "(•‿•)";

    if (hour >= 5 && hour < 12) {
      greeting = "Good morning! ☀️";
    } else if (hour >= 12 && hour < 17) {
      greeting = "Good afternoon! 🌤️";
    } else if (hour >= 17 && hour < 21) {
      greeting = "Good evening! 🌙";
    } else {
      greeting = "Good night! ✨";
      face = "(★‿★)";
    }

    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mascot-changed', {
        detail: { 
          mascotFace: face, 
          mascotLabel: greeting, 
          animationClass: "animate-in slide-in-from-top-2 duration-500" 
        }
      }));
    }, 2000);

    return () => clearTimeout(timer);
  }, [date, isLoadingDate, isHydrated]);

  // Listen to custom event to open stats modal at a specific tab
  useEffect(() => {
    const handleOpenStats = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.tab) {
        setStatsActiveTab(detail.tab);
      } else {
        setStatsActiveTab("leaderboard");
      }
      setIsStatsOpen(true);
    };
    window.addEventListener("open-stats-modal", handleOpenStats);
    return () =>
      window.removeEventListener("open-stats-modal", handleOpenStats);
  }, []);

  // Listen to custom event to open auth modal
  useEffect(() => {
    const handleOpenAuth = () => setIsAuthOpen(true);
    window.addEventListener("open-auth-modal", handleOpenAuth);
    return () => window.removeEventListener("open-auth-modal", handleOpenAuth);
  }, []);

  // Re-open challenge modal after successful login/signup if initiated from the challenge screen
  useEffect(() => {
    if (user) {
      const redirectTarget = safeSessionStorage.getItem("auth_redirect_target");
      if (redirectTarget === "challenge") {
        safeSessionStorage.removeItem("auth_redirect_target");
        setIsChallengeOpen(true);
      }
    }
  }, [user, setIsChallengeOpen]);

  // Listen to custom event to open user profile modal
  useEffect(() => {
    const handleOpenProfile = (e: Event) => {
      if (!user) {
        triggerToast("Please log in to view user profiles.", 4000);
        setIsAuthOpen(true);
        return;
      }
      const detail = (e as CustomEvent)?.detail;
      if (detail?.userId) {
        setViewedProfileId(detail.userId);
      }
    };
    window.addEventListener("open-user-profile", handleOpenProfile);
    return () =>
      window.removeEventListener("open-user-profile", handleOpenProfile);
  }, [user, triggerToast]);

  // Intercept notifications open
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowNotifications(isNotificationsOpen);
  }, [isNotificationsOpen]);

  // Stats Logic
  const { stats } = useWordleStats(user, isStatsOpen, date as string);

  // Keyboard Input
  useKeyboard(
    actions,
    isChatOpen ||
    !isHydrated ||
    isChallengeOpen ||
    isStatsOpen ||
    isSettingsOpen ||
    isInfoOpen ||
    isNotificationsOpen ||
    isAuthOpen ||
    !!viewedProfileId,
  );

  const handleChallengeCreated = () => {
    triggerToast(`Challenge created successfully`, 3000);
  };

  // Delayed realtime disconnected warning & reconnect feedback
  const [showDisconnectedUI, setShowDisconnectedUI] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState<"idle" | "attempting" | "failed">("idle");

  useEffect(() => {
    if (realtimeStatus === "connected") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowDisconnectedUI(false);
      setReconnectStatus("idle");
      return;
    }

    let warningTimerId: number;

    const handleAttemptReconnect = () => {
      // Background reconnection attempt
      supabase.realtime.connect();

      // Start/restart grace period timer
      if (warningTimerId) clearTimeout(warningTimerId);
      warningTimerId = setTimeout(() => {
        if (realtimeStatus === "disconnected") {
          setShowDisconnectedUI(true);
        }
      }, 5000); // 5 seconds grace period
    };

    // Trigger attempt on mount/status change to disconnected
    handleAttemptReconnect();

    // Re-attempt on window focus
    const handleFocus = () => {
      handleAttemptReconnect();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      clearTimeout(warningTimerId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [realtimeStatus]);

  const handleManualReconnect = () => {
    setReconnectStatus("attempting");
    supabase.realtime.connect();

    setTimeout(() => {
      if (realtimeStatus === "disconnected") {
        setReconnectStatus("failed");
      } else {
        setReconnectStatus("idle");
      }
    }, 4000);
  };

  const isPageAdmin = window.location.pathname === "/admin";

  if (isPageAdmin) {
    return <AdminPage />;
  }

  const isPageUnsubscribe = window.location.pathname === "/unsubscribe";

  if (isPageUnsubscribe) {
    return <UnsubscribePage />;
  }

  const activeNavigationItem = isChatOpen
    ? "chat"
    : isChallengeOpen
      ? "challenges"
      : isStatsOpen
        ? "leaderboard"
        : isInfoOpen
          ? "info"
          : "play";



  const handleNavigation = (
    item: "play" | "chat" | "leaderboard" | "challenges" | "info",
  ) => {
    if (item === activeNavigationItem) return;

    if (item === "chat" && !user) {
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }

    setIsChatOpen(item === "chat");
    setIsChallengeOpen(item === "challenges");
    setIsStatsOpen(item === "leaderboard");
    setIsInfoOpen(item === "info");
    if (item === "leaderboard") {
      setStatsActiveTab("leaderboard");
    }
  };


  if (isLoadingDate || !isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white font-black uppercase tracking-widest animate-pulse">
        loading game ...
      </div>
    );
  }

  return (
    <div className="h-svh flex flex-col text-white font-sans overflow-hidden bg-dark">
      <LandscapeBlocker />
      <DynamicIslandStatus />
      <AudioConnectionLog />
      <GlobalAudioPlayer />
      <NotificationsManager />
      {/* Toast component has been migrated to DynamicIslandStatus */}
      {user && showDisconnectedUI && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 bg-amber-950/90 backdrop-blur-md border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-xl">
            <span className={`w-2 h-2 rounded-full ${reconnectStatus === "failed" ? "bg-red-500 animate-pulse" : "bg-amber-500 animate-ping"}`} />
            <p className="text-[10px] uppercase font-black tracking-wide text-amber-200">
              {reconnectStatus === "attempting"
                ? "Attempting to reconnect..."
                : reconnectStatus === "failed"
                  ? "Live sync failed. Please refresh."
                  : "Live sync disconnected"}
            </p>
            <div className="flex items-center gap-2">
              {reconnectStatus !== "attempting" && reconnectStatus !== "failed" && (
                <button
                  onClick={handleManualReconnect}
                  className="bg-amber-500 hover:bg-amber-600 text-black px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Reconnect
                </button>
              )}
              {reconnectStatus === "failed" && (
                <button
                  onClick={handleManualReconnect}
                  className="bg-amber-500/50 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${reconnectStatus === "failed"
                  ? "bg-amber-500 hover:bg-amber-600 text-black animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Persistent Header */}
      {!isPlayingChallenge && !isChatConversationOpen && (
        <div className="w-full px-4 pt-4 pb-1 shrink-0 z-10">
          <AppHeader
            hideGameplayActions={activeNavigationItem !== "play"}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenWeeklyWrapped={() => setIsWeeklyWrappedOpen(true)}
            onHint={actions.handleHint}
            onReset={() => window.location.reload()}
            onShare={() => actions.setGameOverModalOpen(true)}
            onRetrySync={actions.retrySync}
            isGameOver={state.isGameOver}
            isRevealing={state.isRevealing}
            usedHint={state.usedHint}
            canShowHint={stableGuessesCount >= 2}
            isHintLocked={
              (stableGuessesCount >= config.maxAttempts - 1 ||
                stableIsHintDisabled) &&
              !state.usedHint
            }
            syncStatus={state.syncStatus}
            isMonday={isMonday}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeNavigationItem}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: 0.08,
              ease: "linear",
            }}
            className="h-full w-full"
          >
            {activeNavigationItem === "play" && (
              <main className="h-full flex flex-col bg-dark text-white p-2 sm:p-4">
                <GameArea
                  wordLength={config.length}
                  maxAttempts={config.maxAttempts}
                  guesses={state.guesses}
                  currentGuess={state.currentGuess}
                  letterStatuses={state.letterStatuses}
                  hintRecord={state.hintRecord}
                  isGameOver={state.isGameOver}
                  isShake={state.isShake}
                  isSaving={state.syncStatus === "syncing"}
                  onChar={actions.onChar}
                  onDelete={actions.onDelete}
                  onEnter={actions.onEnter}
                  activeDailyMarathon={activeDailyMarathon}
                  setSelectedChallengeId={setSelectedChallengeId}
                  setIsChallengeOpen={setIsChallengeOpen}
                  isAuthenticated={user ? true : false}
                />
              </main>
            )}

            {activeNavigationItem === "chat" && (
              <div className="h-full flex flex-col items-center justify-center p-2 bg-dark">
                <Suspense fallback={<ChatSkeleton />}>
                  <ChatRoom user={user as AppUser} onClose={() => setIsChatOpen(false)} />
                </Suspense>
              </div>
            )}

            {activeNavigationItem === "leaderboard" && (
              <div className="h-full flex flex-col items-center justify-center p-2 bg-dark">
                <Suspense fallback={null}>
                  <StatsModal
                    isOpen={true}
                    inline={true}
                    stats={stats}
                    onClose={() => setIsStatsOpen(false)}
                    user={user as AppUser}
                    isGameOver={state.isGameOver}
                    initialTab={statsActiveTab}
                  />
                </Suspense>
              </div>
            )}

            {activeNavigationItem === "challenges" && (
              <div className="h-full flex flex-col items-center justify-center p-2 bg-dark">
                <Suspense fallback={null}>
                  <ChallengeModal
                    isOpen={true}
                    inline={true}
                    onClose={() => setIsChallengeOpen(false)}
                    user={user as AppUser}
                    onChallengeCreated={handleChallengeCreated}
                    initialChallengeId={selectedChallengeId || new URLSearchParams(window.location.search).get('challenge')}
                  />
                </Suspense>
              </div>
            )}

            {activeNavigationItem === "info" && (
              <div className="h-full flex flex-col items-center justify-center p-2 bg-dark">
                <Suspense fallback={null}>
                  <InfoModal
                    isOpen={true}
                    inline={true}
                    onClose={() => setIsInfoOpen(false)}
                  />
                </Suspense>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ModalsManager
        modals={{
          isSettingsOpen,
          isInfoOpen: false,
          isStatsOpen: false,
          isChallengeOpen: false,
          isNotificationsOpen: showNotifications,
          isAuthOpen,
          isGameOverOpen: state.isGameOverModalOpen,
        }}
        actions={{
          setSettingsOpen: setIsSettingsOpen,
          setInfoOpen: setIsInfoOpen,
          setStatsOpen: setIsStatsOpen,
          setChallengeOpen: (open) => {
            setIsChallengeOpen(open);
            if (!open) {
              setSelectedChallengeId(null);
            }
          },
          setNotificationsOpen: setIsNotificationsOpen,
          setAuthOpen: setIsAuthOpen,
          setGameOverOpen: actions.setGameOverModalOpen,
        }}
        gameContext={{
          user: user as AppUser,
          date: date as string,
          guesses: state.guesses,
          config,
          usedHint: state.usedHint,
          gameMessage: state.gameMessage,
          stats,
          isGameOver: state.isGameOver,
          isGameOverOpen: state.isGameOverModalOpen,
        }}
        statsActiveTab={statsActiveTab}
        onChallengeCreated={handleChallengeCreated}
        viewedProfileId={viewedProfileId}
        setViewedProfileId={setViewedProfileId}
        initialChallengeId={selectedChallengeId}
      />

      {!isPlayingChallenge && !isChatConversationOpen && (
        <AppNavigation
          activeItem={activeNavigationItem}
          onNavigate={handleNavigation}
          challengeUnreadCount={challengeUnreadCount}
          chatUnreadCount={isChatOpen ? 0 : unreadCount}
        />
      )}

      {navLoading.active && <TransitionLoader message={navLoading.message} />}

      {isWeeklyWrappedOpen && user && (
        <WeeklyWrappedModal
          isOpen={isWeeklyWrappedOpen}
          onClose={() => setIsWeeklyWrappedOpen(false)}
          userId={user.id}
          isEasterEgg={false}
          gameDate={date as string}
        />
      )}

      <div className="fixed bottom-2 left-2 hidden sm:flex items-center gap-2 text-[10px] text-gray-600 z-40">
        <a href="/privacy.html" className="hover:underline">
          Privacy Policy
        </a>
        <span>•</span>
        <a href="/tos.html" className="hover:underline">
          Terms of Service
        </a>
        <span>•</span>
        <a href="/deletion.html" className="hover:underline">
          User Data Deletion
        </a>
      </div>

      <ImageModal />
    </div>
  );
}
