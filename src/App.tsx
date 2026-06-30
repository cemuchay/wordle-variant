import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import PWAInstallBanner from "./components/PWAInstallBanner";
import NotificationPermissionPrompt from "./components/NotificationPermissionPrompt";
import FloatingChatBubble from "./components/chat/FloatingChatBubble";
import { NotificationsManager } from "./components/notifications/NotificationsManager";
import { Bell, Swords } from "lucide-react";
import { useLiveStore } from "./wordup/live/store/useLiveStore";
import { useAsyncStore } from "./wordup/async/store/useAsyncStore";
import { subscribeToPush } from "./lib/pushService";
import { UnsubscribePage } from "./components/UnsubscribePage";
import { WeeklyWrappedModal } from "./components/WeeklyWrappedModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { GuestBanner } from "./components/GuestBanner";
import { useApp } from "./context/AppContext";
import { useDiscoverChallenges, useMyChallenges, useBulkChallengeParticipants } from "./hooks/queries/useChallengeQueries";
import { useAuth } from "./hooks/useAuth";
import { useGameEngine } from "./hooks/useGameEngine";
import { useKeyboard } from "./hooks/useKeyboard";
import { useWordleStats } from "./hooks/useStats";
import { supabase } from "./lib/supabaseClient";
import { wordupNetworkGate } from "./components/wordup/WordUpView/services/wordupNetworkGate";
import { type AppUser, type Challenge } from "./types/game";
import { useChallengeStore } from "./store/useChallengeStore";
import { useAppStore } from "./store/useAppStore";
import { safeLazy } from "./utils/safeLazy";
import { safeLocalStorage, safeSessionStorage } from "./utils/storage";
import formatUsername from './utils/formatUsername';
import { motion, AnimatePresence } from "framer-motion";

