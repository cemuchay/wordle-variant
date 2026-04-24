import type { GuessResult } from '../types/game';

export const generateShareText = (
  date: string,
  guesses: GuessResult[][],
  maxAttempts: number,
  won: boolean
) => {
  const score = won ? guesses.length : 'X';
  const header = `Wordle Variant ${date} ${score}/${maxAttempts}\n`;
  
  const grid = guesses.map(row => {
    return row.map(cell => {
      if (cell.status === 'correct') return '🟩';
      if (cell.status === 'present') return '🟨';
      return '⬛'; // Use '⬜' if you prefer light mode friendly
    }).join('');
  }).join('\n');

  return `${header}\n${grid}`;
};