import { MessageSquare, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { AudioConnectionLog } from './components/challenge/AudioConnectionLog';
import { DynamicIslandStatus } from './components/DynamicIslandStatus';
import { GlobalAudioPlayer } from './components/GlobalAudioPlayer';
import { AppHeader } from './components/layout/AppHeader';
import { GameArea } from './components/layout/GameArea';
import { GameToolbar } from './components/layout/GameToolbar';
import { ModalsManager } from './components/layout/ModalsManager';
import { WeeklyWrappedModal } from './components/WeeklyWrappedModal';
import { Toast } from './components/Toast';
import { NotificationsManager } from './components/notifications/NotificationsManager';
import { LandscapeBlocker } from './components/LandscapeBlocker';
import { useApp } from './context/AppContext';
import { useAuth } from './hooks/useAuth';
import { useGameEngine } from './hooks/useGameEngine';
import { useKeyboard } from './hooks/useKeyboard';
import { useWordleStats } from './hooks/useStats';
import { type AppUser, type Challenge } from './types/game';
import { useMyChallenges } from './hooks/queries/useChallengeQueries';
import { safeLazy } from './utils/safeLazy';
import { supabase } from './lib/supabaseClient';

const ChatRoom = safeLazy(() => import('./components/chatRoom'));
import { AdminPage } from './components/admin/AdminPage';
import { UnsubscribePage } from './components/UnsubscribePage';


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
        realtimeStatus,
    } = useApp();

    // Core Game Engine
    const { state, actions, config, isHydrated } = useGameEngine(date as string);

    // Initial Challenges Fetch using TanStack Query
    const { data: myChallenges } = useMyChallenges(user?.id);

    useEffect(() => {
        if (myChallenges) {
            const count = myChallenges.filter((c: Challenge) =>
                (c.status === 'pending' || c.status === 'playing') &&
                new Date(c.challenge.expires_at) > new Date()
            ).length;
            setChallengeUnreadCount(count);
        }
    }, [myChallenges, setChallengeUnreadCount]);

    // UI State
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [statsActiveTab, setStatsActiveTab] = useState<'stats' | 'leaderboard'>('leaderboard');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
    const [isWeeklyWrappedOpen, setIsWeeklyWrappedOpen] = useState(false);

    // Auto-trigger weekly wrapped on Monday logins
    useEffect(() => {
        if (!user) return;

        const now = new Date();
        const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday

        if (currentDay === 1) {
            // Calculate current Monday's date string
            const monday = new Date();
            const day = monday.getDay();
            const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
            monday.setDate(diff);
            const mondayStr = monday.toISOString().split('T')[0];

            const seenKey = `wrapped-seen-${mondayStr}-${user.id}`;
            const alreadySeen = localStorage.getItem(seenKey);

            if (!alreadySeen) {
                setIsWeeklyWrappedOpen(true);
                localStorage.setItem(seenKey, 'true');
            }
        }
    }, [user]);

    // Global Leaderboard Sync & Cache Invalidation
    useEffect(() => {
        if (!date) return;

        const channelName = `global_scores_leaderboard_sync`;
        const existing = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelName}`);
        if (existing) {
            supabase.removeChannel(existing);
        }

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'scores',
                    filter: `game_date=eq.${date}`
                },
                () => {
                    console.log('[Global Score Sync] score update detected. Invalidating sessionStorage cache...');
                    sessionStorage.removeItem(`wordle_global_leaderboard_today_${date}`);
                    sessionStorage.removeItem(`wordle_global_leaderboard_yesterday_${date}`);
                    sessionStorage.removeItem(`wordle_global_leaderboard_weekly_${date}`);
                    sessionStorage.removeItem(`wordle_global_leaderboard_monthly_${date}`);

                    // Dispatch custom event to notify any open StatsModal
                    window.dispatchEvent(new CustomEvent('global-scores-updated'));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [date]);

    // Listen to custom event to open stats modal at a specific tab
    useEffect(() => {
        const handleOpenStats = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail?.tab) {
                setStatsActiveTab(detail.tab);
            } else {
                setStatsActiveTab('leaderboard');
            }
            setIsStatsOpen(true);
        };
        window.addEventListener('open-stats-modal', handleOpenStats);
        return () => window.removeEventListener('open-stats-modal', handleOpenStats);
    }, []);

    // Listen to custom event to open auth modal
    useEffect(() => {
        const handleOpenAuth = () => setIsAuthOpen(true);
        window.addEventListener('open-auth-modal', handleOpenAuth);
        return () => window.removeEventListener('open-auth-modal', handleOpenAuth);
    }, []);

    // Re-open challenge modal after successful login/signup if initiated from the challenge screen
    useEffect(() => {
        if (user) {
            const redirectTarget = sessionStorage.getItem('auth_redirect_target');
            if (redirectTarget === 'challenge') {
                sessionStorage.removeItem('auth_redirect_target');
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
        window.addEventListener('open-user-profile', handleOpenProfile);
        return () => window.removeEventListener('open-user-profile', handleOpenProfile);
    }, [user, triggerToast]);

    // Stats Logic
    const { stats } = useWordleStats(user, isStatsOpen, date as string);

    // Keyboard Input
    useKeyboard(actions, isChatOpen || !isHydrated || isChallengeOpen || isStatsOpen || isSettingsOpen || isInfoOpen || isNotificationsOpen || isAuthOpen || !!viewedProfileId);


    const handleChallengeCreated = () => {
        triggerToast(`Challenge created successfully`, 3000)
    }

    const isPageAdmin = window.location.pathname === '/admin';

    if (isPageAdmin) {
        return <AdminPage />;
    }

    const isPageUnsubscribe = window.location.pathname === '/unsubscribe';

    if (isPageUnsubscribe) {
        return <UnsubscribePage />;
    }

    if (isLoadingDate || !isHydrated) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white font-black uppercase tracking-widest animate-pulse">
                loading game ...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
            <LandscapeBlocker />
            <DynamicIslandStatus />
            <AudioConnectionLog />
            <GlobalAudioPlayer />
            <NotificationsManager />
            {realtimeStatus === 'disconnected' && (
                <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3 bg-amber-950/90 backdrop-blur-md border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-xl">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        <p className="text-[10px] uppercase font-black tracking-wide text-amber-200">
                            Live sync disconnected
                        </p>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => supabase.realtime.connect()} 
                                className="bg-amber-500 hover:bg-amber-600 text-black px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer font-bold"
                            >
                                Reconnect
                            </button>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer font-bold"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {!isChatOpen && (
                <main className="h-svh flex flex-col bg-dark text-white p-2 sm:p-4 pt-12 sm:pt-4">
                    <Toast
                        isVisible={toast.show}
                        message={toast.message}
                        duration={toast.duration}
                        onClose={() => setToast({ ...toast, show: false })}
                    />

                    <AppHeader 
                        onOpenSettings={() => setIsSettingsOpen(true)} 
                        onOpenWeeklyWrapped={() => setIsWeeklyWrappedOpen(true)} 
                    />

                    <GameToolbar
                        onOpenChallenge={() => setIsChallengeOpen(true)}
                        onOpenStats={() => { setStatsActiveTab('leaderboard'); setIsStatsOpen(true); }}
                        onOpenInfo={() => setIsInfoOpen(true)}
                        onHint={actions.handleHint}
                        onReset={() => window.location.reload()}
                        onShare={() => actions.setGameOverModalOpen(true)}
                        onRetrySync={actions.retrySync}
                        isGameOver={state.isGameOver}
                        usedHint={state.usedHint}
                        canShowHint={state.guesses.length >= 2}
                        isHintLocked={(state.guesses.length >= (config.maxAttempts - 1) || state.isHintDisabled) && !state.usedHint}
                        syncStatus={state.syncStatus}
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
                        isSaving={state.syncStatus === 'syncing'}
                        onChar={actions.onChar}
                        onDelete={actions.onDelete}
                        onEnter={actions.onEnter}
                    />
                    <ModalsManager
                        modals={{
                            isSettingsOpen,
                            isInfoOpen,
                            isStatsOpen,
                            isChallengeOpen,
                            isNotificationsOpen,
                            isAuthOpen,
                            isGameOverOpen: state.isGameOverModalOpen
                        }}
                        actions={{
                            setSettingsOpen: setIsSettingsOpen,
                            setInfoOpen: setIsInfoOpen,
                            setStatsOpen: setIsStatsOpen,
                            setChallengeOpen: setIsChallengeOpen,
                            setNotificationsOpen: setIsNotificationsOpen,
                            setAuthOpen: setIsAuthOpen,
                            setGameOverOpen: actions.setGameOverModalOpen
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
                            isGameOverOpen: state.isGameOverModalOpen
                        }}
                        statsActiveTab={statsActiveTab}
                        onChallengeCreated={handleChallengeCreated}
                        viewedProfileId={viewedProfileId}
                        setViewedProfileId={setViewedProfileId}
                    />


                </main>
            )}

            {user && (
                <div className="fixed z-50 top-44 right-4 sm:top-auto sm:bottom-6 sm:right-26">
                    {unreadCount > 0 && !isChatOpen && (
                        <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 z-60 min-w-4.5 h-4.5 sm:min-w-5.5 sm:h-5.5 px-1 bg-white text-red-400 border-2 border-red-950 text-[9px] sm:text-[13px] font-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-in zoom-in duration-300">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setIsChatOpen(!isChatOpen);
                            setUnreadCount(0);
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
                </div>
            )}

            {isChatOpen && (
                <Suspense fallback={null}>
                    <ChatRoom user={user as AppUser} />
                </Suspense>
            )}

            {isWeeklyWrappedOpen && user && (
                <WeeklyWrappedModal
                    isOpen={isWeeklyWrappedOpen}
                    onClose={() => setIsWeeklyWrappedOpen(false)}
                    userId={user.id}
                    isEasterEgg={false}
                    gameDate={date as string}
                />
            )}

            <div className="fixed bottom-2 left-2 flex items-center gap-2 text-[10px] text-gray-600 z-40">
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
