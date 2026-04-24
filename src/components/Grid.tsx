import React from 'react';
import type { GuessResult } from '../types/game';

interface GridProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
}

export const Grid: React.FC<GridProps> = ({ wordLength, maxAttempts, guesses, currentGuess }) => {
  const empties = Math.max(0, maxAttempts - guesses.length - 1);

  // Responsive Tile Size logic:
  // We use vh (viewport height) so it shrinks on shorter screens
  // and max-width/height so it doesn't get huge on ultra-wide monitors.
  const tileClass = `
    w-[11vw] h-[11vw] 
    max-w-[55px] max-h-[55px] 
    sm:w-[6vh] sm:h-[6vh] 
    sm:max-w-[62px] sm:max-h-[62px] 
    flex items-center justify-center 
    text-xl sm:text-2xl font-bold uppercase transition-all duration-300
  `;

  return (
    <div 
      className="grid gap-1.5 sm:gap-2 mx-auto h-full items-center content-center" 
      style={{ 
        gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))`,
        // We remove the hardcoded width and use a max-content constraint
        width: 'max-content'
      }}
    >
      {/* Past Guesses */}
      {guesses.map((guess, i) => (
        guess.map((res, j) => (
          <div 
            key={`past-${i}-${j}`} 
            className={`${tileClass} border-2 
              ${res.status === 'correct' ? 'bg-correct border-correct text-white' : 
                res.status === 'present' ? 'bg-present border-present text-white' : 
                'bg-absent border-absent text-white'}`}
          >
            {res.letter}
          </div>
        ))
      ))}

      {/* Current Guess Row */}
      {guesses.length < maxAttempts && (
        Array.from({ length: wordLength }).map((_, i) => (
          <div 
            key={`current-${i}`} 
            className={`${tileClass} border-2 border-gray-500 text-white animate-pulse`}
          >
            {currentGuess[i] || ''}
          </div>
        ))
      )}

      {/* Empty Rows */}
      {Array.from({ length: empties }).map((_, i) => (
        Array.from({ length: wordLength }).map((_, j) => (
          <div 
            key={`empty-${i}-${j}`} 
            className={`${tileClass} border-2 border-gray-800`}
          ></div>
        ))
      ))}
    </div>
  );
};