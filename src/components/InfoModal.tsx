import { Lightbulb, X, Zap } from 'lucide-react';
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-2xl  uppercase text-gray-100 tracking-tighter mb-6">Game Info</h2>

        <div className="mt-3 space-y-6 text-sm">

          <div className="flex gap-4">
            <div className="bg-yellow-500/20 p-2 h-fit rounded-lg text-green-400">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">How It Works</p>
              <div className="text-gray-400 text-sm space-y-2">
                <p className="leading-relaxed mb-1">
                  Basically Wordle, with 4 or 5 letter words on a given day.</p>
                <p className="leading-relaxed mb-1">
                  5 guesses (for 4), 6 guesses (for 5) and 7 guesses (for 6)
                </p>

              </div>
            </div>
          </div>


          {/* Score Calculator Info */}
          <div className="flex gap-4">
            <div className="bg-yellow-500/20 p-2 h-fit rounded-lg text-yellow-400">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">Skill Index</p>
              <div className="text-gray-400 text-sm space-y-2">
                <p className="leading-relaxed mb-1">
                  Base score: 1000 for 1st try, 800 for 2nd, etc.
                </p>

                <ul className="grid grid-cols-2 gap-y-1 text-[12px] font-mono uppercase tracking-tighter">
                  <li className="flex items-center gap-2"><span className="text-correct">●</span>Each Green: +15 pts</li>
                  <li className="flex items-center gap-2"><span className="text-yellow-500">●</span>Each Yellow: +2 pts</li>
                  <li className="flex items-center gap-2"><span className="text-black">●</span>Each Black: -10 pts</li>
                  <li className="flex items-center gap-2"><span className="text-red-500">●</span> Hints: -200 pts</li>
                </ul>
                <p className="text-[10px] italic">Maximum precision earns the highest rank.</p>

              </div>
            </div>
          </div>


          {/* Hint Info */}
          <div className="flex gap-4">
            <div className="bg-yellow-500/20 p-2 h-fit rounded-lg text-yellow-500">
              <Lightbulb size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">Scrub Mode</p>
              <p className="text-gray-400 leading-relaxed">
                Stuck? A hint unlocks after your <span className="text-white font-bold">3rd attempt</span>. Using it marks your results with shame.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full bg-white text-black font-black py-3 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-tighter"
        >
          Got it
        </button>
      </div>
    </div>
  );
};