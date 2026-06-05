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
import { TransitionLoader } from "./components/layout/TransitionLoader";
import { NotificationsManager } from "./components/notifications/NotificationsManager";
import { Toast } from "./components/Toast";
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
import { safeLazy } from "./utils/safeLazy";
import { safeLocalStorage, safeSessionStorage } from "./utils/storage";

const ChatRoom = safeLazy(() => import("./components/chatRoom"));

export default function App() {
  const { user } = useAuth();
  const {
    toast,
    setToast,
    triggerToast,
    date,
    isLoadingDate,
    unreadCount,
    setUnreadCount,
    isChallengeOpen,
    setIsChallengeOpen,
    isChatOpen,
    setIsChatOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    setChallengeUnreadCount,
    challengeUnreadCount,
    realtimeStatus,
  } = useApp();

  // Core Game Engine
  const { state, actions, config, isHydrated } = useGameEngine(date as string);

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

    if (item === "chat") {
      setUnreadCount(0);
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
    <div className="h-svh flex flex-col text-white font-sans overflow-hidden">
      <LandscapeBlocker />
      <DynamicIslandStatus />
      <AudioConnectionLog />
      <GlobalAudioPlayer />
      <NotificationsManager />
      {user && realtimeStatus === "disconnected" && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 bg-amber-950/90 backdrop-blur-md border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <p className="text-[10px] uppercase font-black tracking-wide text-amber-200">
              Live sync disconnected
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => supabase.realtime.connect()}
                className="bg-amber-500 hover:bg-amber-600 text-black px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Reconnect
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        {!isChatOpen ? (
          <main className="h-full flex flex-col bg-dark text-white p-2 sm:p-4 pt-12 sm:pt-4">
            <Toast
              isVisible={toast.show}
              message={toast.message}
              duration={toast.duration}
              onClose={() => setToast({ ...toast, show: false })}
            />

            <AppHeader
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenWeeklyWrapped={() => setIsWeeklyWrappedOpen(true)}
              onHint={actions.handleHint}
              onReset={() => window.location.reload()}
              onShare={() => actions.setGameOverModalOpen(true)}
              onRetrySync={actions.retrySync}
              isGameOver={state.isGameOver}
              usedHint={state.usedHint}
              canShowHint={state.guesses.length >= 2}
              isHintLocked={
                (state.guesses.length >= config.maxAttempts - 1 ||
                  state.isHintDisabled) &&
                !state.usedHint
              }
              syncStatus={state.syncStatus}
              isMonday={isMonday}

            />



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
            <ModalsManager
              modals={{
                isSettingsOpen,
                isInfoOpen,
                isStatsOpen,
                isChallengeOpen,
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
          </main>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-2 bg-dark">
            <Suspense fallback={<ChatSkeleton />}>
              <ChatRoom user={user as AppUser} onClose={() => setIsChatOpen(false)} />
            </Suspense>
          </div>
        )}
      </div>

      <AppNavigation
        activeItem={activeNavigationItem}
        onNavigate={handleNavigation}
        challengeUnreadCount={challengeUnreadCount}
        chatUnreadCount={isChatOpen ? 0 : unreadCount}
      />

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
    </div>
  );
}
