import React from 'react';
import { motion } from 'framer-motion';
import type { ScrambleTile } from '../engine/types';
import { RAINBOW_TILE_PALETTES } from '../engine/rainbowColors';

interface ScrambleBoardProps {
  tiles: ScrambleTile[];
  onTileClick: (tileId: string) => void;
  disabled?: boolean;
}

export const ScrambleBoard: React.FC<ScrambleBoardProps> = ({
  tiles,
  onTileClick,
  disabled = false,
}) => {
  const availableCount = tiles.filter((t) => t.status === 'available').length;

  return (
    <div className="w-full max-w-xl mx-auto p-2.5 sm:p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between mb-2 sm:mb-3 px-2">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
          Letter Pool Matrix ({availableCount} remaining)
        </span>
        <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
          Tap or type on keyboard
        </span>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 sm:gap-2 place-items-center min-h-[120px]">
        {tiles.map((tile) => {

          const isStaged = tile.status === 'staged';
          const isConsumed = tile.status === 'consumed';
          const palette = RAINBOW_TILE_PALETTES[tile.colorIndex % RAINBOW_TILE_PALETTES.length];

          if (isConsumed) {
            // Requirement 1: Replace used tiles with a sleek dark/black placeholder tile maintaining grid position
            return (
              <div
                key={tile.id}
                className="w-8 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center select-none opacity-40 shadow-inner"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700/60" />
              </div>
            );
          }

          if (isStaged) {
            // Ghost outline for staged tiles
            return (
              <div
                key={tile.id}
                className="w-8 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-900/40 border border-dashed border-slate-700 flex items-center justify-center select-none opacity-30 text-slate-500 font-bold text-xs sm:text-sm"
              >
                {tile.letter}
              </div>
            );
          }

          return (
            <motion.button
              key={tile.id}
              layoutId={tile.id}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }}
              onClick={() => !disabled && onTileClick(tile.id)}
              disabled={disabled}
              className={`
                relative w-8 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 rounded-lg sm:rounded-xl font-black text-base sm:text-lg md:text-xl
                flex flex-col items-center justify-center select-none cursor-pointer
                bg-gradient-to-br ${palette.bg} ${palette.text} ${palette.border}
                border-b-2 sm:border-b-4 border-t border-x active:border-b-0 active:translate-y-1
                ${palette.shadow} transition-all duration-150
              `}
              style={{
                boxShadow: `0 3px 10px ${palette.glow}, inset 0 1px 1px rgba(255,255,255,0.4)`,
              }}
            >
              <span className="leading-none drop-shadow-sm">{tile.letter}</span>
              <span className="text-[7px] sm:text-[8px] opacity-75 font-mono leading-none mt-0.5">
                {tile.colorIndex + 1}
              </span>
            </motion.button>
          );
        })}

        {tiles.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 font-medium text-xs sm:text-sm">
            ✨ No letters generated
          </div>
        )}
      </div>
    </div>
  );
};
