import { useState } from 'react';
import { Lightbulb, GraduationCap, Zap } from 'lucide-react';
import { TutorialModal } from './TutorialModal';
import { ModalLayout } from './layout/ModalLayout';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export const InfoModal: React.FC<Props> = ({ isOpen, onClose, inline = false }) => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  if (!isOpen && !inline) return null;

  return (
    <>
      <ModalLayout
        isOpen={isOpen || inline}
        onClose={onClose}
        title="Game Info"
        maxWidth="sm"
        isOverlay={!inline}
        showCloseButton={true}
        className="p-4"
      >
        <div className="flex flex-col space-y-6 text-sm p-1">
          {/* How It Works */}
          <div className="flex gap-4">
            <div className="bg-yellow-500/20 p-2 h-fit rounded-lg text-green-400 shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">How It Works</p>
              <p className="mb-4 leading-relaxed border-b border-gray-800 pb-3 text-gray-300">
                Find the hidden <span className="text-indigo-400 font-medium">4, 5, 6 or 7 letter</span> word of the day. You have <span className="text-white">6 tries</span> to solve it.
              </p>

              <div className="space-y-3">
                {/* Green State */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                  <p><span className="text-gray-200 font-medium">Green:</span> In the word and in the <span className="text-green-400 font-semibold">right position</span>.</p>
                </div>

                {/* Yellow State */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                  <p><span className="text-gray-200 font-medium">Yellow:</span> In the word, but in the <span className="text-yellow-400 font-semibold">wrong position</span>.</p>
                </div>

                {/* Black/Dark State */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-gray-700" />
                  <p><span className="text-gray-200 font-medium">Gray:</span> Not in the word at all.</p>
                </div>
              </div>

              <button
                onClick={() => setIsTutorialOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer mt-4 shadow-lg shadow-indigo-950/40"
              >
                <GraduationCap size={14} />
                Play Interactive Tutorial
              </button>
            </div>
          </div>

          {/* Skill Index Info */}
          <div className="flex gap-4">
            <div className="bg-indigo-500/20 p-2 h-fit rounded-lg text-indigo-400 shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">Skill Index</p>
              <div className="text-gray-400 text-sm space-y-3">
                <p className="leading-relaxed mb-1">
                  Your performance is tracked via a <span className="text-white font-bold">Skill Index</span>. Points are awarded for <span className="text-indigo-400">new letter discoveries</span>:
                </p>

                <div className="bg-black/30 p-3 rounded-xl border border-gray-800 space-y-2">
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

          {/* Scrub Mode / Hint Info */}
          <div className="flex gap-4">
            <div className="bg-yellow-500/20 p-2 h-fit rounded-lg text-yellow-500 shrink-0">
              <Lightbulb size={20} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 uppercase tracking-wide">Scrub Mode</p>
              <p className="text-gray-400 leading-relaxed">
                Stuck? A hint unlocks after your <span className="text-white font-bold">2nd attempt</span>. Using it marks your result with shame. <span className="text-red-500 font-bold">Locked on the last guess or when only 1 letter remains!</span>
              </p>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-2 border-t border-white/10 shrink-0">
            <button
              onClick={onClose}
              className="w-full bg-white hover:bg-gray-200 text-black font-black py-3 rounded-xl transition-all uppercase tracking-wider text-xs active:scale-[0.98] cursor-pointer shadow-md"
            >
              Got it
            </button>
          </div>
        </div>
      </ModalLayout>

      {isTutorialOpen && (
        <TutorialModal
          onComplete={() => setIsTutorialOpen(false)}
          onSkip={() => setIsTutorialOpen(false)}
        />
      )}
    </>
  );
};

export default InfoModal;