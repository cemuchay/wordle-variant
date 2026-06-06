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
  gameplayType?: 'regular' | 'challenge';
}

const Key = memo(({ char, status, onClick, compact, gameplayType }: KeyProps) => {
  const isWide = char === 'ENTER' || char === 'DELETE';

  const getStyle = () => {
    switch (status) {
      case 'correct': return 'bg-correct border-correct text-white';
      case 'present': return 'bg-present border-present text-white';
      case 'absent': return 'bg-absent border-absent text-white';
      default: return 'bg-default border-gray-600 text-white';
    }
  };

  const isChallenge = gameplayType === 'challenge' || compact;

  const dynamicClass = isChallenge
    ? `${isWide ? 'px-1 text-[8px] sm:text-[9px] min-w-[44px] sm:min-w-[52px]' : 'flex-1 min-w-[28px] sm:min-w-[32px]'} h-13 sm:h-12 text-xs`
    : `${isWide ? 'px-2.5 text-[10px] sm:text-xs min-w-[55px] sm:min-w-[65px]' : 'flex-1 min-w-[28px] sm:min-w-[32px]'} h-13 sm:h-12 text-sm sm:text-base`;

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
  gameplayType?: 'regular' | 'challenge';
}

export const Keyboard: React.FC<Props> = memo(({ onChar, onDelete, onEnter, letterStatuses, compact, gameplayType }) => {
  const handleKeyClick = React.useCallback((key: string) => {
    if (key === 'ENTER') onEnter();
    else if (key === 'DELETE') onDelete();
    else onChar(key);
  }, [onEnter, onDelete, onChar]);

  const isChallenge = gameplayType === 'challenge' || compact;

  return (
    <div className={`game-keyboard w-full max-w-[500px] mx-auto px-1 select-none shrink-0 ${isChallenge ? 'pb-1' : 'pb-4'}`}>
      {ROWS.map((row, i) => (
        <div key={i} className={`flex justify-center ${isChallenge ? 'mb-1.5 gap-1.5 sm:gap-2' : 'mb-1.5 gap-1.5 sm:gap-2'}`}>
          {row.map((key) => (
            <Key
              key={key}
              char={key}
              status={letterStatuses[key]}
              onClick={handleKeyClick}
              compact={compact}
              gameplayType={gameplayType}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

Keyboard.displayName = 'Keyboard';