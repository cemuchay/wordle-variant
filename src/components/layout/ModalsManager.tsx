/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChallengeModal } from '../ChallengeModal';
import { GameOverModal } from '../GameOverModal';
import { InfoModal } from '../InfoModal';
import { SettingsModal } from '../SettingsModal';
import { StatsModal } from '../StatsModal';
import type { AppUser, GuessResult } from '../../types/game';

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
        <>
            {gameContext.user && (
                <SettingsModal
                    isOpen={modals.isSettingsOpen}
                    onClose={() => actions.setSettingsOpen(false)}
                />
            )}

            <InfoModal
                isOpen={modals.isInfoOpen}
                onClose={() => actions.setInfoOpen(false)}
            />

            <StatsModal
                isOpen={modals.isStatsOpen}
                stats={gameContext.stats}
                onClose={() => actions.setStatsOpen(false)}
                user={gameContext.user}
                isGameOver={gameContext.isGameOverOpen}
            />

            <ChallengeModal
                isOpen={modals.isChallengeOpen}
                onClose={() => actions.setChallengeOpen(false)}
                user={gameContext.user}
                onChallengeCreated={onChallengeCreated}
                initialChallengeId={new URLSearchParams(window.location.search).get('challenge')}
            />

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
        </>
    );
};
