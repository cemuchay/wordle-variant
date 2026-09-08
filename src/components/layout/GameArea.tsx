import { useEffect, useRef, useState, useCallback } from 'react';
import type { GuessResult, LetterStatus } from '../../types/game';
import { ANIMATION_DURATION } from '../../constants/ui';
import { useApp } from '../../context/AppContext';
import { useIsResponsive } from '../../hooks/useResponsive';
import { MobileGameLayout } from './game/MobileGameLayout';
import { DesktopGameLayout } from './game/DesktopGameLayout';

interface GameAreaProps {
    wordLength: number;
    maxAttempts: number;
    guesses: GuessResult[][];
    currentGuess: string;
    cursorIndex?: number;
    editIndex?: number | null;
    letterStatuses: Record<string, LetterStatus>;
    hintRecord: { letter: string; index: number; row?: number } | null;
    isGameOver: boolean;
    isShake?: boolean;
    isSaving?: boolean;
    onChar: (char: string) => void;
    onDelete: () => void;
    onClearRow?: () => void;
    onEnter: () => void;
    onSetCursor?: (index: number) => void;
    onSetEditIndex?: (index: number | null) => void;
    isAlreadyPlayed?: boolean;
    gameplayType?: 'regular' | 'challenge' | 'archive' | 'guest';
    onHint?: () => void;
    usedHint?: boolean;
    canShowHint?: boolean;
    isHintLocked?: boolean;
    gameMessage?: string;
    targetWord?: string;
    onNavigate?: (item: "play" | "chat" | "leaderboard" | "challenges" | "wordup") => void;
    onOpenFreePlay?: (mode: 'guest' | 'archive') => void;
    activeDailyMarathons?: any[];
    isMarathonLoading?: boolean;
    isMarathonError?: boolean;
    setSelectedChallengeId?: (id: string | null) => void;
    setIsChallengeOpen?: (open: boolean) => void;
}

