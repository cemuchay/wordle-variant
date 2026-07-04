import { useEffect, useRef, useState, useCallback } from 'react';
import { Grid } from '../Grid';
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
    isSaving,
    onChar,
    onDelete,
    onEnter,
    onSetCursor,
    onSetEditIndex,
    isAlreadyPlayed = false,
}: GameAreaProps) => {
    const { preferences } = useApp();
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
        const containerPadding = 
            (parseFloat(computedStyle.paddingTop) || 0) + 
            (parseFloat(computedStyle.paddingBottom) || 0) +
            (parseFloat(computedStyle.borderTopWidth) || 0) + 
            (parseFloat(computedStyle.borderBottomWidth) || 0);
        
        let siblingHeights = 0;
        let flowChildrenCount = 0;
        
        for (let i = 0; i < container.children.length; i++) {
            const child = container.children[i] as HTMLElement;
            const childStyle = window.getComputedStyle(child);
            if (childStyle.position === 'absolute' || childStyle.position === 'fixed') {
                continue;
            }
            flowChildrenCount++;
            
            const gridEl = child.classList.contains('game-board-grid') ? child : child.querySelector('.game-board-grid');
            if (gridEl) {
                const innerComputed = window.getComputedStyle(child);
                siblingHeights += (parseFloat(innerComputed.paddingTop) || 0) + 
                                  (parseFloat(innerComputed.paddingBottom) || 0) +
                                  (parseFloat(innerComputed.borderTopWidth) || 0) + 
                                  (parseFloat(innerComputed.borderBottomWidth) || 0);
                
                let innerFlowChildrenCount = 0;
                for (let j = 0; j < child.children.length; j++) {
                    const innerChild = child.children[j] as HTMLElement;
                    const innerStyle = window.getComputedStyle(innerChild);
                    if (innerStyle.position === 'absolute' || innerStyle.position === 'fixed') {
                        continue;
                    }
                    innerFlowChildrenCount++;
                    
                    const innerGrid = innerChild.classList.contains('game-board-grid') ? innerChild : innerChild.querySelector('.game-board-grid');
                    if (!innerGrid) {
                        siblingHeights += innerChild.getBoundingClientRect().height;
                        siblingHeights += (parseFloat(innerStyle.marginTop) || 0) + (parseFloat(innerStyle.marginBottom) || 0);
                    }
                }
                if (innerFlowChildrenCount > 1 && (innerComputed.display === 'flex' || innerComputed.display === 'grid')) {
                    const innerGap = parseFloat(innerComputed.gap) || 0;
                    siblingHeights += innerGap * (innerFlowChildrenCount - 1);
                }
            } else {
                siblingHeights += child.getBoundingClientRect().height;
                siblingHeights += (parseFloat(childStyle.marginTop) || 0) + (parseFloat(childStyle.marginBottom) || 0);
            }
        }
        
        let containerGap = 0;
        if (flowChildrenCount > 1 && (computedStyle.display === 'flex' || computedStyle.display === 'grid')) {
            const gapVal = parseFloat(computedStyle.gap) || 0;
            containerGap = gapVal * (flowChildrenCount - 1);
        }
        
        const availableHeight = containerRect.height - containerPadding - siblingHeights - containerGap - 8;
        const availableWidth = containerRect.width - (parseFloat(computedStyle.paddingLeft) || 0) - (parseFloat(computedStyle.paddingRight) || 0) - 16;

        setGridDimensions({
            maxWidth: Math.max(150, availableWidth),
            maxHeight: Math.max(150, availableHeight)
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
        
        const handleViewportResize = () => {
            updateDimensions();
        };
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportResize);
            window.visualViewport.addEventListener('scroll', handleViewportResize);
        }
        
        updateDimensions();
        return () => {
            observer.disconnect();
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
        <div ref={containerRef} className="gameplay-container flex-1 flex flex-col justify-between min-h-0 w-full px-2 pt-2 pb-0.5 sm:pt-2 sm:pb-1 gap-2 sm:gap-4">

            <div className="flex-1 flex items-center justify-center min-h-0 w-full relative">
                <div className="relative">
                    <Grid
                        wordLength={wordLength}
                        maxAttempts={maxAttempts}
                        guesses={guesses}
                        currentGuess={currentGuess}
                        cursorIndex={cursorIndex}
                        editIndex={editIndex}
                        hintRecord={hintRecord}
                        isShake={isShake}
                        isSaving={isSaving}
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
                <div ref={keyboardRef} className="w-full max-w-[500px] mx-auto pb-0.5 pt-2 sm:pt-2 shrink-0 px-2">
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
        </div>
    );
};
