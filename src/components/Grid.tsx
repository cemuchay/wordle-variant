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

// Sizing config supporting different widths/heights for mobile and desktop (sm)
const TILE_SIZES = [
  {
    length: 3,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 4,
    small: { w: 1.78, h: 1.78 },
    mobile: { w: 2.1, h: 2.1 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 5,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 6,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 7,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 8,
    small: { w: 1.87, h: 1.87 },
    mobile: { w: 2.2, h: 2.2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 9,
    small: { w: 1.7, h: 1.7 },
    mobile: { w: 2, h: 2 },
    desktop: { w: 2, h: 2 }
  },
  {
    length: 10,
    small: { w: 1.7, h: 1.7 },
    mobile: { w: 2, h: 2 },
    desktop: { w: 2, h: 2 }
  },
];



// A simple custom hook to check for responsive breakpoints
const useIsResponsive = () => {
  const [state, setState] = useState({
    isDesktop: window.innerWidth >= 640,
    isSmall: window.innerWidth <= 375
  });

  useEffect(() => {
    const handleResize = () => setState({
      isDesktop: window.innerWidth >= 640,
      isSmall: window.innerWidth <= 375
    });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
};

const Cell = memo(({ letter, status, isRevealing, revealIndex = 0, isShake, isPop, isHinted, compact, gameplayType, wordLength }: CellProps) => {
  const isChallenge = gameplayType === 'challenge' || compact;
  const { isDesktop, isSmall } = useIsResponsive(); // Detect responsive state

  // 1. Get the current size profile based on word length
  const sizeConfig = TILE_SIZES.find((s) => s.length === wordLength) || TILE_SIZES[TILE_SIZES.length - 1];

  // 2. Select dimensions based on device size
  const dimensions = isDesktop ? sizeConfig.desktop : (isSmall ? sizeConfig.small : sizeConfig.mobile);

  // 3. Optional: If challenge mode needs a slight reduction scale (e.g., 85% size)
  const scale = isChallenge ? 0.85 : 1;
  const finalWidth = dimensions.w * scale;
  const finalHeight = dimensions.h * scale;

  const tileClass = `
    flex items-center justify-center 
    font-bold uppercase transition-colors duration-300
    border-2 text-white rounded-md
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

  // 4. Inject responsive widths and heights into inline styles
  const style: React.CSSProperties = {
    width: `${finalWidth}rem`,
    height: `${finalHeight}rem`,
    fontSize: `${finalWidth * 0.5}rem`, // Font sizes scale fluidly with width
    ...(isRevealing ? {
      animationDelay: `${revealIndex * ANIMATION_DURATION.TILE_REVEAL}ms`,
      animationFillMode: 'both'
    } : {})
  };

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
