import { Gamepad2, LogIn, Swords, Grid3X3, Trophy, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface WelcomeScreenProps {
  onPlayAsGuest: () => void;
  onSignIn: () => void;
}

export const WelcomeScreen = ({ onPlayAsGuest, onSignIn }: WelcomeScreenProps) => {
  return (
    <div className="fixed inset-0 bg-dark flex flex-col overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full shrink-0 min-h-[85vh]">
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

        <div className="mt-8 text-center">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            You must choose a mode to play
          </p>
        </div>
      </div>

      {/* Crawlable SEO & Feature Overview Section */}
      <section
        aria-label="About Variant Multiplayer Word Game"
        className="w-full max-w-md mx-auto px-6 pb-10 pt-2 border-t border-white/5 text-gray-400 space-y-6 shrink-0"
      >
        <div className="space-y-2 text-center">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-300">
            Multiplayer Word Puzzles &amp; Trivia Battles
          </h2>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Variant is a free online multiplayer word game platform combining daily 5-letter word challenges, real-time 1v1 races, turn-based trivia battles, and tactical crossword grids.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <article className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-correct">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-200">Daily Word</h3>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Solve the daily hidden word in 6 tries, build streaks, and play past puzzles in the archive.
            </p>
          </article>

          <article className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <Swords className="w-3.5 h-3.5 shrink-0" />
              <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-200">WordUp 1v1</h3>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Battle friends or bots in live and async trivia across vocabulary, idioms, science &amp; more.
            </p>
          </article>

          <article className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Grid3X3 className="w-3.5 h-3.5 shrink-0" />
              <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-200">WordGrid</h3>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Outsmart opponents on a tactical shared crossword grid in turn-based multiplayer matches.
            </p>
          </article>

          <article className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-200">Marathons</h3>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Compete in custom multi-word friend lobbies, daily bot marathons, and global leaderboards.
            </p>
          </article>
        </div>

        <footer className="pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
          <a href="/wordup" className="hover:text-gray-400 transition-colors">WordUp</a>
          <span>•</span>
          <a href="/wordgrid" className="hover:text-gray-400 transition-colors">WordGrid</a>
          <span>•</span>
          <a href="/challenges" className="hover:text-gray-400 transition-colors">Challenges</a>
          <span>•</span>
          <a href="/leaderboard" className="hover:text-gray-400 transition-colors">Leaderboard</a>
          <span>•</span>
          <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
          <span>•</span>
          <a href="/tos" className="hover:text-gray-400 transition-colors">Terms</a>
          <span>•</span>
          <a href="/deletion" className="hover:text-gray-400 transition-colors">Data Deletion</a>
        </footer>
      </section>
    </div>
  );
};
