/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense } from 'react';
import type { AppUser, GuessResult } from '../../types/game';

const ChallengeModal = lazy(() => import('../ChallengeModal').then(m => ({ default: m.ChallengeModal })));
const GameOverModal = lazy(() => import('../GameOverModal').then(m => ({ default: m.GameOverModal })));
const InfoModal = lazy(() => import('../InfoModal').then(m => ({ default: m.InfoModal })));
const SettingsModal = lazy(() => import('../SettingsModal').then(m => ({ default: m.SettingsModal })));
const StatsModal = lazy(() => import('../StatsModal').then(m => ({ default: m.StatsModal })));

interface ModalsManagerProps {
    modals: {
        isSettingsOpen: boolean;
        isInfoOpen: boolean;
        isStatsOpen: boolean;
        isChallengeOpen: boolean;
        isGameOverOpen: boolean;
    };
    actions: {
        setSettingsOpen: (open: boolean) => void;
        setInfoOpen: (open: boolean) => void;
        setStatsOpen: (open: boolean) => void;
        setChallengeOpen: (open: boolean) => void;
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
    onChallengeCreated: (challenge: any, invitedUsernames: string[], invitedIds: string[]) => void;
}

export const ModalsManager = ({
    modals,
    actions,
    gameContext,
    onChallengeCreated
}: ModalsManagerProps) => {
    return (
        <Suspense fallback={null}>
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
                />
            )}

            {modals.isChallengeOpen && (
                <ChallengeModal
                    isOpen={modals.isChallengeOpen}
                    onClose={() => actions.setChallengeOpen(false)}
                    user={gameContext.user}
                    onChallengeCreated={onChallengeCreated}
                    initialChallengeId={new URLSearchParams(window.location.search).get('challenge')}
                />
            )}

            {modals.isGameOverOpen && (
                <GameOverModal
                    isOpen={modals.isGameOverOpen}
                    onClose={() => actions.setGameOverOpen(false)}
                    guesses={gameContext.guesses}
                    date={gameContext.date}
                    config={gameContext.config}
                    usedHint={gameContext.usedHint}
                    gameMessage={gameContext.gameMessage}
                    stats={gameContext.stats}
                />
            )}
        </Suspense>
    );
};
