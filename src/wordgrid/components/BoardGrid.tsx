// src/wordgrid/components/BoardGrid.tsx

import { PREMIUM_CELLS, TILE_VALUES } from '../../utils/wordgrid/constants';
import type { GridCell, PlacedTile } from '../../utils/wordgrid/constants';

interface BoardGridProps {
  board: GridCell[];
  placedTiles: PlacedTile[];
  selectedIdx: number | null;
  onPlaceTile: (x: number, y: number, rackIdx: number) => void;
  onRecallTile: (x: number, y: number) => void;
}

export const BoardGrid = ({
  board,
  placedTiles,
  selectedIdx,
  onPlaceTile,
  onRecallTile,
}: BoardGridProps) => {
  const getBoardCell = (x: number, y: number) => board.find(c => c.x === x && c.y === y);
  const getPlacedTile = (x: number, y: number) => placedTiles.find(t => t.x === x && t.y === y);

  const renderCell = (x: number, y: number) => {
    const key = `${x},${y}`;
    const boardCell = getBoardCell(x, y);
    const placedTile = getPlacedTile(x, y);
    const multiplier = PREMIUM_CELLS[key] || 'NONE';

    // Cell Styling based on occupancy
    if (boardCell) {
      // Locked existing tile
      const letter = boardCell.letter.toUpperCase();
      const val = TILE_VALUES[letter] || 0;
      return (
        <div
          key={key}
          className="aspect-square bg-amber-800 border border-amber-900 rounded-lg flex flex-col items-center justify-center relative shadow-md"
        >
          <span className="text-[12px] sm:text-[14px] font-black text-white">{letter}</span>
          <span className="text-[7px] font-black text-white absolute bottom-0.5 right-1">{val}</span>
        </div>
      );
    }

    if (placedTile) {
      // Currently placed tile (not yet submitted)
      const letter = placedTile.letter.toUpperCase();
      const val = TILE_VALUES[letter] || 0;
      return (
        <button
          key={key}
          onClick={() => onRecallTile(x, y)}
          className="aspect-square bg-indigo-600 border border-indigo-700 rounded-lg flex flex-col items-center justify-center relative shadow-lg cursor-pointer transform active:scale-95 transition-all hover:bg-indigo-500"
        >
          <span className="text-[12px] sm:text-[14px] font-black text-white">{letter}</span>
          <span className="text-[7px] font-black text-white absolute bottom-0.5 right-1">{val}</span>
          <span className="absolute top-0.5 left-0.5 text-[5px] uppercase font-black text-white tracking-wider">NEW</span>
        </button>
      );
    }

    // Empty cell (Check premium multiplier)
    let cellBg = 'bg-white/5 hover:bg-white/10 border-white/5';
    let text = '';
    let textStyle = 'text-[7px] sm:text-[8px] font-black tracking-wide text-white/30';

    if (multiplier === 'TW') {
      cellBg = 'bg-rose-600/30 hover:bg-rose-600/40 border-rose-500/40';
      text = 'TW';
      textStyle = 'text-[8px] sm:text-[9px] font-black text-rose-500';
    } else if (multiplier === 'DW') {
      cellBg = 'bg-orange-600/30 hover:bg-orange-600/40 border-orange-500/40';
      text = 'DW';
      textStyle = 'text-[8px] sm:text-[9px] font-black text-orange-500';
    } else if (multiplier === 'TL') {
      cellBg = 'bg-indigo-600/30 hover:bg-indigo-600/40 border-indigo-500/40';
      text = 'TL';
      textStyle = 'text-[8px] sm:text-[9px] font-black text-indigo-400';
    } else if (multiplier === 'DL') {
      cellBg = 'bg-sky-600/30 hover:bg-sky-600/40 border-sky-500/40';
      text = 'DL';
      textStyle = 'text-[8px] sm:text-[9px] font-black text-sky-400';
    }

    // Special styling for the center cell
    const isCenter = x === 5 && y === 5;

    return (
      <button
        key={key}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const rackIdxStr = e.dataTransfer.getData("text/plain");
          if (rackIdxStr !== "") {
            const rackIdx = parseInt(rackIdxStr, 10);
            onPlaceTile(x, y, rackIdx);
          }
        }}
        onClick={() => selectedIdx !== null && onPlaceTile(x, y, selectedIdx)}
        className={`aspect-square border rounded-lg flex items-center justify-center transition-all ${cellBg} cursor-pointer relative`}
      >
        <span className={textStyle}>{text}</span>
        {isCenter && !text && (
          <span className="text-[10px] sm:text-[12px] font-black text-yellow-500">★</span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[420px] aspect-square p-2 bg-slate-950/60 border border-white/10 rounded-2xl shadow-xl flex items-center justify-center select-none mx-auto animate-in fade-in duration-300">
      <div className="grid grid-cols-11 gap-1.5 w-full">
        {Array.from({ length: 11 }).map((_, y) =>
          Array.from({ length: 11 }).map((_, x) => renderCell(x, y))
        )}
      </div>
    </div>
  );
};
