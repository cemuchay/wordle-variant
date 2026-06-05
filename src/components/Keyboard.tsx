import React, { memo } from 'react';
import type { LetterStatus } from '../types/game';
import { Delete } from 'lucide-react';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DELETE'],
];

interface KeyProps {
  char: string;
  status?: LetterStatus;
  onClick: (char: string) => void;
  compact?: boolean;
}

const Key = memo(({ char, status, onClick, compact }: KeyProps) => {
  const isWide = char === 'ENTER' || char === 'DELETE';

  const getStyle = () => {
    switch (status) {
      case 'correct': return 'bg-correct border-correct text-white';
      case 'present': return 'bg-present border-present text-white';
      case 'absent': return 'bg-absent border-absent text-white';
      default: return 'bg-default border-gray-600 text-white';
    }
  };

  const dynamicClass = compact
    ? `${isWide ? 'px-1.5 text-[9px] min-w-[50px] sm:min-w-[58px]' : 'flex-1 min-w-[24px] sm:min-w-[28px]'} h-10 sm:h-11`
    : `${isWide ? 'px-2 text-[10px] min-w-[55px] sm:min-w-[65px]' : 'flex-1 min-w-[28px] sm:min-w-[32px]'} h-12 sm:h-10`;

  return (
    <button
      type="button"
      className={`
        ${dynamicClass}
        rounded-md font-bold transition-all border-b-2
        flex items-center justify-center uppercase
        cursor-pointer hover:brightness-110 active:translate-y-0.5 active:border-b-0
        ${getStyle()}
      `}
      onClick={(e) => {
        e.preventDefault();
        onClick(char);
      }}
    >
      {char === 'DELETE' ? <Delete size={18} /> : char}
    </button>
  );
});

Key.displayName = 'Key';

interface Props {
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  letterStatuses: Record<string, LetterStatus>;
  compact?: boolean;
}

export const Keyboard: React.FC<Props> = memo(({ onChar, onDelete, onEnter, letterStatuses, compact }) => {
  const handleKeyClick = React.useCallback((key: string) => {
    if (key === 'ENTER') onEnter();
    else if (key === 'DELETE') onDelete();
    else onChar(key);
  }, [onEnter, onDelete, onChar]);

  return (
    <div className={`game-keyboard w-full max-w-[500px] mx-auto px-1 select-none shrink-0 ${compact ? 'pb-0.5' : 'pb-2'}`}>
      {ROWS.map((row, i) => (
        <div key={i} className={`flex justify-center ${compact ? 'mb-1 gap-0.5 sm:gap-1' : 'mb-1.5 gap-1 sm:gap-1.5'}`}>
          {row.map((key) => (
            <Key
              key={key}
              char={key}
              status={letterStatuses[key]}
              onClick={handleKeyClick}
              compact={compact}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

Keyboard.displayName = 'Keyboard';