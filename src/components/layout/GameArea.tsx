import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import type { GuessResult, LetterStatus } from '../../types/game';

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
    onEnter
}: GameAreaProps) => {
    const wasGameOverOnMount = useRef(isGameOver);
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
            setHideKeyboard(false);
            wasGameOverOnMount.current = false;
        }
    }, [isGameOver]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 gap-3 sm:gap-4">
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
