import { Gamepad2, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';

interface WelcomeScreenProps {
  onPlayAsGuest: () => void;
  onSignIn: () => void;
}

export const WelcomeScreen = ({ onPlayAsGuest, onSignIn }: WelcomeScreenProps) => {
  return (
    <div className="fixed inset-0 bg-dark flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-2"
        >
          <div className="bg-correct/10 px-3 py-1 rounded-xl border border-correct/20 inline-block">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
              V<span className="sm:inline">ariant</span><span className="text-correct">.</span>
            </h1>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-10 text-center"
        >
          Guess the word. Challenge your friends.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="w-full space-y-4"
        >
          <button
            onClick={onPlayAsGuest}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left hover:bg-white/[0.07] active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 bg-correct/10 p-2.5 rounded-xl border border-correct/20 group-hover:bg-correct/20 transition-colors">
                <Gamepad2 className="w-5 h-5 text-correct" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-1">
                  Play Without Login
                </h3>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                  Jump right in — no account needed. Your progress saves locally.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onSignIn}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left hover:bg-white/[0.07] active:scale-[0.98] transition-all cursor-pointer group relative"
          >
            <div className="absolute -top-2.5 right-3 bg-correct text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-black/10 z-10 pointer-events-none">
              Recommended
            </div>
            <div className="flex items-start gap-4">
              <div className="shrink-0 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                <LogIn className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-1">
                  Sign In
                </h3>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                  Sync scores across devices, climb leaderboards, challenge friends & more.
                </p>
              </div>
            </div>
          </button>
        </motion.div>
      </div>

      <div className="shrink-0 pb-8 px-6 text-center">
        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
          You must choose a mode to play
        </p>
      </div>
    </div>
  );
};
