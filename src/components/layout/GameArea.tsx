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
    onChar,
    onDelete,
    onEnter
}: GameAreaProps) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-2 gap-4">
            <div className="scale-[0.85] sm:scale-100 transition-transform origin-center">
                {guesses.length === 0 && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <p className="text-[14px] text-gray-400 tracking-tighter">Enter any {wordLength} letter word ...</p>
                    </div>
                )}
                <Grid
                    wordLength={wordLength}
                    maxAttempts={maxAttempts}
                    guesses={guesses}
                    currentGuess={currentGuess}
                    hintRecord={hintRecord}
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
