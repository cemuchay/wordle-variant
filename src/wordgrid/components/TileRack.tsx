// src/wordgrid/components/TileRack.tsx

import { TILE_VALUES } from '../../utils/wordgrid/constants';

interface TileRackProps {
  rack: string[];
  selectedIdx: number | null;
  onSelectTile: (idx: number) => void;
  onShuffle: () => void;
  onRecallAll: () => void;
  isMyTurn: boolean;
  onTurnAlert?: () => void;
  onReorderRack?: (fromIdx: number, toIdx: number) => void;
}

export const TileRack = ({
  rack,
  selectedIdx,
  onSelectTile,
  onShuffle,
  onRecallAll,
  isMyTurn,
  onTurnAlert,
  onReorderRack,
}: TileRackProps) => {
  return (
    <div className="w-full max-w-[480px] bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col space-y-4 select-none mx-auto animate-in fade-in duration-300">
      {/* Title / Turn status indicator */}
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-black uppercase tracking-wider ${isMyTurn ? 'text-emerald-400' : 'text-slate-400'}`}>
          {isMyTurn ? '🔥 Your Rack (Tap or Drag Tile)' : "⏳ Opponent's Turn"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onShuffle}
            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            🔀 Shuffle
          </button>
          <button
            onClick={onRecallAll}
            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            ↩️ Recall
          </button>
        </div>
      </div>

      {/* Tiles container */}
      <div className="flex justify-center gap-2 flex-wrap min-h-[56px] items-center">
        {rack.map((letter, idx) => {
          const isSelected = selectedIdx === idx;
          const char = letter.toUpperCase() === '_' ? ' ' : letter.toUpperCase();
          const val = TILE_VALUES[char] ?? 0;

          return (
            <div
              key={idx}
              draggable={isMyTurn}
              onDragStart={(e) => {
                if (isMyTurn) {
                  e.dataTransfer.setData('text/plain', idx.toString());
                  e.dataTransfer.setData('source', 'rack');
                  e.dataTransfer.effectAllowed = 'move';
                  onSelectTile(idx);
                }
              }}
              onDragOver={(e) => {
                if (isMyTurn) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                if (!isMyTurn) return;
                e.preventDefault();
                e.stopPropagation();
                const rawIdx = e.dataTransfer.getData('text/plain');
                if (rawIdx !== '') {
                  const fromIdx = parseInt(rawIdx, 10);
                  if (!isNaN(fromIdx) && fromIdx !== idx && onReorderRack) {
                    onReorderRack(fromIdx, idx);
                  }
                }
              }}
              onClick={() => {
                if (isMyTurn) {
                  onSelectTile(idx);
                } else if (onTurnAlert) {
                  onTurnAlert();
                }
              }}
              className={`w-11 h-12 sm:w-12 sm:h-13 rounded-2xl flex flex-col items-center justify-center relative transition-all duration-150 transform select-none ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-2xl -translate-y-2.5 scale-105 ring-4 ring-indigo-400 border-2 border-white cursor-grab'
                  : isMyTurn
                  ? 'bg-amber-200 hover:bg-amber-100 text-slate-950 hover:shadow-xl cursor-grab active:cursor-grabbing border-2 border-amber-300 active:scale-95'
                  : 'bg-amber-100/70 text-slate-900 border border-amber-300/60 opacity-70 cursor-not-allowed'
              }`}
            >
              <span className={`text-base sm:text-lg font-black leading-none select-none ${
                isSelected ? 'text-white' : 'text-slate-950'
              }`}>
                {char}
              </span>
              <span
                className={`text-[8px] sm:text-[9px] font-extrabold absolute bottom-0.5 right-1.5 select-none ${
                  isSelected ? 'text-indigo-200' : 'text-slate-800'
                }`}
              >
                {val}
              </span>
            </div>
          );
        })}
        {rack.length === 0 && (
          <div className="text-xs text-slate-400 font-black uppercase tracking-wider py-3">
            Rack is empty
          </div>
        )}
      </div>
    </div>
  );
};

export default TileRack;


