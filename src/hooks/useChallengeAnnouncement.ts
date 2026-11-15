/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    hasSeenChallengeAnnouncementToday,
    hasVisitedChallengesRecently,
    markChallengeAnnouncementSeenToday,
    recordChallengesTabVisit,
} from '../utils/challengePromptStorage';

const PROMPT_DELAY_MS = 7000; // 7 seconds (within the 5-10s post-load window)

interface UseChallengeAnnouncementOptions {
    userId?: string;
    challenges?: any[];
    activeNavigationItem?: string;
    isChallengeModalOpen?: boolean;
    isOtherModalOpen?: boolean;
}

/**
 * Manages the daily challenge (Marathon) announcement modal.
 *
 * Shows once per day, 7 seconds after app load, if the user has not visited
 * the Challenges tab in the last 24 hours and an active marathon exists.
 */
export function useChallengeAnnouncement({
    userId,
    challenges = [],
    activeNavigationItem,
    isChallengeModalOpen = false,
    isOtherModalOpen = false,
}: UseChallengeAnnouncementOptions) {
    const [isOpen, setIsOpen] = useState(false);

    // Pick the first active marathon challenge
    const marathonChallenge = useMemo(() => {
        if (!Array.isArray(challenges) || challenges.length === 0) return null;
        return (
            challenges.find(
                (c) =>
                    c?.challenge?.type === 'marathon' ||
                    c?.type === 'marathon' ||
                    Boolean(c?.challenge?.is_marathon)
            ) || challenges[0]
        );
    }, [challenges]);

    // Determine whether the current user has already joined this marathon
    const hasJoined = useMemo(() => {
        if (!userId || !marathonChallenge) return false;
        const participants = marathonChallenge?.challenge?.participants || [];
        return participants.some(
            (p: any) => p?.user_id === userId || p?.profiles?.id === userId
        );
    }, [userId, marathonChallenge]);

    // Record visits whenever the user opens the Challenges tab or ChallengeModal
    useEffect(() => {
        if (activeNavigationItem === 'challenges' || isChallengeModalOpen) {
            recordChallengesTabVisit();
            setIsOpen(false);
        }
    }, [activeNavigationItem, isChallengeModalOpen]);

    // Schedule the delayed announcement prompt on first daily open
    useEffect(() => {
        if (!userId || !marathonChallenge) return;
        if (activeNavigationItem === 'challenges' || isChallengeModalOpen) return;
        if (isOtherModalOpen) return;
        if (hasVisitedChallengesRecently() || hasSeenChallengeAnnouncementToday()) return;

        const timer = setTimeout(() => {
            // Re-check eligibility right before showing
            if (hasVisitedChallengesRecently() || hasSeenChallengeAnnouncementToday()) {
                return;
            }
            markChallengeAnnouncementSeenToday();
            setIsOpen(true);
        }, PROMPT_DELAY_MS);

        return () => clearTimeout(timer);
    }, [
        userId,
        marathonChallenge,
        activeNavigationItem,
        isChallengeModalOpen,
        isOtherModalOpen,
    ]);

    const dismiss = useCallback(() => {
        markChallengeAnnouncementSeenToday();
        setIsOpen(false);
    }, []);

    return {
        isOpen,
        marathonChallenge,
        hasJoined,
        dismiss,
    };
}

