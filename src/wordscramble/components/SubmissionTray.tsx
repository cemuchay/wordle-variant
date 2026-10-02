import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScrambleTile } from '../engine/types';
import { RAINBOW_TILE_PALETTES } from '../engine/rainbowColors';
import { Delete, Check, Shuffle, RefreshCw } from 'lucide-react';

interface SubmissionTrayProps {
  stagedTiles: ScrambleTile[];
  targetLengths: number[];
  onUnstageTile: (tileId: string) => void;
  onSwapTiles?: (fromIndex: number, toIndex: number) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  onShuffle: () => void;
  isValidLength: boolean;
  disabled?: boolean;
}

export const SubmissionTray: React.FC<SubmissionTrayProps> = ({
  stagedTiles,
  targetLengths,
  onUnstageTile,
  onSwapTiles,
  onBackspace,
  onClear,
  onSubmit,
  onShuffle,
  isValidLength,
  disabled = false,
}) => {
  const currentWord = stagedTiles.map((t) => t.letter).join('');

  return (
    <div className="w-full max-w-xl mx-auto my-2 sm:my-3 flex flex-col items-center gap-2 sm:gap-3">
      {/* Target Length Indicators */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Accepted Lengths:</span>
        <div className="flex gap-1.5">
          {targetLengths.map((len) => {
            const isMatch = currentWord.length === len;
            return (
              <span
                key={len}
                className={`
                  px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-black transition-all duration-200
                  ${
                    isMatch
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 scale-105 sm:scale-110 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700'
                  }
                `}
              >
                {len}L
              </span>
            );
          })}
        </div>
      </div>

      {/* Staged Tiles Rainbow Tray with Reordering & Tap to Swap/Remove */}
      <div className="w-full min-h-[58px] sm:min-h-[68px] p-2 sm:p-2.5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-purple-950/40 to-slate-900/90 backdrop-blur-md border-2 border-indigo-500/30 flex items-center justify-center gap-1.5 sm:gap-2 shadow-inner overflow-x-auto">
        <AnimatePresence mode="popLayout">
          {stagedTiles.map((tile, idx) => {
            const palette = RAINBOW_TILE_PALETTES[tile.colorIndex % RAINBOW_TILE_PALETTES.length];
            return (
              <motion.div
                key={tile.id}
                layoutId={tile.id}
                initial={{ scale: 0.5, y: -10, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="relative group flex flex-col items-center"
              >
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onUnstageTile(tile.id)}
                  title="Tap to remove letter from rack"
                  className={`
                    w-9 h-10 sm:w-11 sm:h-12 md:w-12 md:h-13 rounded-lg sm:rounded-xl font-black text-lg sm:text-xl flex items-center justify-center
                    bg-gradient-to-br ${palette.bg} ${palette.text} ${palette.border}
                    border-b-2 sm:border-b-4 border-t border-x shadow-md select-none cursor-pointer
                  `}
                  style={{
                    boxShadow: `0 0 14px ${palette.glow}`,
                  }}
                >
                  {tile.letter}
                </motion.button>

                {/* Left / Right Quick Reorder Buttons */}
                {stagedTiles.length > 1 && onSwapTiles && (
                  <div className="flex gap-1 mt-1 opacity-60 hover:opacity-100 transition-opacity">
                    {idx > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwapTiles(idx, idx - 1);
                        }}
                        className="text-[8px] sm:text-[9px] px-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                        title="Move left"
                      >
                        ◀
                      </button>
                    )}
                    {idx < stagedTiles.length - 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwapTiles(idx, idx + 1);
                        }}
                        className="text-[8px] sm:text-[9px] px-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                        title="Move right"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {stagedTiles.length === 0 && (
          <span className="text-xs sm:text-sm font-medium text-slate-500 tracking-wider">
            Select letters above or type on keyboard
          </span>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between px-1">
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={onShuffle}
            disabled={disabled}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-bold border border-slate-700 active:scale-95 transition-all shadow cursor-pointer"
            title="Shuffle matrix tiles"
          >
            <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span>Shuffle</span>
          </button>

          <button
            onClick={onClear}
            disabled={disabled || stagedTiles.length === 0}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] sm:text-xs font-bold border border-slate-700 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={onBackspace}
            disabled={disabled || stagedTiles.length === 0}
            className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[11px] sm:text-xs font-bold active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Delete className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Delete</span>
          </button>

          <motion.button
            whileHover={isValidLength ? { scale: 1.05 } : {}}
            whileTap={isValidLength ? { scale: 0.95 } : {}}
            onClick={onSubmit}
            disabled={disabled || !isValidLength}
            className={`
              flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm transition-all duration-200
              ${
                isValidLength
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.7)] cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
              }
            `}
          >
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>SUBMIT</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
