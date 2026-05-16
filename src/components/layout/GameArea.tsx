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
    onChar,
    onDelete,
    onEnter
}: GameAreaProps) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 gap-4">
            <div className="scale-[0.85] sm:scale-100 transition-transform origin-center relative">
                {guesses.length === 0 && (
                    <div className="absolute -top-14 sm:-top-8 left-0 right-0 flex items-center justify-center pointer-events-none">
                        <p className="text-[10px] sm:text-[14px] text-gray-500 font-bold uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2 duration-700">
                            Enter any {wordLength} letter word
                        </p>
                    </div>
                )}
                <Grid
                    wordLength={wordLength}
                    maxAttempts={maxAttempts}
                    guesses={guesses}
                    currentGuess={currentGuess}
                    hintRecord={hintRecord}
                    isShake={isShake}
                />
            </div>

            {!isGameOver && (
                <div className="w-full max-w-125 mx-auto pt-2 pb-2 shrink-0">
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
