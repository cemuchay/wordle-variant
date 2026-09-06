// src/wordgrid/components/BoardGrid.tsx

import { useState } from 'react';
import { getPremiumCellsForGrid, TILE_VALUES } from '../../utils/wordgrid/constants';
import type { GridCell, PlacedTile } from '../../utils/wordgrid/constants';
import type { PlayerColorScheme } from '../../utils/wordgrid/playerColors';
import { getPlayerColorScheme } from '../../utils/wordgrid/playerColors';

const ZOOM_STEPS = [1, 1.25, 1.5, 2];

export interface BoardLastMove {
  coords: string[];
  playerId: string | null;
}

interface BoardGridProps {
  gridSize?: number;
  board: GridCell[];
  placedTiles: PlacedTile[];
  selectedIdx: number | null;
  conflictCoords?: string[];
  lastMove?: BoardLastMove | null;
  colorMap?: Record<string, PlayerColorScheme>;
  rackLetters?: string[];
  onMoveTileInGrid?: (fromX: number, fromY: number, toX: number, toY: number) => void;
  onPlaceTile: (x: number, y: number, rackIdx: number) => void;
  onPickLetterForCell?: (x: number, y: number) => void;
  onRecallTile: (x: number, y: number) => void;
  topBarActions?: React.ReactNode;
}

