import { useEffect, useRef, useState, useCallback } from 'react';
import { NewGrid } from '../NewGrid';
import { Keyboard } from '../Keyboard';
import type { GuessResult, LetterStatus } from '../../types/game';
import { ANIMATION_DURATION } from '../../constants/ui';

import { useApp } from '../../context/AppContext';

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
    onEnter: () => void;
    onSetCursor?: (index: number) => void;
    onSetEditIndex?: (index: number | null) => void;
    isAlreadyPlayed?: boolean;
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
    onEnter,
    onSetCursor,
    onSetEditIndex,
    isAlreadyPlayed = false,
}: GameAreaProps) => {
    const { preferences } = useApp();
    // const [debugInfo, setDebugInfo] = useState({
    //     siblingHeights: 0,
    //     containerGap: 0,
    //     headerOverlap: 0,
    //     containerPadding: 0
    // });
    const [gridDimensions, setGridDimensions] = useState({ maxWidth: 320, maxHeight: 400 });
    const containerRef = useRef<HTMLDivElement>(null);
    const keyboardRef = useRef<HTMLDivElement>(null);
    const wasGameOverOnMount = useRef(isGameOver || isAlreadyPlayed);
    // eslint-disable-next-line react-hooks/refs
    const [hideKeyboard, setHideKeyboard] = useState(wasGameOverOnMount.current);

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
            const childStyle = window.getComputedStyle(child);
            if (childStyle.position === 'absolute' || childStyle.position === 'fixed') {
                continue;
            }
            flowChildrenCount++;

            const isGridParent = child.classList.contains('grid-wrapper-parent') || child.querySelector('.grid-wrapper-parent');
            if (!isGridParent) {
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

        let availableHeight = (containerRect.height - containerPadding - siblingHeights - containerGap - headerOverlap - 8) * 1.15;
        let availableWidth = containerRect.width - (parseFloat(computedStyle.paddingLeft) || 0) - (parseFloat(computedStyle.paddingRight) || 0) - 16;

        // Safeguard to prevent collapsing grids on iOS/iPhone WebKit sizing bugs
        const minHeightFallback = window.innerHeight * 0.35;
        availableHeight = Math.max(minHeightFallback, availableHeight);

        // Apply a 15% size reduction factor on desktop to prevent clipping/crowding
        if (window.innerWidth >= 768) {
            availableHeight = availableHeight * 0.85;
            availableWidth = availableWidth * 0.85;
        }

        setGridDimensions({
            maxWidth: Math.max(150, availableWidth),
            maxHeight: Math.max(150, availableHeight)
        });

        // setDebugInfo({
        //     siblingHeights,
        //     containerGap,
        //     headerOverlap,
        //     containerPadding
        // });
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

        const handleViewportResize = () => {
            updateDimensions();
        };
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportResize);
            window.visualViewport.addEventListener('scroll', handleViewportResize);
        }

        // Initial triggers
        updateDimensions();

        // Timeout fallbacks to handle WebKit layout delays on mount
        const t1 = setTimeout(updateDimensions, 80);
        const t2 = setTimeout(updateDimensions, 350);

        return () => {
            observer.disconnect();
            clearTimeout(t1);
            clearTimeout(t2);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleViewportResize);
                window.visualViewport.removeEventListener('scroll', handleViewportResize);
            }
        };
    }, [updateDimensions, hideKeyboard]);
    const [showHelp, setShowHelp] = useState(false);
    const helpRef = useRef<HTMLDivElement>(null);

    const [keyboardStatuses, setKeyboardStatuses] = useState(letterStatuses);

    useEffect(() => {
        if (guesses.length === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setKeyboardStatuses(letterStatuses);
            return;
        }
        const timer = setTimeout(() => {
            setKeyboardStatuses(letterStatuses);
        }, wordLength * ANIMATION_DURATION.TILE_REVEAL + 400);
        return () => clearTimeout(timer);
    }, [guesses.length, letterStatuses, wordLength]);

    useEffect(() => {
        if (!showHelp) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
                setShowHelp(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHelp]);

    useEffect(() => {
        if (isGameOver || isAlreadyPlayed) {
            if (wasGameOverOnMount.current || isAlreadyPlayed) {
                setHideKeyboard(true);
            } else {
                const hideDelay = wordLength * 400 + 400; // Match TILE_REVEAL + padding
                const timer = setTimeout(() => {
                    setHideKeyboard(true);
                }, hideDelay);
                return () => clearTimeout(timer);
            }
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHideKeyboard(false);
            wasGameOverOnMount.current = false;
        }
    }, [isGameOver, isAlreadyPlayed, wordLength]);

    return (
        <div className="gameplay-container flex-1 flex flex-col justify-between min-h-0 w-full px-2 pb-0.5 sm:pt-2 sm:pb-1 gap-2 sm:gap-4">

            <div ref={containerRef} className="flex-1 flex items-center justify-center min-h-0 w-full relative">
                <div className="relative grid-wrapper-parent">
                    <NewGrid
                        wordLength={wordLength}
                        maxAttempts={maxAttempts}
                        guesses={guesses}
                        currentGuess={currentGuess}
                        cursorIndex={cursorIndex}
                        editIndex={editIndex}
                        hintRecord={hintRecord}
                        isShake={isShake}
                        compact={preferences.compactMode}
                        gameplayType="regular"
                        onSetCursor={onSetCursor}
                        onSetEditIndex={onSetEditIndex}
                        maxGridWidth={gridDimensions.maxWidth}
                        maxGridHeight={gridDimensions.maxHeight}
                        onToggleRules={() => setShowHelp(!showHelp)}
                        showRules={showHelp}
                    />
                </div>
            </div>

            {!hideKeyboard && (
                <div ref={keyboardRef} className="w-full max-w-[500px] mx-auto pb-0.5 shrink-0 px-2">
                    <Keyboard
                        onChar={onChar}
                        onDelete={onDelete}
                        onEnter={onEnter}
                        letterStatuses={keyboardStatuses}
                        gameplayType="regular"
                        wordLength={wordLength}
                    />
                </div>
            )}

            {/* Visual Sizing Diagnostics */}
            {/* <div className="absolute inset-0 pointer-events-none z-50 border border-dashed border-red-500/20">
                <div
                    className="absolute left-0 right-0 border-t border-b border-dashed border-green-500/40 bg-green-500/5 flex items-center justify-center text-[10px] font-mono text-green-400"
                    style={{
                        top: `${debugInfo.containerPadding / 2}px`,
                        height: `${gridDimensions.maxHeight}px`
                    }}
                >
                    Available Height: {gridDimensions.maxHeight}px
                </div>
                <div className="absolute bottom-2 left-2 bg-black/90 p-2 rounded-md border border-white/10 text-[9px] font-mono text-yellow-400 space-y-0.5 pointer-events-auto">
                    <div>CONTAINER H: {containerRef.current?.getBoundingClientRect().height.toFixed(1)}px</div>
                    <div>SIBLINGS: {debugInfo.siblingHeights.toFixed(1)}px</div>
                    <div>GAPS: {debugInfo.containerGap.toFixed(1)}px</div>
                    <div>OVERLAP: {debugInfo.headerOverlap.toFixed(1)}px</div>
                    <div>PADDING: {debugInfo.containerPadding.toFixed(1)}px</div>
                </div>
            </div> */}
        </div>
    );
};
