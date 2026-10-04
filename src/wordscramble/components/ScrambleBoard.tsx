import React, { memo } from 'react';
import type { ScrambleTile } from '../engine/types';
import { RAINBOW_TILE_PALETTES } from '../engine/rainbowColors';

interface ScrambleBoardProps {
  tiles: ScrambleTile[];
  onTileClick: (tileId: string) => void;
  disabled?: boolean;
}

interface MatrixTileProps {
  tile: ScrambleTile;
  onTileClick: (tileId: string) => void;
  disabled: boolean;
}

const MatrixTile: React.FC<MatrixTileProps> = memo(({ tile, onTileClick, disabled }) => {
  const isStaged = tile.status === 'staged';
  const isConsumed = tile.status === 'consumed';
  const palette = RAINBOW_TILE_PALETTES[tile.colorIndex % RAINBOW_TILE_PALETTES.length];

  if (isConsumed) {
    return (
      <div
        className="w-8 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center select-none opacity-40"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-700/60" />
      </div>
    );
  }

  if (isStaged) {
    return (
      <div
        className="w-8 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 rounded-lg sm:rounded-xl bg-slate-900/40 border border-dashed border-slate-700/60 flex items-center justify-center select-none opacity-30 text-slate-500 font-bold text-xs sm:text-sm"
      >
        {tile.letter}
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && onTileClick(tile.id)}
      disabled={disabled}
      className={`
        relative w-8 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 rounded-lg sm:rounded-xl font-black text-base sm:text-lg md:text-xl
        flex flex-col items-center justify-center select-none cursor-pointer
        bg-gradient-to-br ${palette.bg} ${palette.text} ${palette.border}
        border-b-2 sm:border-b-4 border-t border-x active:border-b-0 active:translate-y-0.5
        ${palette.shadow} transition-transform duration-75 active:scale-90 hover:scale-105 will-change-transform
      `}
      style={{
        boxShadow: `0 2px 8px ${palette.glow}`,
      }}
    >
      <span className="leading-none drop-shadow-sm pointer-events-none">{tile.letter}</span>
      <span className="text-[7px] sm:text-[8px] opacity-75 font-mono leading-none mt-0.5 pointer-events-none">
        {tile.colorIndex + 1}
      </span>
    </button>
  );
});

MatrixTile.displayName = 'MatrixTile';

export const ScrambleBoard: React.FC<ScrambleBoardProps> = memo(({
  tiles,
  onTileClick,
  disabled = false,
}) => {
  const availableCount = tiles.filter((t) => t.status === 'available').length;

  return (
    <div className="w-full max-w-xl mx-auto p-2.5 sm:p-4 rounded-3xl bg-slate-900/95 border border-white/10 shadow-lg touch-pan-y">
      <div className="flex items-center justify-between mb-2 sm:mb-3 px-2">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400">
          Letter Pool Matrix ({availableCount} remaining)
        </span>
        <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
          Tap or type on keyboard
        </span>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 sm:gap-2 place-items-center min-h-[120px]">
        {tiles.map((tile) => (
          <MatrixTile
            key={tile.id}
            tile={tile}
            onTileClick={onTileClick}
            disabled={disabled}
          />
        ))}

        {tiles.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 font-medium text-xs sm:text-sm">
            ✨ No letters generated
          </div>
        )}
      </div>
    </div>
  );
});

ScrambleBoard.displayName = 'ScrambleBoard';

