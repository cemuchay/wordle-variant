import { memo } from 'react';
import type { SignalLevel } from '../live/hooks/useSignalStrength';

interface SignalBarProps {
   level: SignalLevel;
   className?: string;
}

const LEVEL_COLORS: Record<number, string> = {
   4: 'bg-green-500',
   3: 'bg-lime-500',
   2: 'bg-yellow-500',
   1: 'bg-orange-500',
   0: 'bg-red-500',
};

const BAR_HEIGHTS = [4, 7, 10, 13];

export const SignalBar = memo(({ level, className = '' }: SignalBarProps) => {
   return (
      <div className={`flex items-end gap-[2px] h-3 ${className}`}>
         {BAR_HEIGHTS.map((height, i) => (
            <div
               key={i}
               className={`w-[3px] rounded-sm transition-all duration-500 ${
                  i < level ? LEVEL_COLORS[level] : 'bg-white/15'
               }`}
               style={{ height: `${height}px` }}
            />
         ))}
      </div>
   );
});