export const BoardGrid = ({
  gridSize = 7,
  board,
  placedTiles,
  selectedIdx,
  conflictCoords = [],
  lastMove = null,
  colorMap = {},
  rackLetters,
  onMoveTileInGrid,
  onPlaceTile,
  onPickLetterForCell,
  onRecallTile,
  topBarActions,
}: BoardGridProps) => {
  const [zoomIdx, setZoomIdx] = useState(0);
  const premiumCells = getPremiumCellsForGrid(gridSize);
  const centerCoord = Math.floor(gridSize / 2);

  const zoom = ZOOM_STEPS[zoomIdx];
  const canZoomIn = zoomIdx < ZOOM_STEPS.length - 1;
  const canZoomOut = zoomIdx > 0;

  const schemeOf = (playerId: string | null | undefined): PlayerColorScheme =>
    (playerId && colorMap[playerId]) || getPlayerColorScheme(playerId || null);

  const getBoardCell = (x: number, y: number) => board.find((c) => c.x === x && c.y === y);
  const getPlacedTile = (x: number, y: number) => placedTiles.find((t) => t.x === x && t.y === y);

  const renderCell = (x: number, y: number) => {
    const key = `${x},${y}`;
    const boardCell = getBoardCell(x, y);
    const placedTile = getPlacedTile(x, y);
    const multiplier = premiumCells[key] || 'NONE';
    const isLatestPlay = !!boardCell && (lastMove?.coords?.includes(key) ?? false);
    const isConflict = !boardCell && conflictCoords.includes(key);

    // 1. Permanently locked board tiles (bright wood/amber style or glowing latest-play highlight)
    if (boardCell) {
      // Assigned blanks are stored lowercase — render underlined, worth 0
      const isBlank = /[a-z]/.test(boardCell.letter);
      const letter = boardCell.letter.toUpperCase();
      const val = isBlank ? 0 : TILE_VALUES[letter] || 0;
      const textClass = gridSize > 11 ? 'text-xs sm:text-sm font-black' : 'text-sm sm:text-base md:text-lg font-black';
      const playScheme = isLatestPlay ? schemeOf(lastMove?.playerId) : null;

      return (
        <div
          key={key}
          className={`aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative shadow-lg transform transition-all select-none ${
            isLatestPlay && playScheme
              ? `${playScheme.tileSurface} ${playScheme.glowShadow} scale-105 z-10 animate-pulse`
              : 'bg-linear-to-br from-amber-200 via-amber-300 to-amber-400 border border-amber-300/80 hover:scale-[1.02]'
          }`}
        >
          <span className={`${textClass} ${isLatestPlay && playScheme ? playScheme.tileText : 'text-slate-950'} select-none leading-none ${isBlank ? 'underline decoration-2 underline-offset-2' : ''}`}>{letter}</span>
          {gridSize <= 11 && (
            <span className={`text-[9px] font-black absolute bottom-0.5 right-1 select-none ${isLatestPlay && playScheme ? playScheme.tileValueText : 'text-slate-900'}`}>{val}</span>
          )}
          {isLatestPlay && playScheme && (
            <span
              className={`absolute -top-1 -right-1 text-[6px] font-black ${playScheme.badge} px-1 rounded-sm border border-white shadow-xs animate-bounce select-none`}
            >
              LAST
            </span>
          )}
        </div>
      );
    }

    // 2. Newly placed tiles in current turn (vibrant purple/indigo; red-ring when conflicting)
    if (placedTile) {
      // Assigned blanks are stored lowercase — render underlined, worth 0
      const isBlank = /[a-z]/.test(placedTile.letter);
      const letter = placedTile.letter.toUpperCase();
      const val = isBlank ? 0 : TILE_VALUES[letter] || 0;
      const textClass = gridSize > 11 ? 'text-xs sm:text-sm font-black' : 'text-sm sm:text-base md:text-lg font-black';
      return (
        <button
          key={key}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ fromX: x, fromY: y }));
            e.dataTransfer.setData('source', 'board');
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const gridDataStr = e.dataTransfer.getData('application/json');
              if (gridDataStr) {
                const { fromX, fromY } = JSON.parse(gridDataStr);
                if (fromX !== undefined && fromY !== undefined && (fromX !== x || fromY !== y) && onMoveTileInGrid) {
                  onMoveTileInGrid(fromX, fromY, x, y);
                  return;
                }
              }
            } catch {
              /* ignore parse errors */
            }
            const rackIdxStr = e.dataTransfer.getData('text/plain');
            if (rackIdxStr !== '') {
              const rackIdx = parseInt(rackIdxStr, 10);
              if (!isNaN(rackIdx)) {
                onPlaceTile(x, y, rackIdx);
              }
            }
          }}
          onClick={() => onRecallTile(x, y)}
          className={`aspect-square bg-linear-to-br from-indigo-500 via-purple-600 to-indigo-700 border-2 border-white rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative shadow-xl cursor-grab active:cursor-grabbing transform active:scale-95 transition-all hover:brightness-110 select-none ${
            isConflict ? 'ring-4 ring-rose-500 shadow-rose-500/50 animate-pulse' : ''
          }`}
        >
          <span className={`${textClass} text-white drop-shadow-md select-none leading-none ${isBlank ? 'underline decoration-2 underline-offset-2' : ''}`}>{letter}</span>
          {gridSize <= 11 && <span className="text-[9px] font-black text-amber-200 absolute bottom-0.5 right-1 select-none">{val}</span>}
          <span className="absolute top-0.5 left-0.5 text-[5px] sm:text-[6px] uppercase font-black text-emerald-300 tracking-wider select-none">NEW</span>
          {isConflict && (
            <span className="absolute -top-1.5 -right-1.5 text-[6px] font-black bg-rose-600 text-white px-1 rounded-sm border border-white shadow-xs animate-bounce select-none">
              ⚠
            </span>
          )}
        </button>
      );
    }

    // 3. Empty cell styling with drop and click targets
    let cellBg = 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800/80 hover:border-indigo-500/60';
    let text = '';
    const textStyle = gridSize > 11 ? 'text-[7px] sm:text-[8px] font-black tracking-tighter select-none' : 'text-[9px] sm:text-[10px] font-black tracking-wider select-none';

    if (multiplier === 'TW') {
      cellBg = 'bg-rose-950/70 hover:bg-rose-900/70 border-rose-500/50 shadow-inner shadow-rose-950/50';
      text = 'TW';
    } else if (multiplier === 'DW') {
      cellBg = 'bg-orange-950/70 hover:bg-orange-900/70 border-orange-500/50 shadow-inner shadow-orange-950/50';
      text = 'DW';
    } else if (multiplier === 'TL') {
      cellBg = 'bg-indigo-950/70 hover:bg-indigo-900/70 border-indigo-500/50 shadow-inner shadow-indigo-950/50';
      text = 'TL';
    } else if (multiplier === 'DL') {
      cellBg = 'bg-sky-950/70 hover:bg-sky-900/70 border-sky-500/50 shadow-inner shadow-sky-950/50';
      text = 'DL';
    }

    const isCenter = x === centerCoord && y === centerCoord;

    return (
      <div
        key={key}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          // Check if dragging an already placed tile on the grid
          try {
            const gridDataStr = e.dataTransfer.getData('application/json');
            if (gridDataStr) {
              const { fromX, fromY } = JSON.parse(gridDataStr);
              if (fromX !== undefined && fromY !== undefined && onMoveTileInGrid) {
                onMoveTileInGrid(fromX, fromY, x, y);
                return;
              }
            }
          } catch {
            /* ignore JSON parse errors */
          }
          // Otherwise check if dragging from rack
          const rackIdxStr = e.dataTransfer.getData('text/plain');
          if (rackIdxStr !== '') {
            const rackIdx = parseInt(rackIdxStr, 10);
            if (!isNaN(rackIdx)) {
              // Dragging a blank tile opens the letter picker instead
              if (rackLetters?.[rackIdx] === '_') {
                onPickLetterForCell?.(x, y);
                return;
              }
              onPlaceTile(x, y, rackIdx);
            }
          }
        }}
        onClick={() => {
          // Non-blank rack tile selected → place it directly (existing flow)
          if (selectedIdx !== null && rackLetters?.[selectedIdx] && rackLetters[selectedIdx] !== '_') {
            onPlaceTile(x, y, selectedIdx);
            return;
          }
          // Nothing selected, or a blank selected → open the letter picker
          onPickLetterForCell?.(x, y);
        }}
        className={`aspect-square border rounded-xl flex items-center justify-center transition-all ${cellBg} cursor-pointer relative shadow-sm select-none`}
      >
        <span className={textStyle}>{text}</span>
        {isCenter && (
          <span className="text-xs sm:text-sm font-black text-amber-400 drop-shadow animate-pulse select-none">★</span>
        )}
      </div>
    );
  };

  // Determine dynamic grid columns CSS inline style based on gridSize
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
    gap: gridSize > 9 ? '0.25rem' : '0.375rem',
  };

  return (
    <div className="w-full max-w-[480px] p-3 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center select-none mx-auto animate-in fade-in duration-300 relative">
      {/* Top Controls Bar: Action buttons on left / Zoom controls on right */}
      <div className="w-full flex items-center justify-between gap-2 mb-2 z-20 min-h-[38px]">
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide py-0.5">
          {topBarActions}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-[#0c121e]/95 border border-slate-700 rounded-xl p-1 shadow-lg shrink-0">
          <button
            type="button"
            onClick={() => canZoomIn && setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))}
            disabled={!canZoomIn}
            title="Zoom in"
            className={`w-7 h-7 rounded-lg text-sm font-black flex items-center justify-center transition-all ${canZoomIn ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-90' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
          >
            +
          </button>
          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 w-7 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => canZoomOut && setZoomIdx((i) => Math.max(i - 1, 0))}
            disabled={!canZoomOut}
            title="Zoom out"
            className={`w-7 h-7 rounded-lg text-sm font-black flex items-center justify-center transition-all ${canZoomOut ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-90' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoomIdx(0)}
            disabled={zoomIdx === 0}
            title="Reset zoom"
            className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all ${zoomIdx !== 0 ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-90' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Scrollable map-style viewport */}
      <div className="w-full overflow-auto scrollbar-hide">
        <div style={{ width: `${zoom * 100}%` }} className="select-none">
          <div style={gridStyle}>
            {Array.from({ length: gridSize }).map((_, y) =>
              Array.from({ length: gridSize }).map((_, x) => renderCell(x, y))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardGrid;
