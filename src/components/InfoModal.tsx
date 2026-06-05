import { Lightbulb, X, Zap } from 'lucide-react';
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-110 p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0))]">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[75vh] sm:max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-800/60 shrink-0">
          <h2 className="text-xl uppercase text-gray-100 tracking-tighter">Game Info</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 pt-4 space-y-6 text-sm overflow-y-auto flex-1 custom-scrollbar">
          <div className="flex gap-4">
            <div className="bg-yellow-500/20 p-2 h-fit rounded-lg text-green-400">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">How It Works</p>
              <p className="mb-4 leading-relaxed border-b border-gray-800 pb-3">
                Find the hidden <span className="text-indigo-400 font-medium">3, 4, 5, 6 or 7 letter</span> word of the day. You have <span className="text-white">6 tries</span> to solve it.
              </p>

              <div className="space-y-3">
                {/* Green State */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                  <p><span className="text-gray-200 font-medium">Green:</span> In the word and in the <span className="text-green-400">right position</span>.</p>
                </div>

                {/* Yellow State */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                  <p><span className="text-gray-200 font-medium">Yellow:</span> In the word, but in the <span className="text-yellow-400">wrong position</span>.</p>
                </div>

                {/* Black/Dark State */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-gray-700" />
                  <p><span className="text-gray-200 font-medium">Gray:</span> Not in the word at all.</p>
                </div>
              </div>
            </div>
          </div>


          {/* Score Calculator Info */}
          <div className="flex gap-4">
            <div className="bg-indigo-500/20 p-2 h-fit rounded-lg text-indigo-400">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">Skill Index</p>
              <div className="text-gray-400 text-sm space-y-3">
                <p className="leading-relaxed mb-1">
                  Your performance is tracked via a <span className="text-white font-bold">Skill Index</span>. Points are awarded for <span className="text-indigo-400">new letter discoveries</span>:
                </p>

                <div className="bg-black/20 p-3 rounded-xl border border-gray-800 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono border-b border-gray-800 pb-1">
                    <span className="text-gray-500">TYPE</span>
                    <span className="text-gray-500">1ST / 2ND / OTHER</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-correct">● GREEN</span>
                    <span className="text-white font-black">+60 / +50 / +40</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-yellow-500">● YELLOW</span>
                    <span className="text-white font-black">+35 / +30 / +25</span>
                  </div>
                </div>

                <ul className="grid grid-cols-1 gap-y-1 text-[11px] font-mono uppercase tracking-tighter pt-1">
                  <li className="flex items-center gap-2"><span className="text-gray-500">●</span>New Black: <span className="text-red-400">-5 pts</span></li>
                  <li className="flex items-center gap-2"><span className="text-red-500">●</span>Repeated Black: <span className="text-red-500 font-bold">-20 pts</span></li>
                  <li className="flex items-center gap-2"><span className="text-red-600">●</span>Hints Used: <span className="text-red-600">-100 pts</span></li>
                  <li className="flex items-center gap-2"><span className="text-blue-400">●</span>Click any player to see their full row breakdown!</li>
                </ul>
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
                Stuck? A hint unlocks after your <span className="text-white font-bold">2nd attempt</span>. Using it marks your result with shame. <span className="text-red-500 font-bold">Locked on the last guess or when only 1 letter remains!</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-gray-800/60 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-white text-black font-black py-3 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-tighter"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};