/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import type { GuessResult, LetterStatus } from '../../types/game';
import { ANIMATION_DURATION } from '../../constants/ui';
import { MarathonBanner } from '../common/MarathonBanner';
import { useApp } from '../../context/AppContext';

interface GameAreaProps {
    wordLength: number;
    maxAttempts: number;
    guesses: GuessResult[][];
    currentGuess: string;
    cursorIndex?: number;
    letterStatuses: Record<string, LetterStatus>;
    hintRecord: { letter: string; index: number; row?: number } | null;
    isGameOver: boolean;
    isShake?: boolean;
    isSaving?: boolean;
    onChar: (char: string) => void;
    onDelete: () => void;
    onEnter: () => void;
    onSetCursor?: (index: number) => void;
    activeDailyMarathons: any[];
    setIsChallengeOpen: any;
    setSelectedChallengeId: any;
    isAuthenticated: boolean;
}

export const GameArea = ({
    wordLength,
    maxAttempts,
    guesses,
    currentGuess,
    cursorIndex,
    letterStatuses,
    hintRecord,
    isGameOver,
    isShake,
    isSaving,
    onChar,
    onDelete,
    onEnter,
    onSetCursor,
    activeDailyMarathons,
    setIsChallengeOpen,
    setSelectedChallengeId,
    isAuthenticated,
}: GameAreaProps) => {
    const { preferences } = useApp();
    const wasGameOverOnMount = useRef(isGameOver);
    // eslint-disable-next-line react-hooks/refs
    const [hideKeyboard, setHideKeyboard] = useState(wasGameOverOnMount.current);
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
        if (isGameOver) {
            if (wasGameOverOnMount.current) {
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
    }, [isGameOver, wordLength]);

    return (
        <div className="gameplay-container flex-1 flex flex-col justify-between min-h-0 w-full px-2 pt-2 pb-0.5 sm:pt-2 sm:pb-1 gap-2 sm:gap-4">
            {isGameOver && activeDailyMarathons.length > 0 && hideKeyboard && isAuthenticated && (
                <div className="mb-2 mx-auto w-full max-w-md shrink-0">
                    <MarathonBanner
                        challenges={activeDailyMarathons}
                        onClick={(challenge) => {
                            setSelectedChallengeId(challenge.id);
                            setIsChallengeOpen(true);
                        }}
                    />
                </div>
            )}


            <div className="flex-1 flex items-center justify-center min-h-0 w-full relative pt-6">
                <div className="relative">
                    <Grid
                        wordLength={wordLength}
                        maxAttempts={maxAttempts}
                        guesses={guesses}
                        currentGuess={currentGuess}
                        cursorIndex={cursorIndex}
                        hintRecord={hintRecord}
                        isShake={isShake}
                        isSaving={isSaving}
                        compact={preferences.compactMode}
                        gameplayType="regular"
                        onSetCursor={onSetCursor}
                    />

                    {/* Help Icon Popover Nudge */}
                    <div className="absolute -right-7 top-0 sm:-right-8" ref={helpRef}>
                        <button
                            onClick={() => setShowHelp(!showHelp)}
                            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all cursor-pointer focus:outline-none"
                            title="Quick rules"
                        >
                            <HelpCircle size={15} />
                        </button>

                        {showHelp && (
                            <div className="absolute right-0 mt-2 z-50 w-56 bg-gray-900/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-2xl text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-correct">Quick Rules</span>
                                    <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                                        <X size={10} />
                                    </button>
                                </div>
                                <p className="text-[9px] text-gray-400 uppercase font-black tracking-wide mb-2 leading-relaxed">
                                    Guess the word in {maxAttempts} tries. Colors show status:
                                </p>
                                <ul className="text-[9px] text-gray-300 space-y-1 font-black uppercase tracking-wide">
                                    <li className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-correct shrink-0 border border-white/10" />
                                        <span>Correct Spot</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-present shrink-0 border border-white/10" />
                                        <span>Wrong Spot</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-absent shrink-0 border border-white/10" />
                                        <span>Not In Word</span>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!hideKeyboard && (
                <div className="w-full max-w-[500px] mx-auto pb-0.5 pt-2 sm:pt-8 shrink-0 px-2">
                    <Keyboard
                        onChar={onChar}
                        onDelete={onDelete}
                        onEnter={onEnter}
                        letterStatuses={keyboardStatuses}
                        gameplayType="regular"
                    />
                </div>
            )}
        </div>
    );
};
