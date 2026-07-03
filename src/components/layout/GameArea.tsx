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
        const containerRect = containerRef.current.getBoundingClientRect();
        
        let keyboardHeight = 0;
        if (keyboardRef.current && !hideKeyboard) {
            keyboardHeight = keyboardRef.current.getBoundingClientRect().height;
        }
        
        const paddingBuffer = 48;
        const availableHeight = containerRect.height - keyboardHeight - paddingBuffer;
        const availableWidth = containerRect.width - 24;

        setGridDimensions({
            maxWidth: Math.max(150, availableWidth),
            maxHeight: Math.max(150, availableHeight)
        });
    }, [hideKeyboard]);

    useEffect(() => {
        if (!containerRef.current) return;
        
        const observer = new ResizeObserver(() => {
            updateDimensions();
        });
        observer.observe(containerRef.current);
        if (keyboardRef.current) {
            observer.observe(keyboardRef.current);
        }
        
        updateDimensions();
        return () => observer.disconnect();
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

            <div className="flex-1 flex items-center justify-center min-h-0 w-full relative pt-6 sm:pt-2">
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
