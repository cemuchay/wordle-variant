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
  gameplayType?: 'regular' | 'challenge';
  wordLength: number;
}

const Cell = memo(({ letter, status, isRevealing, revealIndex = 0, isShake, isPop, isHinted, compact, gameplayType, wordLength }: CellProps) => {
  const isChallenge = gameplayType === 'challenge' || compact;

  // Dynamic scaling based on word length to optimize mobile real estate
  let sizeClass: string;
  if (isChallenge) {
    if (wordLength <= 4) {
      sizeClass = 'w-[12vw] h-[12vw] max-w-[48px] max-h-[48px] sm:w-[5.8vh] sm:h-[5.8vh] sm:max-w-[52px] sm:max-h-[52px] text-lg';
    } else if (wordLength === 5) {
      sizeClass = 'w-[10vw] h-[10vw] max-w-[42px] max-h-[42px] sm:w-[5.2vh] sm:h-[5.2vh] sm:max-w-[48px] sm:max-h-[48px] text-base sm:text-lg';
    } else if (wordLength === 6) {
      sizeClass = 'w-[8.5vw] h-[8.5vw] max-w-[38px] max-h-[38px] sm:w-[4.8vh] sm:h-[4.8vh] sm:max-w-[44px] sm:max-h-[44px] text-sm sm:text-base';
    } else { // 7+
      sizeClass = 'w-[7.5vw] h-[7.5vw] max-w-[34px] max-h-[34px] sm:w-[4.2vh] sm:h-[4.2vh] sm:max-w-[40px] sm:max-h-[40px] text-xs sm:text-sm';
    }
  } else { // regular mode
    if (wordLength <= 3) {
      sizeClass = 'w-[22vw] h-[22vw] max-w-[82px] max-h-[82px] sm:w-[8.5vh] sm:h-[8.5vh] sm:max-w-[86px] sm:max-h-[86px] lg:w-[7.5vh] lg:h-[7.5vh] lg:max-w-[76px] lg:max-h-[76px] text-3xl';
    } else if (wordLength === 4) {
      sizeClass = 'w-[18vw] h-[18vw] max-w-[70px] max-h-[70px] sm:w-[7.5vh] sm:h-[7.5vh] sm:max-w-[74px] sm:max-h-[74px] lg:w-[6.2vh] lg:h-[6.2vh] lg:max-w-[62px] lg:max-h-[62px] text-2xl';
    } else if (wordLength === 5) {
      sizeClass = 'w-[15vw] h-[15vw] max-w-[62px] max-h-[62px] sm:w-[6.5vh] sm:h-[6.5vh] sm:max-w-[58px] sm:max-h-[58px] lg:w-[5.2vh] lg:h-[5.2vh] lg:max-w-[52px] lg:max-h-[52px] text-xl sm:text-2xl';
    } else if (wordLength === 6) {
      sizeClass = 'w-[12vw] h-[12vw] max-w-[54px] max-h-[54px] sm:w-[5.8vh] sm:h-[5.8vh] sm:max-w-[50px] sm:max-h-[50px] lg:w-[4.6vh] lg:h-[4.6vh] lg:max-w-[46px] lg:max-h-[46px] text-lg sm:text-xl';
    } else { // 7+
      sizeClass = 'w-[10.5vw] h-[10.5vw] max-w-[48px] max-h-[48px] sm:w-[5.2vh] sm:h-[5.2vh] sm:max-w-[44px] sm:max-h-[44px] lg:w-[4.2vh] lg:h-[4.2vh] lg:max-w-[40px] lg:max-h-[40px] text-base sm:text-lg';
    }
  }

  const tileClass = `
    ${sizeClass}
    flex items-center justify-center 
    font-bold uppercase transition-colors duration-300
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
  gameplayType?: 'regular' | 'challenge';
}

export const Grid: React.FC<GridProps> = memo(({ wordLength, maxAttempts, guesses, currentGuess, hintRecord, isChallengeMode, isShake, isSaving, compact, gameplayType }) => {
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
    animationClass = "animate-bounce text-correct";
  } else if (isLost) {
    mascotFace = "(✖╭╮✖)";
    mascotLabel = "Aww, maybe next time! 😢";
    animationClass = "text-red-400";
  } else if (isOneAttemptLeft) {
    mascotFace = "(⊙_⊙;)";
    mascotLabel = "Yikes! Only 1 guess left! 😰";
    animationClass = "animate-pulse text-amber-400";
  } else if (hasRepeatedLetters) {
    mascotFace = "(🤨)";
    mascotLabel = "Hmm... interesting choice. 🧐";
    animationClass = "animate-shake text-yellow-400";
  } else if (attemptsCount > 0) {
    const defaultMascots = [
      { face: "(•_•)", label: "Thinking..." },
      { face: "(o_O)", label: "Let's see..." },
      { face: "(^_-)", label: "Keep going! 😉" }
    ];
    const idx = (attemptsCount - 1) % defaultMascots.length;
    mascotFace = defaultMascots[idx].face;
    mascotLabel = defaultMascots[idx].label;
    animationClass = "text-white/80";
  } else {
    animationClass = "text-white/60";
  }

  useEffect(() => {
    // Notify Dynamic Island about the mascot state update
    window.dispatchEvent(new CustomEvent('mascot-changed', {
      detail: { mascotFace, mascotLabel, animationClass }
    }));
    return () => {
      // Clear mascot when Grid is unmounted (e.g. user leaves play tab)
      window.dispatchEvent(new CustomEvent('mascot-changed', {
        detail: null
      }));
    };
  }, [mascotFace, mascotLabel, animationClass]);

  return (
    <div className="relative mx-auto w-fit select-none shrink-0">
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
              gameplayType={gameplayType}
              wordLength={wordLength}
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
                gameplayType={gameplayType}
                wordLength={wordLength}
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
                  gameplayType={gameplayType}
                  wordLength={wordLength}
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
