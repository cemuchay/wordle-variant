/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Sparkles, X } from 'lucide-react';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import type { GuessResult, LetterStatus } from '../../types/game';
import { motion } from 'framer-motion';

interface GameAreaProps {
    wordLength: number;
    maxAttempts: number;
    guesses: GuessResult[][];
    currentGuess: string;
    letterStatuses: Record<string, LetterStatus>;
    hintRecord: { letter: string; index: number; row?: number } | null;
    isGameOver: boolean;
    isShake?: boolean;
    isSaving?: boolean;
    onChar: (char: string) => void;
    onDelete: () => void;
    onEnter: () => void;
    activeDailyMarathon: any;
    setIsChallengeOpen: any;
    setSelectedChallengeId: any;
    isAuthenticated: boolean;
}

export const GameArea = ({
    wordLength,
    maxAttempts,
    guesses,
    currentGuess,
    letterStatuses,
    hintRecord,
    isGameOver,
    isShake,
    isSaving,
    onChar,
    onDelete,
    onEnter,
    activeDailyMarathon,
    setIsChallengeOpen,
    setSelectedChallengeId,
    isAuthenticated,
}: GameAreaProps) => {
    const wasGameOverOnMount = useRef(isGameOver);
    // eslint-disable-next-line react-hooks/refs
    const [hideKeyboard, setHideKeyboard] = useState(wasGameOverOnMount.current);
    const [showHelp, setShowHelp] = useState(false);
    const helpRef = useRef<HTMLDivElement>(null);

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
                const timer = setTimeout(() => {
                    setHideKeyboard(true);
                }, 2200);
                return () => clearTimeout(timer);
            }
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHideKeyboard(false);
            wasGameOverOnMount.current = false;
        }
    }, [isGameOver]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 gap-3 sm:gap-4">
            {isGameOver && activeDailyMarathon && hideKeyboard && isAuthenticated && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 mx-auto w-full max-w-md bg-linear-to-r from-violet-600/20 via-indigo-600/20 to-blue-600/20 border border-indigo-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden group hover:border-indigo-400/50 transition-colors duration-300"
                >
                    <div className="absolute inset-0 bg-linear-to-r from-violet-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="flex items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
                                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                        Active Marathon
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        Daily Challenge
                                    </span>
                                </div>
                                <h3 className="text-sm font-bold mt-1 text-white tracking-wide">
                                    Bot Marathon Event
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Test your skills across multiple word lengths!
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setSelectedChallengeId(activeDailyMarathon.id);
                                setIsChallengeOpen(true);
                            }}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                            Play
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="relative">
                <Grid
                    wordLength={wordLength}
                    maxAttempts={maxAttempts}
                    guesses={guesses}
                    currentGuess={currentGuess}
                    hintRecord={hintRecord}
                    isShake={isShake}
                    isSaving={isSaving}
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

            {!hideKeyboard && (
                <div className="w-full max-w-125 mx-auto pb-4 sm:pb-6 shrink-0">
                    <Keyboard
                        onChar={onChar}
                        onDelete={onDelete}
                        onEnter={onEnter}
                        letterStatuses={letterStatuses}
                    />
                </div>
            )}
        </div>
    );
};
