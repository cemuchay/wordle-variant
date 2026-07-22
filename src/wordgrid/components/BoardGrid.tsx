// src/wordgrid/components/BoardGrid.tsx

import { getPremiumCellsForGrid, TILE_VALUES } from '../../utils/wordgrid/constants';
import type { GridCell, PlacedTile } from '../../utils/wordgrid/constants';

interface BoardGridProps {
  gridSize?: number;
  board: GridCell[];
  placedTiles: PlacedTile[];
  selectedIdx: number | null;
  onPlaceTile: (x: number, y: number, rackIdx: number) => void;
  onRecallTile: (x: number, y: number) => void;
}

export const BoardGrid = ({
  gridSize = 7,
  board,
  placedTiles,
  selectedIdx,
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

    // Cell Styling based on occupancy
    if (boardCell) {
      const letter = boardCell.letter.toUpperCase();
      const val = TILE_VALUES[letter] || 0;
      return (
        <div
          key={key}
          className="aspect-square bg-gradient-to-br from-amber-700 to-amber-900 border-2 border-amber-500/80 rounded-xl flex flex-col items-center justify-center relative shadow-lg transform transition-transform hover:scale-[1.02]"
        >
          <span className="text-sm sm:text-base md:text-lg font-black text-white drop-shadow-md select-none">{letter}</span>
          <span className="text-[9px] font-black text-amber-200 absolute bottom-0.5 right-1">{val}</span>
        </div>
      );
    }

    if (placedTile) {
      const letter = placedTile.letter.toUpperCase();
      const val = TILE_VALUES[letter] || 0;
      return (
        <button
          key={key}
          onClick={() => onRecallTile(x, y)}
          className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white rounded-xl flex flex-col items-center justify-center relative shadow-xl cursor-pointer transform active:scale-95 transition-all hover:brightness-110"
        >
          <span className="text-sm sm:text-base md:text-lg font-black text-white drop-shadow-md">{letter}</span>
          <span className="text-[9px] font-black text-white absolute bottom-0.5 right-1">{val}</span>
          <span className="absolute top-0.5 left-1 text-[6px] uppercase font-black text-emerald-300 tracking-wider">NEW</span>
        </button>
      );
    }

    // Empty cell styling
    let cellBg = 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/60';
    let text = '';
    let textStyle = 'text-[9px] sm:text-[10px] font-black tracking-wider text-slate-400';

    if (multiplier === 'TW') {
      cellBg = 'bg-rose-950/60 hover:bg-rose-900/60 border-rose-500/50 shadow-inner shadow-rose-950/50';
      text = 'TW';
      textStyle = 'text-[9px] sm:text-[11px] font-black text-rose-400 drop-shadow';
    } else if (multiplier === 'DW') {
      cellBg = 'bg-orange-950/60 hover:bg-orange-900/60 border-orange-500/50 shadow-inner shadow-orange-950/50';
      text = 'DW';
      textStyle = 'text-[9px] sm:text-[11px] font-black text-orange-400 drop-shadow';
    } else if (multiplier === 'TL') {
      cellBg = 'bg-indigo-950/60 hover:bg-indigo-900/60 border-indigo-500/50 shadow-inner shadow-indigo-950/50';
      text = 'TL';
      textStyle = 'text-[9px] sm:text-[11px] font-black text-indigo-300 drop-shadow';
    } else if (multiplier === 'DL') {
      cellBg = 'bg-sky-950/60 hover:bg-sky-900/60 border-sky-500/50 shadow-inner shadow-sky-950/50';
      text = 'DL';
      textStyle = 'text-[9px] sm:text-[11px] font-black text-sky-300 drop-shadow';
    }

    const isCenter = x === centerCoord && y === centerCoord;

    return (
      <button
        key={key}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const rackIdxStr = e.dataTransfer.getData('text/plain');
          if (rackIdxStr !== '') {
            const rackIdx = parseInt(rackIdxStr, 10);
            onPlaceTile(x, y, rackIdx);
          }
        }}
        onClick={() => selectedIdx !== null && onPlaceTile(x, y, selectedIdx)}
        className={`aspect-square border rounded-xl flex items-center justify-center transition-all ${cellBg} cursor-pointer relative shadow-sm`}
      >
        <span className={textStyle}>{text}</span>
        {isCenter && (
          <span className="text-xs sm:text-sm font-black text-amber-400 drop-shadow animate-pulse">★</span>
        )}
      </button>
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
      <div className="w-full" style={gridStyle}>
        {Array.from({ length: gridSize }).map((_, y) =>
          Array.from({ length: gridSize }).map((_, x) => renderCell(x, y))
        )}
      </div>
    </div>
  );
};

export default BoardGrid;