const ChatRoom = safeLazy(() => import("./components/chatRoom"));
const StatsModal = safeLazy(() => import("./components/StatsModal").then(m => ({ default: m.StatsModal })));
const ChallengeModal = safeLazy(() => import("./components/ChallengeModal").then(m => ({ default: m.ChallengeModal })));
const ModeSelect = safeLazy(() => import("./wordup/mode-select").then(m => ({ default: m.ModeSelect })));
const LiveView = safeLazy(() => import("./wordup/live").then(m => ({ default: m.LiveView })));
const AsyncView = safeLazy(() => import("./wordup/async").then(m => ({ default: m.AsyncView })));

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
  const { user, loading: isAuthLoading } = useAuth();

  const [guestOptedIn, setGuestOptedIn] = useState(() =>
    safeLocalStorage.getItem('wordle_guest_opted_in') === 'true',
  );
  const [guestBannerLastDismissed, setGuestBannerLastDismissed] = useState(() =>
    safeLocalStorage.getItem('wordle_guest_banner_last_dismissed') ?? '',
  );

  const isPlayingChallenge = useChallengeStore((s) => s.isPlaying);
  const selectedChallenge = useChallengeStore((s) => s.selectedChallenge);
  const isBattlePlayingLive = useLiveStore((s) => s.isBattlePlaying);
  const isBattlePlayingAsync = useAsyncStore((s) => s.isBattlePlaying);
  const isBattlePlaying = isBattlePlayingLive || isBattlePlayingAsync;
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
    incomingWordUpInvite,
    setIncomingWordUpInvite,
    incomingAsyncInvite,
    setIncomingAsyncInvite
  } = useApp();

  // Core Game Engine
  const { state, actions, config, isHydrated } = useGameEngine(date as string, user, isAuthLoading);

  // Stabilize UI state to wait for reveal animations
  const [stableGuessesCount, setStableGuessesCount] = useState(state.guesses.length);
  const [stableIsHintDisabled, setStableIsHintDisabled] = useState(state.isHintDisabled);

  useEffect(() => {
    if (!state.isRevealing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStableGuessesCount(state.guesses.length);
      setStableIsHintDisabled(state.isHintDisabled);
    }
  }, [state.guesses.length, state.isRevealing, state.isHintDisabled]);

  // WordUp Async Unread Count
  const [wordupUnreadCount, setWordupUnreadCount] = useState(0);

  const fetchWordupUnreadCount = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("wordup_async_matches")
        .select("id, player1_id, player2_id, p1_answered, p2_answered")
        .in("status", ["pending", "active", "turn_submitted"])
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
      if (error) throw error;
      if (!data) { setWordupUnreadCount(0); return; }
      const count = data.filter((m) => {
        if (m.player1_id === userId && !m.p1_answered) return true;
        if (m.player2_id === userId && !m.p2_answered) return true;
        return false;
      }).length;
      setWordupUnreadCount(count);
    } catch (e) {
      console.error("Failed to fetch wordup unread count:", e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user?.id) { setWordupUnreadCount(0); return; }
    fetchWordupUnreadCount(user.id);
  }, [user?.id, fetchWordupUnreadCount]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`wordup_unread_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wordup_async_matches", filter: `player1_id=eq.${user.id}` }, () => fetchWordupUnreadCount(user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "wordup_async_matches", filter: `player2_id=eq.${user.id}` }, () => fetchWordupUnreadCount(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchWordupUnreadCount]);

  // Initial Challenges Fetch using TanStack Query
  const { data: myChallenges } = useMyChallenges(user?.id);
  const { data: discoverChallenges } = useDiscoverChallenges();

  const botMarathonIds = useMemo(() =>
    (discoverChallenges || [])
      .filter((c: any) => c.is_bot_marathon)
      .map((c: any) => c.id),
  [discoverChallenges]);

  const { data: botMarathonParticipants } = useBulkChallengeParticipants(botMarathonIds);

  const activeDailyMarathons = useMemo(() => {
    if (!discoverChallenges) return [];
    const botMarathons = discoverChallenges
      .filter((c: any) => c.is_bot_marathon && new Date(c.expires_at) > new Date())
      .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
      .slice(0, 2);
    return botMarathons.map((c: any) => ({
      id: `open-${c.id}`,
      challenge_id: c.id,
      challenge: { ...c, participants: botMarathonParticipants?.[c.id] || [] },
      status: 'open',
      score: 0,
      attempts: 0,
      guesses: [],
    }));
  }, [discoverChallenges, botMarathonParticipants]);

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

  // UI State from Global Persisted Store
  const isStatsOpen = useAppStore(s => s.isStatsOpen);
  const setIsStatsOpen = useAppStore(s => s.setStatsOpen);
  const statsActiveTab = useAppStore(s => s.statsActiveTab);
  const setStatsActiveTab = useAppStore(s => s.setStatsActiveTab);

  const isSettingsOpen = useAppStore(s => s.isSettingsOpen);
  const setIsSettingsOpen = useAppStore(s => s.setSettingsOpen);

  const isInfoOpen = useAppStore(s => s.isInfoOpen);
  const setIsInfoOpen = useAppStore(s => s.setInfoOpen);

  const isWordUpOpen = useAppStore(s => s.isWordUpOpen);
  const setIsWordUpOpen = useAppStore(s => s.setWordUpOpen);
  const wordupMode = useAppStore(s => s.wordupMode);
  const setWordupMode = useAppStore(s => s.setWordupMode);

  const isWeeklyWrappedOpen = useAppStore(s => s.isWeeklyWrappedOpen);
  const setIsWeeklyWrappedOpen = useAppStore(s => s.setWeeklyWrappedOpen);

  const showNotifications = useAppStore(s => s.showNotifications);
  const setShowNotifications = useAppStore(s => s.setShowNotifications);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
  const [navLoading] = useState<{ active: boolean; message: string }>({
    active: false,
    message: "",
  });

  // User-gesture push prompt bar
  const [showNotificationBar, setShowNotificationBar] = useState(false);

  useEffect(() => {
    const checkNotificationBar = () => {
      const supported = 'Notification' in window;
      const notGranted = supported && Notification.permission !== 'granted';
      const dismissed = safeLocalStorage.getItem('header_notification_dismissed') === 'true';
      setShowNotificationBar(!!user && notGranted && !dismissed);
    };
    checkNotificationBar();
  }, [user]);

  const handleEnablePush = async () => {
    try {
      const sub = await subscribeToPush();
      if (sub) {
        setShowNotificationBar(false);
      }
    } catch (e) {
      console.warn("Header push enable failed:", e);
    }
  };

  const handleDismissNotificationBar = () => {
    safeLocalStorage.setItem('header_notification_dismissed', 'true');
    setShowNotificationBar(false);
  };

  const handlePlayAsGuest = () => {
    safeLocalStorage.setItem('wordle_guest_opted_in', 'true');
    if (date) {
      safeLocalStorage.setItem('wordle_guest_banner_last_dismissed', date as string);
      setGuestBannerLastDismissed(date as string);
    }
    setGuestOptedIn(true);
  };

  const handleDismissGuestBanner = () => {
    if (date) {
      safeLocalStorage.setItem('wordle_guest_banner_last_dismissed', date as string);
      setGuestBannerLastDismissed(date as string);
    }
  };

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

  // Reset view settings on mount if rememberLastView is false
  useEffect(() => {
    const appState = useAppStore.getState();
    const remember = appState.preferences?.rememberLastView;
    if (!remember) {
      const params = new URLSearchParams(window.location.search);
      const hasChallengeParam = params.has("challenge");
      const hasOpenParam = params.has("open") || params.has("group_id") || params.has("dm_user_id");
      const openVal = params.get("open");

      if (!hasChallengeParam) appState.setChallengeOpen(false);
      appState.setNotificationsOpen(openVal === "notifications");
      appState.setChatOpen(hasOpenParam && (openVal === "chat" || !!params.get("group_id") || !!params.get("dm_user_id")));
      appState.setChatConversationOpen(false);
      appState.setStatsOpen(openVal === "leaderboard");
      appState.setSettingsOpen(false);
      appState.setInfoOpen(false);
      appState.setWordUpOpen(false);
      appState.setWeeklyWrappedOpen(false);
      appState.setShowNotifications(false);
      appState.setPendingDMUserId(null);
      appState.setPendingChatGroupId(null);
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
  }, [user, date, setIsWeeklyWrappedOpen]);

  // Mascot Greeting on app open
  useEffect(() => {
    if (!date || isLoadingDate || !isHydrated) return;

    const now = new Date();
    const hour = now.getHours();
    let greeting = "Hello!";
    let expression: import('./components/wordup/WordUpView/components/WordUpMascot').MascotExpression = 'idle';

    if (hour >= 5 && hour < 12) {
      greeting = "Good morning! ☀️";
    } else if (hour >= 12 && hour < 17) {
      greeting = "Good afternoon! 🌤️";
    } else if (hour >= 17 && hour < 21) {
      greeting = "Good evening! 🌙";
    } else {
      greeting = "Good night! ✨";
      expression = 'happy';
    }

    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mascot-changed', {
        detail: {
          expression,
          label: greeting
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
  }, [setStatsActiveTab, setIsStatsOpen]);

  // Listen to custom event to open auth modal
  useEffect(() => {
    const handleOpenAuth = () => setIsAuthOpen(true);
    window.addEventListener("open-auth-modal", handleOpenAuth);
    return () => window.removeEventListener("open-auth-modal", handleOpenAuth);
  }, []);

  // Handle URL query parameters for notifications routing
  useEffect(() => {
    const parseUrlParams = () => {
      const params = new URLSearchParams(window.location.search);
      const hasChallenge = params.has("challenge");
      const hasOpen = params.has("open") || params.has("group_id") || params.has("dm_user_id");

      if (hasChallenge || hasOpen) {
        // Clear all other view states to let the notification click override persistence
        const appState = useAppStore.getState();
        appState.setChallengeOpen(false);
        appState.setNotificationsOpen(false);
        appState.setChatOpen(false);
        appState.setChatConversationOpen(false);
        appState.setStatsOpen(false);
        appState.setSettingsOpen(false);
        appState.setInfoOpen(false);
        appState.setWordUpOpen(false);
        appState.setWeeklyWrappedOpen(false);
        appState.setShowNotifications(false);
      }

      const challengeId = params.get("challenge");
      if (challengeId) {
        setIsChallengeOpen(true);
        setSelectedChallengeId(challengeId);
      }

      const open = params.get("open");
      const groupId = params.get("group_id");
      const dmUserId = params.get("dm_user_id");

      if (open === "chat" || groupId || dmUserId) {
        setIsChatOpen(true);
        if (groupId) {
          useAppStore.getState().setPendingChatGroupId(groupId);
        }
        if (dmUserId) {
          useAppStore.getState().setPendingDMUserId(dmUserId);
        }
      } else if (open === "leaderboard") {
        setStatsActiveTab("leaderboard");
        setIsStatsOpen(true);
      } else if (open === "notifications") {
        setIsNotificationsOpen(true);
      }
    };

    // Run on initial mount
    parseUrlParams();

    // Listen to browser navigation changes
    window.addEventListener("popstate", parseUrlParams);
    return () => {
      window.removeEventListener("popstate", parseUrlParams);
    };
  }, [setIsChallengeOpen, setIsChatOpen, setIsNotificationsOpen, setIsStatsOpen, setStatsActiveTab]);

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
    setShowNotifications(isNotificationsOpen);
  }, [isNotificationsOpen, setShowNotifications]);

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
    isWordUpOpen ||
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

  const [incomingInviteTimeLeft, setIncomingInviteTimeLeft] = useState(15);
  const [opponentLaterInvite, setOpponentLaterInvite] = useState<{ matchId: string; opponentName: string } | null>(null);

  const handleIncomingInviteLater = async () => {
    const invite = incomingWordUpInvite;
    if (!invite) return;
    setIncomingWordUpInvite(null);
    try {
      // Create match in status "waiting"
      const matches = await wordupNetworkGate.enqueue(
        'post',
        'create pending async match',
        {
          table: 'wordup_matches',
          action: 'insert',
          payload: {
            category: invite.category,
            player1_id: invite.senderId,
            player2_id: user?.id,
            status: "waiting",
            game_type: "async",
            p1_answered: false,
            p2_answered: false
          }
        }
      );

      const newMatch = matches?.[0];
      if (!newMatch) throw new Error("Failed to create match");

      // Generate questions (edge function for procedural, local for legacy)
      const { generateMatchQuestions } = await import("./services/wordup/questionService");
      generateMatchQuestions(newMatch.id, invite.category).catch((e) =>
        console.error("Failed to generate questions for invite:", e)
      );

      // App notification for B (the current user)
      await wordupNetworkGate.enqueue(
        'post',
        'create challenge notification',
        {
          table: 'notifications',
          action: 'insert',
          payload: {
            user_id: user?.id,
            type: "CHALLENGE_INVITE",
            title: "Pending WordUp Battle",
            message: `${invite.senderName} challenged you to a WordUp Battle!`,
            data: { mode: "wordup", matchId: newMatch.id },
            is_read: false
          }
        }
      );

      // Broadcast to player 1 (A)
      const laterChannel = supabase.channel(`user_signals_${invite.senderId}`);
      laterChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          laterChannel.send({
            type: 'broadcast',
            event: 'wordup_invite_later',
            payload: { matchId: newMatch.id, senderName: formatUsername(user?.user_metadata?.username) || user?.email?.split('@')[0] || "Opponent" }
          });
          setTimeout(() => supabase.removeChannel(laterChannel), 1000);
        }
      });
      triggerToast("Challenge saved as pending.", 3000);
    } catch (e) {
      console.error("Failed to save challenge as pending:", e);
    }
  };

  useEffect(() => {
    if (!incomingWordUpInvite) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncomingInviteTimeLeft(15);
    const interval = setInterval(() => {
      setIncomingInviteTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleIncomingInviteLater();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingWordUpInvite]);

  useEffect(() => {
    const handleInviteLater = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        setOpponentLaterInvite({
          matchId: detail.matchId,
          opponentName: detail.senderName
        });
      }
    };
    window.addEventListener("wordup-invite-later", handleInviteLater);
    return () => window.removeEventListener("wordup-invite-later", handleInviteLater);
  }, []);

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
        : isWordUpOpen
          ? "wordup"
          : "play";



  const handleNavigation = (
    item: "play" | "chat" | "leaderboard" | "challenges" | "wordup",
  ) => {
    if (item === activeNavigationItem) return;

    if (item === "chat" && !user) {
      window.dispatchEvent(new CustomEvent("open-auth-modal"));
      return;
    }

    setIsChatOpen(item === "chat");
    setIsChallengeOpen(item === "challenges");
    setIsStatsOpen(item === "leaderboard");
    setIsWordUpOpen(item === "wordup");
    if (item !== "wordup") {
      setWordupMode(null);
    }
    setIsInfoOpen(false);
    if (item === "leaderboard") {
      setStatsActiveTab("leaderboard");
    }
  };


  if (!isHydrated || isLoadingDate || isAuthLoading) {
    return (
      <div className="h-dvh w-full flex flex-col bg-dark text-white p-4 justify-between animate-pulse select-none">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0 px-2 mt-2">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="h-6 w-32 bg-white/10 rounded-lg" />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/10" />
            <div className="w-8 h-8 rounded-lg bg-white/10" />
          </div>
        </div>

        {/* Board Grid Skeleton: a full unified pulsing block about the height of the grid */}
        <div className="flex-1 flex items-center justify-center min-h-0 py-8 w-full px-4">
          <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-5/6 max-h-[350px] sm:max-h-[400px] bg-white/5 border border-white/10 rounded-3xl" />
        </div>

        {/* Keyboard Skeleton */}
        <div className="w-full max-w-lg mx-auto pb-[calc(0.75rem+env(safe-area-inset-bottom,0))] space-y-1.5 shrink-0 px-2">
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-12 flex-1 rounded bg-white/10" />
            ))}
          </div>
          <div className="flex justify-center gap-1.5 px-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-12 flex-1 rounded bg-white/10" />
            ))}
          </div>
          <div className="flex justify-center gap-1.5">
            <div className="h-12 w-14 rounded bg-white/10" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-12 flex-1 rounded bg-white/10" />
            ))}
            <div className="h-12 w-14 rounded bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!user && !guestOptedIn) {
    return (
      <WelcomeScreen
        onPlayAsGuest={handlePlayAsGuest}
        onSignIn={() => window.dispatchEvent(new CustomEvent("open-auth-modal"))}
      />
    );
  }

  return (
    <div className="h-dvh w-full flex flex-col text-white font-sans overflow-hidden bg-dark">
      <LandscapeBlocker />
      <DynamicIslandStatus />
      <AudioConnectionLog />
      <GlobalAudioPlayer />
      <NotificationsManager />
      <FloatingChatBubble />
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

      {!user && guestOptedIn && date && guestBannerLastDismissed !== date && (
        <GuestBanner
          onSignIn={() => window.dispatchEvent(new CustomEvent("open-auth-modal"))}
          onDismiss={handleDismissGuestBanner}
        />
      )}

      {/* Global Persistent Header */}
      {!isPlayingChallenge && !isBattlePlaying && !isChatConversationOpen && !selectedChallenge && (
        <div className="w-full px-4 pt-4 pb-1 shrink-0 z-10">
          <AppHeader
            hideGameplayActions={activeNavigationItem !== "play"}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenSearch={() => setIsSettingsOpen(true)}
            onOpenInfo={() => setIsInfoOpen(true)}
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
              (stableGuessesCount >= (config?.maxAttempts ?? 6) - 1 ||
                stableIsHintDisabled) &&
              !state.usedHint
            }
            syncStatus={state.syncStatus}
            isMonday={isMonday}
          />
          {showNotificationBar && (
            <div className="mt-2 animate-in slide-in-from-top-2 duration-300">
              <div className="bg-slate-900/80 border border-slate-800/60 backdrop-blur-md px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Bell size={13} className="text-indigo-400 shrink-0" />
                  <p className="text-[10px] font-bold tracking-wide text-gray-200 truncate">
                    Enable Push Notifications to receive real-time updates.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleEnablePush}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Enable
                  </button>
                  <button
                    onClick={handleDismissNotificationBar}
                    className="text-gray-500 hover:text-gray-300 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeNavigationItem === "wordup" ? `wordup-${wordupMode || "select"}` : activeNavigationItem}
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
                  wordLength={config?.length ?? 5}
                  maxAttempts={config?.maxAttempts ?? 6}
                  guesses={state.guesses}
                  currentGuess={state.currentGuess}
                  cursorIndex={state.cursorIndex}
                  editIndex={state.editIndex}
                  letterStatuses={state.letterStatuses}
                  hintRecord={state.hintRecord}
                  isGameOver={state.isGameOver}
                  isShake={state.isShake}
                  isSaving={state.syncStatus === "syncing"}
                  onChar={actions.onChar}
                  onDelete={actions.onDelete}
                  onEnter={actions.onEnter}
                  onSetCursor={actions.onSetCursor}
                  onSetEditIndex={actions.onSetEditIndex}
                  activeDailyMarathons={activeDailyMarathons}
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

            {activeNavigationItem === "wordup" && (
              <div className="h-full flex flex-col items-center justify-center p-2 bg-dark">
                <Suspense fallback={null}>
                  {wordupMode === null ? (
                    <ModeSelect onSelect={(mode: "live" | "async") => {
                      setWordupMode(mode);
                    }} />
                  ) : wordupMode === "live" ? (
                    <LiveView onBack={() => setWordupMode(null)} onSwitchMode={setWordupMode} />
                  ) : (
                    <AsyncView onBack={() => setWordupMode(null)} onSwitchMode={setWordupMode} />
                  )}
                </Suspense>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

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

      {!isPlayingChallenge && !isBattlePlaying && !isChatConversationOpen && (
        <AppNavigation
          activeItem={activeNavigationItem}
          onNavigate={handleNavigation}
          challengeUnreadCount={challengeUnreadCount}
          chatUnreadCount={isChatOpen ? 0 : unreadCount}
          wordupUnreadCount={wordupUnreadCount}
          userId={user?.id}
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

      {incomingWordUpInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4"
          >
            <div className="inline-flex p-3 bg-correct/10 rounded-2xl border border-correct/20 text-correct mx-auto">
              <Swords size={24} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-wider text-white">WordUp Battle Challenge</h3>
            <p className="text-xs text-gray-400">
              <strong className="text-white">{incomingWordUpInvite.senderName}</strong> has challenged you to a rapid match in category <strong className="text-correct">{incomingWordUpInvite.category.replace('_', ' ')}</strong>!
            </p>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              Auto-pending in {incomingInviteTimeLeft} seconds...
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={async () => {
                  const invite = incomingWordUpInvite;
                  setIncomingWordUpInvite(null);
                  try {
                    // Insert match as LIVE (both users online)
                    const { data: newMatch, error } = await supabase
                      .from("wordup_matches")
                      .insert({
                        category: invite.category,
                        player1_id: invite.senderId,
                        player2_id: user?.id,
                        status: "countdown",
                        game_type: "live",
                        p1_answered: false,
                        p2_answered: false,
                        question_started_at: new Date(Date.now() + 4500).toISOString()
                      })
                      .select()
                      .single();

                    if (error || !newMatch) throw error || new Error("Failed to create match");

                    // Generate questions (edge function for procedural, local for legacy)
                    const { generateMatchQuestions } = await import("./services/wordup/questionService");
                    await generateMatchQuestions(newMatch.id, invite.category);

                    // Send accepted broadcast to challenger
                    const acceptChannel = supabase.channel(`user_signals_${invite.senderId}`);
                    acceptChannel.subscribe((status: string) => {
                      if (status === 'SUBSCRIBED') {
                        acceptChannel.send({
                          type: 'broadcast',
                          event: 'wordup_invite_accepted',
                          payload: { matchId: newMatch.id, senderName: formatUsername(user?.user_metadata?.username) || user?.email?.split('@')[0] || "Opponent" }
                        }).then(() => {
                          // Show connecting screen, then navigate
                          useLiveStore.getState().setMatchId(newMatch.id);
                          useLiveStore.getState().setRole("player2");
                          useLiveStore.getState().setView("connecting");
                          handleNavigation("wordup");
                        });
                        setTimeout(() => supabase.removeChannel(acceptChannel), 1000);
                      }
                    });
                  } catch (e) {
                    console.error("Failed to accept invite:", e);
                    triggerToast("Failed to start match.", 4000);
                  }
                }}
                className="bg-correct hover:bg-correct/90 text-black text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={handleIncomingInviteLater}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={() => {
                  const invite = incomingWordUpInvite;
                  setIncomingWordUpInvite(null);

                  // Broadcast rejected
                  const rejectChannel = supabase.channel(`user_signals_${invite.senderId}`);
                  rejectChannel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                      rejectChannel.send({
                        type: 'broadcast',
                        event: 'wordup_invite_rejected',
                        payload: { senderName: user?.user_metadata?.username || user?.email?.split('@')[0] || "Opponent" }
                      });
                      setTimeout(() => supabase.removeChannel(rejectChannel), 1000);
                    }
                  });
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Decline
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {incomingAsyncInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4"
          >
            <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 mx-auto">
              <Swords size={24} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-wider text-white">WordUp Async Battle</h3>
            <p className="text-xs text-gray-400">
              <strong className="text-white">{incomingAsyncInvite.senderName}</strong> has challenged you to an async match in category <strong className="text-correct">{incomingAsyncInvite.category.replace('_', ' ')}</strong>!
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={async () => {
                  const invite = incomingAsyncInvite;
                  setIncomingAsyncInvite(null);
                  try {
                    useAsyncStore.getState().setMatchId(invite.matchId);
                    useAsyncStore.getState().setRole("player2");
                    useAsyncStore.getState().setView("loading");
                    handleNavigation("wordup");
                    setWordupMode("async");

                    const acceptChannel = supabase.channel(`wordup_async_match_signals_${invite.matchId}`);
                    acceptChannel.subscribe((status) => {
                      if (status === 'SUBSCRIBED') {
                        acceptChannel.send({
                          type: 'broadcast',
                          event: 'wordup_async_invite_accepted',
                          payload: { matchId: invite.matchId, senderName: user?.user_metadata?.username || user?.email?.split('@')[0] || "Opponent" }
                        });
                        setTimeout(() => supabase.removeChannel(acceptChannel), 1000);
                      }
                    });
                  } catch (e) {
                    console.error("Failed to accept async invite:", e);
                  }
                }}
                className="bg-correct hover:bg-correct/90 text-black text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={() => {
                  const invite = incomingAsyncInvite;
                  setIncomingAsyncInvite(null);
                  const laterChannel = supabase.channel(`wordup_async_match_signals_${invite.matchId}`);
                  laterChannel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                      laterChannel.send({
                        type: 'broadcast',
                        event: 'wordup_async_invite_later',
                        payload: { matchId: invite.matchId }
                      });
                      setTimeout(() => supabase.removeChannel(laterChannel), 1000);
                    }
                  });
                  triggerToast("Challenge saved as pending. Play when ready!", 3000);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={async () => {
                  const invite = incomingAsyncInvite;
                  setIncomingAsyncInvite(null);
                  const declineChannel = supabase.channel(`wordup_async_match_signals_${invite.matchId}`);
                  declineChannel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                      declineChannel.send({
                        type: 'broadcast',
                        event: 'wordup_async_invite_declined',
                        payload: { matchId: invite.matchId }
                      });
                      setTimeout(() => supabase.removeChannel(declineChannel), 1000);
                    }
                  });
                  await supabase.from("wordup_async_matches").update({ status: "declined" }).eq("id", invite.matchId);
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Decline
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {opponentLaterInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4"
          >
            <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 mx-auto">
              <Swords size={24} />
            </div>
            <h3 className="text-lg font-black uppercase tracking-wider text-white">Play Later</h3>
            <p className="text-xs text-gray-400">
              <strong className="text-white">{opponentLaterInvite.opponentName}</strong> wants to play later. The match is saved under your pending queue!
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  const matchId = opponentLaterInvite.matchId;
                  setOpponentLaterInvite(null);
                  useLiveStore.getState().setMatchId(matchId);
                  useLiveStore.getState().setRole("player2");
                  handleNavigation("wordup");
                }}
                className="bg-correct hover:bg-correct/90 text-black text-xs font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Play Mine Now
              </button>
              <button
                onClick={() => setOpponentLaterInvite(null)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Wait
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ImageModal />
      <PWAInstallBanner />
      <NotificationPermissionPrompt />
    </div>
  );
}
