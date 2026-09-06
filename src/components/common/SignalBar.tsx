import { memo } from 'react';
import { useSignalStrength, type SignalLevel } from '../../hooks/useSignalStrength';

export interface SignalBarProps {
   level?: SignalLevel;
   className?: string;
   showLabel?: boolean;
   barWidth?: number;
   height?: number;
}

const LEVEL_COLORS: Record<number, string> = {
   4: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
   3: 'bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.5)]',
   2: 'bg-yellow-400',
   1: 'bg-orange-500',
   0: 'bg-red-500 animate-pulse',
};

const LEVEL_LABELS: Record<number, string> = {
   4: 'Excellent',
   3: 'Good',
   2: 'Fair',
   1: 'Weak',
   0: 'Offline',
};

const DEFAULT_BAR_HEIGHTS = [4, 7, 10, 13];

export const SignalBar = memo(({
   level: controlledLevel,
   className = '',
   showLabel = false,
   barWidth = 3,
   height = 14
}: SignalBarProps) => {
   const hookLevel = useSignalStrength();
   const level = controlledLevel !== undefined ? controlledLevel : hookLevel;
   const activeColor = LEVEL_COLORS[level] || 'bg-white/30';
   const label = LEVEL_LABELS[level] || 'Unknown';

   return (
      <div
         className={`inline-flex items-center gap-1.5 select-none ${className}`}
         title={`Network signal: ${label} (${level}/4 bars)`}
      >
         <div
            className="flex items-end gap-[2px]"
            style={{ height: `${height}px` }}
         >
            {DEFAULT_BAR_HEIGHTS.map((barH, i) => {
               const scaledH = Math.max(3, Math.round((barH / 13) * height));
               const isLit = i < level;
               return (
                  <div
                     key={i}
                     className={`rounded-xs transition-all duration-300 ${
                        isLit ? activeColor : 'bg-white/15'
                     }`}
                     style={{
                        width: `${barWidth}px`,
                        height: `${scaledH}px`
                     }}
                  />
               );
            })}
         </div>

         {showLabel && (
            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
               {label}
            </span>
         )}
      </div>
   );
});

SignalBar.displayName = 'SignalBar';
