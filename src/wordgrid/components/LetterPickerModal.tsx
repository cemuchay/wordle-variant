import { X } from 'lucide-react';
import { TILE_VALUES } from '../../utils/wordgrid/constants';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface LetterPickerModalProps {
   open: boolean;
   rack: string[];
   /** True when the currently selected rack tile is a blank ('_') */
   blankPreSelected: boolean;
   onClose: () => void;
   onChoose: (letter: string) => void;
}

/**
 * Scrabble-style letter chooser for empty board cells.
 * Letters you hold are placed directly; any other letter consumes one of
 * your blank ('_') tiles and scores 0.
 */
export default function LetterPickerModal({
   open,
   rack,
   blankPreSelected,
   onClose,
   onChoose,
}: LetterPickerModalProps) {
   if (!open) return null;

   const hasBlank = rack.includes('_');

   return (
      <div
         className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
         onClick={onClose}
      >
         <div
            className="bg-[#0c121e] border border-slate-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex items-start justify-between gap-2">
               <div className="text-left">
                  <h4 className="text-sm font-black uppercase text-white tracking-wider">Choose a Letter</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-snug">
                     {blankPreSelected
                        ? 'Assigning your blank tile — it scores 0 points'
                        : 'Tap a letter you hold, or pick any letter to spend a blank (0 pts)'}
                  </p>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
               >
                  <X size={14} />
               </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
               {ALPHABET.map((L) => {
                  const heldCount = rack.filter((r) => r === L).length;
                  const usableViaRack = heldCount > 0 && !blankPreSelected;
                  const usableViaBlank = hasBlank && !usableViaRack;
                  const usable = blankPreSelected || usableViaRack || usableViaBlank;
                  const usesBlank = !blankPreSelected && heldCount === 0;

                  return (
                     <button
                        key={L}
                        type="button"
                        disabled={!usable}
                        onClick={() => onChoose(L)}
                        title={
                           !usable
                              ? "You don't hold this letter or a blank"
                              : usesBlank
                                 ? `Play blank as ${L} · 0 pts`
                                 : `Play ${L} · ${TILE_VALUES[L]} pt${TILE_VALUES[L] === 1 ? '' : 's'}`
                        }
                        className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                           usable
                              ? 'bg-slate-800 border border-slate-700 hover:bg-indigo-600/80 hover:border-indigo-400 text-white cursor-pointer active:scale-95'
                              : 'bg-slate-900/60 border border-slate-800/60 text-slate-700 cursor-not-allowed'
                        }`}
                     >
                        <span className="text-sm font-black leading-none">{L}</span>
                        {usesBlank ? (
                           <span className="text-[7px] font-black text-emerald-400 mt-0.5">BLANK·0</span>
                        ) : (
                           <span className={`text-[8px] font-black mt-0.5 ${usable ? 'text-slate-400' : 'text-slate-600'}`}>
                              {TILE_VALUES[L]}
                              {heldCount > 1 ? ` ×${heldCount}` : ''}
                           </span>
                        )}
                     </button>
                  );
               })}
            </div>

            <button
               type="button"
               onClick={onClose}
               className="w-full py-2.5 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase text-white transition-all cursor-pointer"
            >
               Cancel
            </button>
         </div>
      </div>
   );
}
