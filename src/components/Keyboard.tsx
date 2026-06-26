import React, { memo } from 'react';
import type { LetterStatus } from '../types/game';
import { Delete, CornerDownLeft } from 'lucide-react';
import { useIsResponsive } from '../hooks/useResponsive';
import { useAppStore } from '../store/useAppStore';

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
  wordLength?: number
}

const Key = memo(({ char, status, onClick, compact, gameplayType, wordLength = 5 }: KeyProps) => {
  const { isSuperTiny, isDesktop } = useIsResponsive(); // Detect responsive state
  const isPWA = useAppStore(s => s.isPWAInstalled)

  let localIsSuperTiny = isSuperTiny

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


  let dynamicClass = isChallenge
    ? `${isWide
      ? 'px-1 text-[8px] sm:text-[9px] min-w-[34px] max-[340px]:min-w-[30px] sm:min-w-[52px]'
      : 'flex-1 min-w-[28px] max-[340px]:min-w-[22px] sm:min-w-[32px]'
    } h-13 max-[340px]:h-10 sm:h-12 text-xs max-[340px]:text-[10px]`
    : `${isWide
      ? 'px-2.5 max-[340px]:px-1 text-[10px] sm:text-xs min-w-[55px] max-[340px]:min-w-[42px] sm:min-w-[65px]'
      : 'flex-1 min-w-[28px] max-[340px]:min-w-[22px] sm:min-w-[32px]'
    } h-13 max-[340px]:h-10 sm:h-12 text-sm max-[340px]:text-xs sm:text-base`;

  if (isSuperTiny) {
    dynamicClass = `flex-1 min-w-[22px] h-8 text-sm sm:text-[8px]`
  }

  //reduce key height in non PWA mobiel devices for long words
  if (!isSuperTiny && !isChallenge && !isDesktop && !isPWA && wordLength > 6) {
    localIsSuperTiny = true
    dynamicClass = `flex-1 min-w-[22px] h-11 text-sm sm:text-[9px]`
  }

  if (!isChallenge && isDesktop && wordLength > 5) {
    localIsSuperTiny = true
    dynamicClass = `flex-1 min-w-[22px] h-11 text-sm`
  }


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
      {char === 'DELETE' ? <Delete size={18} /> : (char === "ENTER" && (isSuperTiny || localIsSuperTiny) && !isChallenge) ? <CornerDownLeft size={18} /> : char}
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
  wordLength?: number;
}

export const Keyboard: React.FC<Props> = memo(({ onChar, onDelete, onEnter, letterStatuses, compact, gameplayType, wordLength }) => {
  const handleKeyClick = React.useCallback((key: string) => {
    if (key === 'ENTER') onEnter();
    else if (key === 'DELETE') onDelete();
    else onChar(key);
  }, [onEnter, onDelete, onChar]);

  const isChallenge = gameplayType === 'challenge' || compact;

  return (
    <div className={`game-keyboard w-full max-w-[500px] mx-auto px-1 select-none shrink-0 ${isChallenge ? 'pb-1' : 'pb-2 sm:pb-0'}`}>
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
              wordLength={wordLength}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

Keyboard.displayName = 'Keyboard';