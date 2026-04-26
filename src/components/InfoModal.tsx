import { Calendar, Lightbulb, X } from 'lucide-react';
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

        <h2 className="text-2xl font-black uppercase text-white tracking-tighter mb-6">How to Play</h2>

        <div className="space-y-6 text-sm">
          {/* Date Picker Info */}
          <div className="flex gap-4">
            <div className="bg-blue-500/20 p-2 h-fit rounded-lg text-blue-400">
              <Calendar size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">Time Travel</p>
              <p className="text-gray-400 leading-relaxed">
                Click the date to play past puzzles. Word length (4, 5, or 6) changes daily.
              </p>
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