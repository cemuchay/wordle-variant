import React, { memo, useState, useEffect } from 'react';
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
  const [revealedRowsCount, setRevealedRowsCount] = useState(guesses.length);

  useEffect(() => {
    if (guesses.length > revealedRowsCount) {
      const timer = setTimeout(() => {
        setRevealedRowsCount(guesses.length);
      }, wordLength * ANIMATION_DURATION.TILE_REVEAL + 400);
      return () => clearTimeout(timer);
    } else if (guesses.length < revealedRowsCount) {
      setRevealedRowsCount(guesses.length);
    }
  }, [guesses.length, revealedRowsCount, wordLength]);

  const isCurrentRevealing = guesses.length > revealedRowsCount;
  const revealingRowIndex = isCurrentRevealing ? guesses.length - 1 : null;
  const empties = Math.max(0, maxAttempts - guesses.length - (revealingRowIndex !== null ? 0 : 1));

  // Mascot Face Reactions
  const attemptsCount = guesses.length;
  const isOneAttemptLeft = attemptsCount === maxAttempts - 1 && revealingRowIndex === null;
  const isWon = guesses.some(g => g.length === wordLength && g.every(res => res.status === 'correct'));
  const isLost = !isWon && attemptsCount === maxAttempts && revealingRowIndex === null;

  const lastGuess = guesses[guesses.length - 1];
  let hasRepeatedLetters = false;
  if (lastGuess) {
    const charCounts: Record<string, number> = {};
    for (const res of lastGuess) {
      if (res.letter) {
        const char = res.letter.toUpperCase();
        charCounts[char] = (charCounts[char] || 0) + 1;
        if (charCounts[char] >= 3) {
          hasRepeatedLetters = true;
          break;
        }
      }
    }
  }

  let mascotFace = "(•‿•)";
  let mascotLabel = "Looking good!";
  let animationClass = "";

  if (isWon) {
    mascotFace = "(★‿★)";
    mascotLabel = "Splendid job! 🎉";
    animationClass = "animate-bounce text-correct border-correct/30 bg-correct/10";
  } else if (isLost) {
    mascotFace = "(✖╭╮✖)";
    mascotLabel = "Aww, maybe next time! 😢";
    animationClass = "text-red-500 border-red-500/30 bg-red-500/10";
  } else if (isOneAttemptLeft) {
    mascotFace = "(⊙_⊙;)";
    mascotLabel = "Yikes! Only 1 guess left! 😰";
    animationClass = "animate-pulse scale-105 text-amber-500 border-amber-500/40 bg-amber-500/10";
  } else if (hasRepeatedLetters) {
    mascotFace = "(🤨)";
    mascotLabel = "Hmm... interesting choice. 🧐";
    animationClass = "animate-shake text-yellow-500 border-yellow-500/40 bg-yellow-500/10";
  } else if (attemptsCount > 0) {
    const defaultMascots = [
      { face: "(•_•)", label: "Thinking..." },
      { face: "(o_O)", label: "Let's see..." },
      { face: "(^_-)", label: "Keep going! 😉" }
    ];
    const idx = (attemptsCount - 1) % defaultMascots.length;
    mascotFace = defaultMascots[idx].face;
    mascotLabel = defaultMascots[idx].label;
    animationClass = "text-white/80 border-white/10 bg-white/5";
  } else {
    animationClass = "text-white/60 border-white/5 bg-white/5";
  }

  return (
    <div className="relative mx-auto w-fit select-none shrink-0">
      {/* Mascot bubble */}
      {!isChallengeMode ? (
        <div 
          className={`absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 border px-3 py-0 rounded-full backdrop-blur-md shadow-sm transition-all duration-300 whitespace-nowrap z-10 ${animationClass}`}
          style={isWon ? { animationIterationCount: 3 } : {}}
        >
          <span className="text-[8px] font-mono font-black select-none tracking-wide">{mascotFace}</span>
          <span className="text-[7px] uppercase font-black tracking-widest opacity-80 select-none">{mascotLabel}</span>
        </div>
      ) : (
        /* In challenge mode, show on top of grid ONLY on mobile (hidden on desktop) */
        <div 
          className={`absolute -top-8 left-1/2 -translate-x-1/2 md:hidden flex items-center gap-1 border px-3 py-0 rounded-full backdrop-blur-md shadow-sm transition-all duration-300 whitespace-nowrap z-10 ${animationClass}`}
          style={isWon ? { animationIterationCount: 3 } : {}}
        >
          <span className="text-[8px] font-mono font-black select-none tracking-wide">{mascotFace}</span>
          <span className="text-[7px] uppercase font-black tracking-widest opacity-80 select-none">{mascotLabel}</span>
        </div>
      )}

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
    </div>
  );
});

Grid.displayName = 'Grid';