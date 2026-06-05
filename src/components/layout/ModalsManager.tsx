/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useEffect } from 'react';
import type { AppUser, GuessResult } from '../../types/game';
import { safeLazy } from '../../utils/safeLazy';

const ChallengeModal = safeLazy(() => import('../ChallengeModal').then(m => ({ default: m.ChallengeModal })));
const GameOverModal = safeLazy(() => import('../GameOverModal').then(m => ({ default: m.GameOverModal })));
const InfoModal = safeLazy(() => import('../InfoModal').then(m => ({ default: m.InfoModal })));
const SettingsModal = safeLazy(() => import('../SettingsModal').then(m => ({ default: m.SettingsModal })));
const StatsModal = safeLazy(() => import('../StatsModal').then(m => ({ default: m.StatsModal })));
const AnnouncementModal = safeLazy(() => import('../AnnouncementModal').then(m => ({ default: m.AnnouncementModal })));
const NotificationModal = safeLazy(() => import('../notifications/NotificationModal').then(m => ({ default: m.NotificationModal })));
const AuthModal = safeLazy(() => import('../AuthModal').then(m => ({ default: m.AuthModal })));
const UserProfileModal = safeLazy(() => import('../UserProfileModal').then(m => ({ default: m.UserProfileModal })));

import { useAnnouncements } from '../../hooks/useAnnouncements';

interface ModalsManagerProps {
    modals: {
        isSettingsOpen: boolean;
        isInfoOpen: boolean;
        isStatsOpen: boolean;
        isChallengeOpen: boolean;
        isNotificationsOpen: boolean;
        isAuthOpen: boolean;
        isGameOverOpen: boolean;
    };
    actions: {
        setSettingsOpen: (open: boolean) => void;
        setInfoOpen: (open: boolean) => void;
        setStatsOpen: (open: boolean) => void;
        setChallengeOpen: (open: boolean) => void;
        setNotificationsOpen: (open: boolean) => void;
        setAuthOpen: (open: boolean) => void;
        setGameOverOpen: (open: boolean) => void;
    };
    gameContext: {
        isGameOver: boolean;
        isGameOverOpen: boolean;
        user: AppUser | null;
        date: string;
        guesses: GuessResult[][];
        config: any;
        usedHint: boolean;
        gameMessage: string;
        stats: any;
    };
    statsActiveTab?: 'stats' | 'leaderboard';
    onChallengeCreated: (challenge: any, invitedUsernames: string[], invitedIds: string[]) => void;
    viewedProfileId: string | null;
    setViewedProfileId: (id: string | null) => void;
    initialChallengeId?: string | null;
}

export const ModalsManager = ({
    modals,
    actions,
    gameContext,
    statsActiveTab = 'leaderboard',
    onChallengeCreated,
    viewedProfileId,
    setViewedProfileId,
    initialChallengeId
}: ModalsManagerProps) => {
    const { currentAnnouncement, isOpen: isAnnouncementOpen, markAsRead } = useAnnouncements();

    useEffect(() => {
        const preloadComponents = () => {
            StatsModal.preload?.();
            ChallengeModal.preload?.();
        };

        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(preloadComponents);
        } else {
            // 1.5 seconds
            const timer = setTimeout(preloadComponents, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <Suspense fallback={null}>
            {currentAnnouncement && (
                <AnnouncementModal
                    isOpen={isAnnouncementOpen}
                    announcement={currentAnnouncement}
                    onClose={markAsRead}
                />
            )}
            {gameContext.user && modals.isSettingsOpen && (
                <SettingsModal
                    isOpen={modals.isSettingsOpen}
                    onClose={() => actions.setSettingsOpen(false)}
                />
            )}

            {modals.isInfoOpen && (
                <InfoModal
                    isOpen={modals.isInfoOpen}
                    onClose={() => actions.setInfoOpen(false)}
                />
            )}

            {modals.isStatsOpen && (
                <StatsModal
                    isOpen={modals.isStatsOpen}
                    stats={gameContext.stats}
                    onClose={() => actions.setStatsOpen(false)}
                    user={gameContext.user}
                    isGameOver={gameContext.isGameOver}
                    initialTab={statsActiveTab}
                />
            )}

            {modals.isChallengeOpen && (
                <ChallengeModal
                    isOpen={modals.isChallengeOpen}
                    onClose={() => actions.setChallengeOpen(false)}
                    user={gameContext.user}
                    onChallengeCreated={onChallengeCreated}
                    initialChallengeId={initialChallengeId || new URLSearchParams(window.location.search).get('challenge')}
                />
            )}

            {modals.isNotificationsOpen && (
                <NotificationModal />
            )}

            {modals.isAuthOpen && (
                <AuthModal
                    isOpen={modals.isAuthOpen}
                    onClose={() => actions.setAuthOpen(false)}
                />
            )}

            {modals.isGameOverOpen && gameContext.guesses && gameContext.guesses.length > 0 && gameContext.config && (
                <GameOverModal
                    isOpen={modals.isGameOverOpen}
                    onClose={() => actions.setGameOverOpen(false)}
                    guesses={gameContext.guesses}
                    date={gameContext.date}
                    config={gameContext.config}
                    usedHint={gameContext.usedHint}
                    gameMessage={gameContext.gameMessage}
                    stats={gameContext.stats}
                    isAuthenticated={gameContext.user ? true : false}
                />
            )}
            {viewedProfileId && (
                <UserProfileModal
                    userId={viewedProfileId}
                    onClose={() => setViewedProfileId(null)}
                />
            )}
        </Suspense>
    );
};
