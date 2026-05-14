import { MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { GameArea } from './components/layout/GameArea';
import { GameToolbar } from './components/layout/GameToolbar';
import { ModalsManager } from './components/layout/ModalsManager';
import { Toast } from './components/Toast';
import { CloudSyncMenu } from './components/SyncCloudModal';
import ChatRoom from './components/chatRoom';
import { useApp } from './context/AppContext';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useGameEngine } from './hooks/useGameEngine';
import { useAppInit } from './hooks/useAppInit';
import { useKeyboard } from './hooks/useKeyboard';
import { useWordleStats } from './hooks/useStats';
import { type AppUser } from './types/game';

export default function App() {
    const { user } = useAuth();
    const { toast, setToast, triggerToast, date, isLoadingDate, unreadCount, setUnreadCount } = useApp();

    // Core Game Engine
    const { state, actions, config } = useGameEngine(date as string);

    // UI State
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isChallengeOpen, setIsChallengeOpen] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.has('challenge');
    });

    // Stats Logic
    const { stats } = useWordleStats(user, isStatsOpen, date as string);

    // Initialization & Hydration
    const { isInitializing } = useAppInit(date as string, actions.loadState);

    // Keyboard Input
    useKeyboard(actions, isChatOpen || isInitializing);

    // Chat & Social
    const { sendMessage } = useChat(user?.id || "");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChallengeCreated = (challenge: any, invitedUsernames: string[], invitedIds: string[]) => {
        const mentions = invitedUsernames.map(name => `@${name}`).join(' ');
        const message = `${mentions} I challenge you to a ${challenge.mode} ${challenge.word_length}-letter Wordle! 🏆 \n\n Join here: ${window.location.origin}${window.location.pathname}?challenge=${challenge.id}`;
        sendMessage(message, undefined, invitedIds);
        triggerToast(`Challenge created and shared in chat!`, 3000);
    };

    if (isLoadingDate || isInitializing) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white font-black uppercase tracking-widest animate-pulse">
                Syncing with server...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
            {!isChatOpen && (
                <main className="h-svh flex flex-col bg-dark text-white p-2 sm:p-4">
                    <Toast
                        isVisible={toast.show}
                        message={toast.message}
                        duration={toast.duration}
                        onClose={() => setToast({ ...toast, show: false })}
                    />

                    <AppHeader onOpenSettings={() => setIsSettingsOpen(true)} />

                    <GameToolbar
                        onOpenChallenge={() => setIsChallengeOpen(true)}
                        onOpenStats={() => setIsStatsOpen(true)}
                        onOpenInfo={() => setIsInfoOpen(true)}
                        onHint={actions.handleHint}
                        onReset={() => window.location.reload()}
                        onShare={() => actions.setGameOverModalOpen(true)}
                        isGameOver={state.isGameOver}
                        usedHint={state.usedHint}
                        canShowHint={state.guesses.length >= 3}
                    />

                    <GameArea
                        wordLength={config.length}
                        maxAttempts={config.maxAttempts}
                        guesses={state.guesses}
                        currentGuess={state.currentGuess}
                        letterStatuses={state.letterStatuses}
                        hintRecord={state.hintRecord}
                        isGameOver={state.isGameOver}
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
                            isGameOverOpen: state.isGameOverModalOpen
                        }}
                        actions={{
                            setSettingsOpen: setIsSettingsOpen,
                            setInfoOpen: setIsInfoOpen,
                            setStatsOpen: setIsStatsOpen,
                            setChallengeOpen: setIsChallengeOpen,
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
                            isGameOverOpen: state.isGameOverModalOpen
                        }}
                        onChallengeCreated={handleChallengeCreated}
                    />

                    <CloudSyncMenu status="idle" /> {/* Simplified for now, can be wired to sync state if needed */}
                </main>
            )}

            {user && (
                <div className="fixed z-50 top-40 right-4 sm:top-auto sm:bottom-4 sm:right-26">
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

            {isChatOpen && <ChatRoom user={user as AppUser} />}

            <a href="/privacy" className="fixed bottom-2 left-2 text-[10px] text-gray-600 hover:underline">
                Privacy Policy
            </a>
        </div>
    );
}
