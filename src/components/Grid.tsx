import React, { memo, useState, useEffect, useRef } from 'react';
import type { GuessResult } from '../types/game';
import { ANIMATION_DURATION } from '../constants/ui';

interface CellProps {
  letter: string;
  status?: 'correct' | 'present' | 'absent' | 'default' | 'empty';
  isRevealing?: boolean;
  revealIndex?: number;
  isShake?: boolean;
  isPop?: boolean;
  isHinted?: boolean;
  isSaving?: boolean;
}

const Cell = memo(({ letter, status, isRevealing, revealIndex = 0, isShake, isPop, isHinted }: CellProps) => {
  const tileClass = `
    w-[11vw] h-[11vw] 
    max-w-[55px] max-h-[55px] 
    sm:w-[6vh] sm:h-[6vh] 
    sm:max-w-[62px] sm:max-h-[62px] 
    flex items-center justify-center 
    text-xl sm:text-2xl font-bold uppercase transition-colors duration-300
    border-2 text-white
  `;

  let statusClass = 'border-gray-800';
  let animationClass = '';

  if (status === 'correct') statusClass = 'bg-correct border-correct';
  else if (status === 'present') statusClass = 'bg-present border-present';
  else if (status === 'absent') statusClass = 'bg-absent border-absent';
  else if (letter) statusClass = 'border-gray-500';

  if (isRevealing) {
    if (status === 'correct') animationClass = 'animate-reveal-correct';
    else if (status === 'present') animationClass = 'animate-reveal-present';
    else if (status === 'absent') animationClass = 'animate-reveal-absent';
  } else if (isPop) {
    animationClass = 'animate-pop';
  } else if (isShake) {
    animationClass = 'animate-shake';
  } else if (isHinted) {
    animationClass = 'animate-pulse text-yellow-500/50 border-yellow-600/50';
  }

  const style = isRevealing
    ? { animationDelay: `${revealIndex * ANIMATION_DURATION.TILE_REVEAL}ms`, animationFillMode: 'both' }
    : {};

  return (
    <div className={`${tileClass} ${statusClass} ${animationClass}`} style={style}>
      {letter}
    </div>
  );
});

Cell.displayName = 'Cell';

interface GridProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
  hintRecord?: { letter: string, index: number } | null;
  isChallengeMode?: boolean;
  isShake?: boolean;
  isSaving?: boolean;
}

export const Grid: React.FC<GridProps> = memo(({ wordLength, maxAttempts, guesses, currentGuess, hintRecord, isChallengeMode, isShake, isSaving }) => {
  const [revealingRowIndex, setRevealingRowIndex] = useState<number | null>(null);
  const prevGuessesLength = useRef(guesses.length);

  useEffect(() => {
    if (guesses.length > prevGuessesLength.current) {
      setRevealingRowIndex(guesses.length - 1);
      const timer = setTimeout(() => {
        setRevealingRowIndex(null);
      }, wordLength * ANIMATION_DURATION.TILE_REVEAL + 400);
      return () => clearTimeout(timer);
    }
    prevGuessesLength.current = guesses.length;
  }, [guesses.length, wordLength]);

  const empties = Math.max(0, maxAttempts - guesses.length - (revealingRowIndex !== null ? 0 : 1));

  return (
    <div
      className={`grid gap-1.5 sm:gap-2 mx-auto h-full items-center content-center p-4 rounded-3xl ${isChallengeMode ? 'bg-correct/5 shadow-[0_0_40px_rgba(0,255,0,0.1)] border border-correct/20' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))`,
        width: 'max-content'
      }}
    >
      {/* Past Guesses */}
      {guesses.map((guess, i) => {
        const isRevealing = i === revealingRowIndex;
        return guess.map((res, j) => (
          <Cell
            key={`past-${i}-${j}`}
            letter={res.letter}
            status={res.status}
            isRevealing={isRevealing}
            revealIndex={j}
          />
        ));
      })}

      {/* Current Guess Row */}
      {guesses.length < maxAttempts && revealingRowIndex === null && (
        Array.from({ length: wordLength }).map((_, i) => {
          const isHinted = !isSaving && hintRecord?.index === i;
          const letter = currentGuess[i] || (isHinted ? hintRecord?.letter : '');

          return (
            <Cell
              key={`current-${i}`}
              letter={letter}
              isPop={!!currentGuess[i]}
              isShake={isShake}
              isHinted={isHinted}
            />
          );
        })
      )}

      {/* Empty Rows */}
      {Array.from({ length: empties }).map((_, i) => (
        <React.Fragment key={`empty-row-${i}`}>
          {Array.from({ length: wordLength }).map((_, j) => {
            const isHinted = !isSaving && hintRecord?.index === j;
            return (
              <Cell
                key={`empty-${i}-${j}`}
                letter={isHinted ? hintRecord?.letter : ''}
                isHinted={isHinted}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
});

Grid.displayName = 'Grid';