// src/wordgrid/components/TileRack.tsx

import { TILE_VALUES } from '../../utils/wordgrid/constants';

interface TileRackProps {
  rack: string[];
  selectedIdx: number | null;
  onSelectTile: (idx: number) => void;
  onShuffle: () => void;
  onRecallAll: () => void;
  isMyTurn: boolean;
}

export const TileRack = ({
  rack,
  selectedIdx,
  onSelectTile,
  onShuffle,
  onRecallAll,
  isMyTurn,
}: TileRackProps) => {
  return (
    <div className="w-full max-w-[480px] bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl flex flex-col space-y-4 select-none mx-auto animate-in fade-in duration-300">
      {/* Title / Turn status indicator */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white font-black uppercase tracking-wider">
          {isMyTurn ? 'Your Rack (Tap or Drag)' : "Opponent's Turn"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onShuffle}
            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-all cursor-pointer"
          >
            🔀 Shuffle
          </button>
          <button
            onClick={onRecallAll}
            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-all cursor-pointer"
          >
            ↩️ Recall
          </button>
        </div>
      </div>

      {/* Tiles container */}
      <div className="flex justify-center gap-2">
        {rack.map((letter, idx) => {
          const isSelected = selectedIdx === idx;
          const val = TILE_VALUES[letter.toUpperCase()] ?? 0;

          return (
            <button
              key={idx}
              draggable={isMyTurn}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', idx.toString());
              }}
              onClick={() => isMyTurn && onSelectTile(idx)}
              disabled={!isMyTurn}
              className={`w-11 h-12 sm:w-12 sm:h-13 rounded-2xl flex flex-col items-center justify-center relative transition-all duration-150 transform ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xl -translate-y-2 ring-2 ring-indigo-400 border-2 border-white'
                  : isMyTurn
                  ? 'bg-amber-100 hover:bg-amber-200 text-black hover:shadow-lg cursor-pointer border-2 border-amber-300 active:scale-95'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-40'
              }`}
            >
              <span className="text-base sm:text-lg font-black text-black leading-none">
                {letter.toUpperCase() === '_' ? ' ' : letter.toUpperCase()}
              </span>
              <span
                className={`text-[8px] sm:text-[9px] font-black absolute bottom-0.5 right-1.5 ${
                  isSelected ? 'text-white' : 'text-slate-900'
                }`}
              >
                {val}
              </span>
            </button>
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

