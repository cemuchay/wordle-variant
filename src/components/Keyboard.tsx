import React from 'react';
import type { LetterStatus } from '../types/game';
import { Delete, CornerDownLeft } from 'lucide-react';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DELETE'],
];

interface Props {
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  letterStatuses: Record<string, LetterStatus>;
}

export const Keyboard: React.FC<Props> = ({ onChar, onDelete, onEnter, letterStatuses }) => {
  const getKeyStyle = (key: string) => {
    const status = letterStatuses[key];
    // In Tailwind 4, ensure these variables are defined in index.css @theme
    switch (status) {
      case 'correct': return 'bg-correct border-correct text-white';
      case 'present': return 'bg-present border-present text-white';
      case 'absent': return 'bg-absent border-absent text-white';
      default: return 'bg-gray-700 border-gray-600 text-white'; // High contrast dark gray
    }
  };

  return (
    <div className="w-full max-w-[500px] mt-auto pb-8 px-2 select-none">
      {ROWS.map((row, i) => (
        <div key={i} className="flex justify-center mb-2 gap-1.5">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'DELETE';
            return (
              <button
                key={key}

                className={`
    ${isWide ? 'px-4 text-[11px] min-w-[65px]' : 'flex-1 min-w-[32px]'}
    h-14 rounded-md font-bold transition-all border-b-2
    flex items-center justify-center uppercase
    cursor-pointer hover:brightness-110 active:translate-y-0.5 active:border-b-0
    ${getKeyStyle(key)}
  `}
                onClick={(e) => {
                  e.preventDefault(); // Prevent focus issues on mobile
                  if (key === 'ENTER') onEnter();
                  else if (key === 'DELETE') onDelete();
                  else onChar(key);
                }}

              >
                {key === 'DELETE' ? <Delete size={18} /> :
                  key === 'ENTER' ? <CornerDownLeft size={18} /> : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};