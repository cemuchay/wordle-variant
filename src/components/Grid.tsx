import React, { memo } from 'react';
import type { GuessResult } from '../types/game';

interface GridProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
  hintRecord?: { letter: string, index: number } | null;
  isChallengeMode?: boolean;
  isShake?: boolean;
}

export const Grid: React.FC<GridProps> = memo(({ wordLength, maxAttempts, guesses, currentGuess, hintRecord, isChallengeMode, isShake }) => {
  const empties = Math.max(0, maxAttempts - guesses.length - 1);

  // Responsive Tile Size logic
  const tileClass = `
    w-[11vw] h-[11vw] 
    max-w-[55px] max-h-[55px] 
    sm:w-[6vh] sm:h-[6vh] 
    sm:max-w-[62px] sm:max-h-[62px] 
    flex items-center justify-center 
    text-xl sm:text-2xl font-bold uppercase transition-colors duration-300
  `;

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
        const isLastRow = i === guesses.length - 1;
        return guess.map((res, j) => (
          <div
            key={`past-${i}-${j}`}
            className={`${tileClass} border-2 text-white
              ${res.status === 'correct' ? 'bg-correct border-correct' :
                res.status === 'present' ? 'bg-present border-present' :
                  'bg-absent border-absent'}
              ${isLastRow ? (
                res.status === 'correct' ? 'animate-reveal-correct' :
                  res.status === 'present' ? 'animate-reveal-present' :
                    'animate-reveal-absent'
              ) : ''}`}
            style={isLastRow ? { animationDelay: `${j * 150}ms`, animationFillMode: 'both' } : {}}
          >
            {res.letter}
          </div>
        ));
      })}

      {/* Current Guess Row */}
      {guesses.length < maxAttempts && (
        Array.from({ length: wordLength }).map((_, i) => {
          const isHinted = hintRecord?.index === i;
          const letter = currentGuess[i] || (isHinted ? hintRecord?.letter : '');

          return (
            <div
              key={`current-${i}`}
              className={`${tileClass} border-2 text-white 
                ${isShake ? 'animate-shake' : ''}
                ${currentGuess[i] ? 'border-gray-500 animate-pop' : isHinted ? 'border-yellow-600/50 text-yellow-500/50 animate-pulse' : 'border-gray-500'}`}
            >
              {letter}
            </div>
          );
        })
      )}

      {/* Empty Rows */}
      {Array.from({ length: empties }).map((_, i) => (
        <React.Fragment key={`empty-row-${i}`}>
          {Array.from({ length: wordLength }).map((_, j) => {
            const isHinted = hintRecord?.index === j;
            return (
              <div
                key={`empty-${i}-${j}`}
                className={`${tileClass} border-2 
                  ${isHinted ? 'border-yellow-600/20 text-yellow-500/30' : 'border-gray-800'}`}
              >
                {isHinted ? hintRecord?.letter : ''}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
});