// src/wordgrid/components/BoardGrid.tsx

import { getPremiumCellsForGrid, TILE_VALUES } from '../../utils/wordgrid/constants';
import type { GridCell, PlacedTile } from '../../utils/wordgrid/constants';

interface BoardGridProps {
  gridSize?: number;
  board: GridCell[];
  placedTiles: PlacedTile[];
  selectedIdx: number | null;
  highlightedCoords?: string[];
  onMoveTileInGrid?: (fromX: number, fromY: number, toX: number, toY: number) => void;
  onPlaceTile: (x: number, y: number, rackIdx: number) => void;
  onRecallTile: (x: number, y: number) => void;
}

export const BoardGrid = ({
  gridSize = 7,
  board,
  placedTiles,
  selectedIdx,
  highlightedCoords = [],
  onMoveTileInGrid,
  onPlaceTile,
  onRecallTile,
}: BoardGridProps) => {
  const premiumCells = getPremiumCellsForGrid(gridSize);
  const centerCoord = Math.floor(gridSize / 2);

  const getBoardCell = (x: number, y: number) => board.find((c) => c.x === x && c.y === y);
  const getPlacedTile = (x: number, y: number) => placedTiles.find((t) => t.x === x && t.y === y);

  const renderCell = (x: number, y: number) => {
    const key = `${x},${y}`;
    const boardCell = getBoardCell(x, y);
    const placedTile = getPlacedTile(x, y);
    const multiplier = premiumCells[key] || 'NONE';
    const isBotHighlighted = highlightedCoords.includes(key);

    // 1. Permanently locked board tiles (bright wood/amber style or glowing bot highlight)
    if (boardCell) {
      const letter = boardCell.letter.toUpperCase();
      const val = TILE_VALUES[letter] || 0;
      const textClass = gridSize > 11 ? 'text-xs sm:text-sm font-black' : 'text-sm sm:text-base md:text-lg font-black';
      return (
        <div
          key={key}
          className={`aspect-square rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative shadow-lg transform transition-all select-none ${
            isBotHighlighted
              ? 'bg-linear-to-br from-emerald-300 via-teal-400 to-emerald-500 border-2 border-white ring-4 ring-emerald-400/90 shadow-emerald-500/60 scale-105 z-10 animate-pulse'
              : 'bg-linear-to-br from-amber-200 via-amber-300 to-amber-400 border border-amber-200 hover:scale-[1.02]'
          }`}
        >
          <span className={`${textClass} ${isBotHighlighted ? 'text-emerald-950 font-black' : 'text-slate-950'} select-none leading-none`}>{letter}</span>
          {gridSize <= 11 && (
            <span className={`text-[9px] font-black absolute bottom-0.5 right-1 select-none ${isBotHighlighted ? 'text-emerald-950' : 'text-slate-900'}`}>{val}</span>
          )}
          {isBotHighlighted && (
            <span className="absolute -top-1 -right-1 text-[6px] font-black bg-emerald-950 text-emerald-300 px-1 rounded-sm border border-emerald-400 shadow-xs animate-bounce select-none">
              BOT
            </span>
          )}
        </div>
      );
    }

    // 2. Newly placed tiles in current turn (vibrant purple/indigo with click to recall & draggable to adjust)
    if (placedTile) {
      const letter = placedTile.letter.toUpperCase();
      const val = TILE_VALUES[letter] || 0;
      const textClass = gridSize > 11 ? 'text-xs sm:text-sm font-black' : 'text-sm sm:text-base md:text-lg font-black';
      return (
        <button
          key={key}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ fromX: x, fromY: y }));
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
          className="aspect-square bg-linear-to-br from-indigo-500 via-purple-600 to-indigo-700 border-2 border-white rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative shadow-xl cursor-grab active:cursor-grabbing transform active:scale-95 transition-all hover:brightness-110 select-none"
        >
          <span className={`${textClass} text-white drop-shadow-md select-none leading-none`}>{letter}</span>
          {gridSize <= 11 && <span className="text-[9px] font-black text-amber-200 absolute bottom-0.5 right-1 select-none">{val}</span>}
          <span className="absolute top-0.5 left-0.5 text-[5px] sm:text-[6px] uppercase font-black text-emerald-300 tracking-wider select-none">NEW</span>
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
              onPlaceTile(x, y, rackIdx);
            }
          }
        }}
        onClick={() => selectedIdx !== null && onPlaceTile(x, y, selectedIdx)}
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
    <div className="w-full max-w-[480px] p-3 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center select-none mx-auto animate-in fade-in duration-300">
      <div className="w-full select-none" style={gridStyle}>
        {Array.from({ length: gridSize }).map((_, y) =>
          Array.from({ length: gridSize }).map((_, x) => renderCell(x, y))
        )}
      </div>
    </div>
  );
};

export default BoardGrid;


