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
  const availableTiles = tiles.filter((t) => t.status === 'available');

  return (
    <div className="w-full max-w-xl mx-auto p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between mb-3 px-2">
        <span className="text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
          Letter Pool Matrix ({availableTiles.length} remaining)
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          Tap or type on keyboard
        </span>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 place-items-center min-h-[140px]">
        {availableTiles.map((tile) => {
          const palette = RAINBOW_TILE_PALETTES[tile.colorIndex % RAINBOW_TILE_PALETTES.length];

          return (
            <motion.button
              key={tile.id}
              layoutId={tile.id}
              whileHover={{ scale: 1.12, y: -2 }}
              whileTap={{ scale: 0.9 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }}
              onClick={() => !disabled && onTileClick(tile.id)}
              disabled={disabled}
              className={`
                relative w-10 h-11 sm:w-11 sm:h-12 rounded-xl font-black text-lg sm:text-xl
                flex flex-col items-center justify-center select-none cursor-pointer
                bg-gradient-to-br ${palette.bg} ${palette.text} ${palette.border}
                border-b-4 border-t border-x active:border-b-0 active:translate-y-1
                ${palette.shadow} transition-all duration-150
              `}
              style={{
                boxShadow: `0 4px 14px ${palette.glow}, inset 0 1px 1px rgba(255,255,255,0.4)`,
              }}
            >
              <span className="leading-none drop-shadow-sm">{tile.letter}</span>
              <span className="text-[8px] opacity-75 font-mono leading-none mt-0.5">
                {tile.colorIndex + 1}
              </span>
            </motion.button>
          );
        })}

        {availableTiles.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 font-medium">
            ✨ All tiles staged or cleared!
          </div>
        )}
      </div>
    </div>
  );
};
