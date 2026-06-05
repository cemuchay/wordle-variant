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
  compact?: boolean;
}

const Cell = memo(({ letter, status, isRevealing, revealIndex = 0, isShake, isPop, isHinted, compact }: CellProps) => {
  const tileClass = compact
    ? `
      w-[9vw] h-[9vw] 
      max-w-[40px] max-h-[40px] 
      sm:w-[5vh] sm:h-[5vh] 
      sm:max-w-[46px] sm:max-h-[46px] 
      flex items-center justify-center 
      text-lg sm:text-xl font-bold uppercase transition-colors duration-300
      border-2 text-white
    `
    : `
      w-[10vw] h-[10vw] 
      max-w-[48px] max-h-[48px] 
      sm:w-[5.5vh] sm:h-[5.5vh] 
      sm:max-w-[54px] sm:max-h-[54px] 
      flex items-center justify-center 
      text-lg sm:text-xl font-bold uppercase transition-colors duration-300
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
  } else if (isShake) {
    animationClass = 'animate-shake';
  } else if (isPop) {
    animationClass = 'animate-pop';
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
  compact?: boolean;
}

export const Grid: React.FC<GridProps> = memo(({ wordLength, maxAttempts, guesses, currentGuess, hintRecord, isChallengeMode, isShake, isSaving, compact }) => {
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
      className={`game-board-grid grid mx-auto h-fit max-h-full items-center content-center rounded-2xl ${isChallengeMode ? 'bg-correct/5 shadow-[0_0_30px_rgba(0,255,0,0.08)] border border-correct/20' : ''} ${compact ? 'gap-1 sm:gap-1.5 p-2' : 'gap-1.5 sm:gap-2 p-4'}`}
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
            compact={compact}
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
              compact={compact}
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
                compact={compact}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
});

Grid.displayName = 'Grid';