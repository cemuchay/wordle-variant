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
    <div className="w-full max-w-[420px] bg-slate-900/60 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col space-y-4 select-none mx-auto">
      {/* Title / Turn status indicator */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider">
          {isMyTurn ? 'Your Tile Rack' : "Opponent's Turn"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onShuffle}
            className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all cursor-pointer"
          >
            🔀 Shuffle
          </button>
          <button
            onClick={onRecallAll}
            className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all cursor-pointer"
          >
            ↩️ Recall All
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
              onClick={() => isMyTurn && onSelectTile(idx)}
              disabled={!isMyTurn}
              className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center relative transition-all duration-150 transform ${
                isSelected
                  ? 'bg-indigo-500 text-white shadow-lg -translate-y-2 ring-2 ring-indigo-400 border-indigo-400'
                  : isMyTurn
                  ? 'bg-amber-100 hover:bg-amber-50 text-slate-800 hover:shadow-md cursor-pointer border border-amber-200'
                  : 'bg-slate-800 text-slate-600 border border-slate-700/50 cursor-not-allowed'
              }`}
            >
              <span className="text-sm font-black">{letter.toUpperCase() === '_' ? ' ' : letter.toUpperCase()}</span>
              <span className={`text-[7px] font-bold absolute bottom-0.5 right-1.5 ${
                isSelected ? 'text-white/70' : isMyTurn ? 'text-slate-500' : 'text-slate-600'
              }`}>
                {val}
              </span>
            </button>
          );
        })}
        {rack.length === 0 && (
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider py-3">
            Rack is empty
          </div>
        )}
      </div>
    </div>
  );
};
