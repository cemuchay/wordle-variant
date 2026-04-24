import React from 'react';
import type { GuessResult } from '../types/game';

interface GridProps {
  wordLength: number;
  maxAttempts: number;
  guesses: GuessResult[][];
  currentGuess: string;
}

export const Grid: React.FC<GridProps> = ({ wordLength, maxAttempts, guesses, currentGuess }) => {
  const empties = maxAttempts - guesses.length - 1;

  return (
    <div 
      className="grid gap-2 mb-8 mx-auto" 
      style={{ 
        gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))`,
        width: `${wordLength * 60}px`,
        maxWidth: '100%'
      }}
    >
      {/* Past Guesses */}
      {guesses.map((guess, i) => (
        guess.map((res, j) => (
          <div key={`${i}-${j}`} className={`w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold uppercase
            ${res.status === 'correct' ? 'bg-correct border-correct' : 
              res.status === 'present' ? 'bg-present border-present' : 
              'bg-absent border-absent'}`}>
            {res.letter}
          </div>
        ))
      ))}

      {/* Current Guess Row */}
      {guesses.length < maxAttempts && (
        Array.from({ length: wordLength }).map((_, i) => (
          <div key={`current-${i}`} className="w-14 h-14 border-2 border-gray-600 flex items-center justify-center text-2xl font-bold uppercase">
            {currentGuess[i] || ''}
          </div>
        ))
      )}

      {/* Empty Rows */}
      {Array.from({ length: Math.max(0, empties) }).map((_, i) => (
        Array.from({ length: wordLength }).map((_, j) => (
          <div key={`empty-${i}-${j}`} className="w-14 h-14 border-2 border-gray-800 flex items-center justify-center"></div>
        ))
      ))}
    </div>
  );
};