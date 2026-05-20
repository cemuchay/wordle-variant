import { MessageSquare, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { AudioConnectionLog } from './components/challenge/AudioConnectionLog';
import { DynamicIslandStatus } from './components/DynamicIslandStatus';
import { GlobalAudioPlayer } from './components/GlobalAudioPlayer';
import { AppHeader } from './components/layout/AppHeader';
import { GameArea } from './components/layout/GameArea';
import { GameToolbar } from './components/layout/GameToolbar';
import { ModalsManager } from './components/layout/ModalsManager';
import { Toast } from './components/Toast';
import { NotificationsManager } from './components/notifications/NotificationsManager';
import { useApp } from './context/AppContext';
import { useAuth } from './hooks/useAuth';
import { useGameEngine } from './hooks/useGameEngine';
import { useKeyboard } from './hooks/useKeyboard';
import { useWordleStats } from './hooks/useStats';
import { type AppUser, type Challenge } from './types/game';
import { useMyChallenges } from './hooks/queries/useChallengeQueries';
import { safeLazy } from './utils/safeLazy';

const ChatRoom = safeLazy(() => import('./components/chatRoom'));

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
    const [statsActiveTab, setStatsActiveTab] = useState<'stats' | 'leaderboard'>('stats');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);

    // Listen to custom event to open stats modal at a specific tab
    useEffect(() => {
        const handleOpenStats = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail?.tab) {
                setStatsActiveTab(detail.tab);
            } else {
                setStatsActiveTab('stats');
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

    if (isLoadingDate || !isHydrated) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white font-black uppercase tracking-widest animate-pulse">
                loading game ...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
            <DynamicIslandStatus />
            <AudioConnectionLog />
            <GlobalAudioPlayer />
            <NotificationsManager />
            {!isChatOpen && (
                <main className="h-svh flex flex-col bg-dark text-white p-2 sm:p-4 pt-12 sm:pt-4">
                    <Toast
                        isVisible={toast.show}
                        message={toast.message}
                        duration={toast.duration}
                        onClose={() => setToast({ ...toast, show: false })}
                    />

                    <AppHeader onOpenSettings={() => setIsSettingsOpen(true)} />

                    <GameToolbar
                        onOpenChallenge={() => setIsChallengeOpen(true)}
                        onOpenStats={() => { setStatsActiveTab('stats'); setIsStatsOpen(true); }}
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

            <a href="/privacy.html" className="fixed bottom-2 left-2 text-[10px] text-gray-600 hover:underline">
                Privacy Policy
            </a>
        </div>
    );
}
