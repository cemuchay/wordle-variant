import React from 'react';
import type { LetterStatus } from '../types/game';
import { Delete, } from 'lucide-react';

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
    switch (status) {
      case 'correct': return 'bg-correct border-correct text-white';
      case 'present': return 'bg-present border-present text-white';
      case 'absent': return 'bg-absent border-absent text-white';
      default: return 'bg-default border-gray-600 text-white';
    }
  };

  return (
    /* mt-auto removed, controlled by App container. pb-2 for tighter fit */
    <div className="w-full max-w-[500px] mx-auto px-1 select-none shrink-0 pb-2">
      {ROWS.map((row, i) => (
        <div key={i} className="flex justify-center mb-1.5 gap-1 sm:gap-1.5">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'DELETE';
            return (
              <button
                key={key}
                type="button"
                className={`
                  ${isWide ? 'px-2 text-[10px] min-w-[55px] sm:min-w-[65px]' : 'flex-1 min-w-[28px] sm:min-w-[32px]'}
                  h-12 sm:h-13 rounded-md font-bold transition-all border-b-2
                  flex items-center justify-center uppercase
                  cursor-pointer hover:brightness-110 active:translate-y-0.5 active:border-b-0
                  ${getKeyStyle(key)}
                `}
                onClick={(e) => {
                  e.preventDefault();
                  if (key === 'ENTER') onEnter();
                  else if (key === 'DELETE') onDelete();
                  else onChar(key);
                }}
              >
                {key === 'DELETE' ? <Delete size={18} /> : 
                //  key === 'ENTER' ? <CornerDownLeft size={18} /> : key}
                    key === 'ENTER' ? key : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};