export const GameArea = ({
    wordLength,
    maxAttempts,
    guesses,
    currentGuess,
    cursorIndex,
    editIndex,
    letterStatuses,
    hintRecord,
    isGameOver,
    isShake,
    onChar,
    onDelete,
    onClearRow,
    onEnter,
    onSetCursor,
    onSetEditIndex,
    isAlreadyPlayed = false,
    gameplayType = 'regular',
    onHint,
    usedHint,
    canShowHint,
    isHintLocked,
    gameMessage,
    targetWord = '',
    onNavigate,
    onOpenFreePlay,
    activeDailyMarathons = [],
    isMarathonLoading = false,
    isMarathonError = false,
    setSelectedChallengeId,
    setIsChallengeOpen,
}: GameAreaProps) => {
    const { preferences, date } = useApp();
    const { isDesktop } = useIsResponsive();
    const [gridDimensions, setGridDimensions] = useState({ maxWidth: 320, maxHeight: 400 });
    const containerRef = useRef<HTMLDivElement>(null);
    const keyboardRef = useRef<HTMLDivElement>(null);
    const wasGameOverOnMount = useRef(isGameOver || isAlreadyPlayed);

    // Instantaneous game over state resolution
    const [hideKeyboard, setHideKeyboard] = useState(wasGameOverOnMount.current);
    const [isBoardCollapsed, setIsBoardCollapsed] = useState(true);

    const updateDimensions = useCallback(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(container);
        const containerPadding = (parseFloat(computedStyle.paddingTop) || 0) + (parseFloat(computedStyle.paddingBottom) || 0);

        let siblingHeights = 0;
        let flowChildrenCount = 0;

        for (let i = 0; i < container.children.length; i++) {
            const child = container.children[i] as HTMLElement;
            if (child.classList.contains('grid-wrapper-parent')) continue;

            const childStyle = window.getComputedStyle(child);
            if (childStyle.position !== 'absolute' && childStyle.position !== 'fixed' && childStyle.display !== 'none') {
                flowChildrenCount++;
                siblingHeights += child.getBoundingClientRect().height;
                siblingHeights += (parseFloat(childStyle.marginTop) || 0) + (parseFloat(childStyle.marginBottom) || 0);
            }
        }

        let containerGap = 0;
        if (flowChildrenCount > 1 && (computedStyle.display === 'flex' || computedStyle.display === 'grid')) {
            const gapVal = parseFloat(computedStyle.gap) || 0;
            containerGap = gapVal * (flowChildrenCount - 1);
        }

        let headerOverlap = 0;
        const headerEl = document.getElementById('challenge-modal-header') || document.querySelector('.app-header');
        if (headerEl) {
            const headerRect = headerEl.getBoundingClientRect();
            if (containerRect.top < headerRect.bottom) {
                headerOverlap = headerRect.bottom - containerRect.top;
            }
        }

        let availableHeight = containerRect.height - containerPadding - siblingHeights - containerGap - headerOverlap - 12;
        let availableWidth = containerRect.width - (parseFloat(computedStyle.paddingLeft) || 0) - (parseFloat(computedStyle.paddingRight) || 0) - 16;

        const minHeightFallback = window.innerHeight * 0.30;
        availableHeight = Math.max(minHeightFallback, availableHeight);

        setGridDimensions({
            maxWidth: Math.max(180, availableWidth),
            maxHeight: Math.max(180, availableHeight)
        });
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(() => {
            updateDimensions();
        });
        observer.observe(containerRef.current);
        if (keyboardRef.current) {
            observer.observe(keyboardRef.current);
        }

        const handleResize = () => {
            updateDimensions();
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        const initialTimer = setTimeout(updateDimensions, 50);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            clearTimeout(initialTimer);
        };
    }, [updateDimensions]);

    const [keyboardStatuses, setKeyboardStatuses] = useState(letterStatuses);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        if (guesses.length === 0) {
            setKeyboardStatuses(letterStatuses);
            return;
        }
        const timer = setTimeout(() => {
            setKeyboardStatuses(letterStatuses);
        }, wordLength * ANIMATION_DURATION.TILE_REVEAL + 400);
        return () => clearTimeout(timer);
    }, [guesses.length, letterStatuses, wordLength]);

    useEffect(() => {
        if (isGameOver || isAlreadyPlayed) {
            if (wasGameOverOnMount.current || isAlreadyPlayed) {
                setHideKeyboard(true);
            } else {
                const hideDelay = wordLength * 400 + 400;
                const timer = setTimeout(() => {
                    setHideKeyboard(true);
                }, hideDelay);
                return () => clearTimeout(timer);
            }
        } else {
            setHideKeyboard(false);
            wasGameOverOnMount.current = false;
        }
    }, [isGameOver, isAlreadyPlayed, wordLength]);

    const sharedProps = {
        wordLength,
        maxAttempts,
        guesses,
        currentGuess,
        cursorIndex,
        editIndex,
        letterStatuses,
        keyboardStatuses,
        hintRecord,
        isGameOver,
        isAlreadyPlayed,
        isShake,
        compact: preferences.compactMode,
        gameplayType,
        targetWord,
        gameMessage,
        usedHint,
        canShowHint,
        isHintLocked,
        hideKeyboard: hideKeyboard || isGameOver || isAlreadyPlayed,
        isBoardCollapsed,
        gridDimensions,
        showHelp,
        date: date || new Date().toISOString().split('T')[0],
        onChar,
        onDelete,
        onClearRow,
        onEnter,
        onSetCursor,
        onSetEditIndex,
        onHint,
        onToggleRules: () => setShowHelp((prev) => !prev),
        onToggleBoardCollapse: () => setIsBoardCollapsed((prev) => !prev),
        onNavigate,
        onOpenFreePlay,
        activeDailyMarathons,
        isMarathonLoading,
        isMarathonError,
        setSelectedChallengeId,
        setIsChallengeOpen,
        containerRef,
        keyboardRef,
    };

    return (
        <div className="gameplay-container flex-1 flex flex-col min-h-0 w-full relative">
            {isDesktop ? (
                <DesktopGameLayout {...sharedProps} />
            ) : (
                <MobileGameLayout {...sharedProps} />
            )}
        </div>
    );
};
