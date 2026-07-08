/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Eye, Swords, HelpCircle, X, } from "lucide-react";
import { MarathonBanner } from "./common/MarathonBanner";

interface AlreadyPlayedScreenProps {
  onNavigate: (item: "play" | "chat" | "leaderboard" | "challenges" | "wordup") => void;
  onAdmirePuzzle: () => void;
  activeDailyMarathons: any[];
  isMarathonLoading?: boolean;
  isMarathonError?: boolean;
  setSelectedChallengeId: (id: string | null) => void;
  setIsChallengeOpen: (open: boolean) => void;
}

interface OptionDetail {
  title: string;
  shortDesc: string;
  fullDesc: string;
  icon: React.ReactNode;
}

export const AlreadyPlayedScreen = ({
  onNavigate,
  onAdmirePuzzle,
  activeDailyMarathons,
  isMarathonLoading = false,
  isMarathonError = false,
  setSelectedChallengeId,
  setIsChallengeOpen,
}: AlreadyPlayedScreenProps) => {
  const [selectedDetail, setSelectedDetail] = useState<OptionDetail | null>(null);

  const options: OptionDetail[] = [
    {
      title: "Admire Puzzle",
      shortDesc: "Review your completed board and share your pattern.",
      fullDesc: "Allows you to view today's solved or failed game grid. You can check the letters you guessed, copy your result to the clipboard, or share it with friends.",
      icon: <Eye className="text-emerald-400" size={20} />,
    },
    {
      title: "See Leaderboard",
      shortDesc: "Compare your stats and rank with other players.",
      fullDesc: "Opens the global leaderboard. Compare daily statistics, guess distribution, and check user rankings to see who has the best streak.",
      icon: <Trophy className="text-amber-400" size={20} />,
    },
    {
      title: "Try WordUp",
      shortDesc: "Race opponents in rapid multiplayer word battles.",
      fullDesc: "WordUp is a fast-paced multiplayer game mode. Play live or async matches, guess words based on definitions, and challenge friends or bots.",
      icon: <Swords className="text-indigo-400" size={20} />,
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-12 sm:px-6 flex flex-col justify-center items-center select-none text-white scrollbar-thin">
      <div className="w-full max-w-md mx-auto flex flex-col justify-center items-center space-y-6">
        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-2"
        >

          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider bg-clip-text text-transparent bg-linear-to-r from-white via-gray-200 to-gray-400">
            Already Played
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 font-medium max-w-xs mx-auto">
            You've completed today's puzzle! Keep the momentum going with these events.
          </p>
        </motion.div>

        {/* Main Options Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="w-full space-y-4"
        >
          {/* Admire Puzzle */}
          <div className="group relative flex items-center justify-between bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all duration-300 shadow-lg">
            <div
              onClick={onAdmirePuzzle}
              className="flex-1 flex items-center gap-3 cursor-pointer"
            >
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 group-hover:scale-105 transition-transform">
                {options[0].icon}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-emerald-400 transition-colors">
                  {options[0].title}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-tight">
                  {options[0].shortDesc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDetail(options[0])}
              className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              aria-label="Info"
            >
              <HelpCircle size={18} />
            </button>
          </div>

          {/* See Leaderboard */}
          <div className="group relative flex items-center justify-between bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all duration-300 shadow-lg">
            <div
              onClick={() => onNavigate("leaderboard")}
              className="flex-1 flex items-center gap-3 cursor-pointer"
            >
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 group-hover:scale-105 transition-transform">
                {options[1].icon}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-amber-400 transition-colors">
                  {options[1].title}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-tight">
                  {options[1].shortDesc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDetail(options[1])}
              className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              aria-label="Info"
            >
              <HelpCircle size={18} />
            </button>
          </div>

          {/* Try WordUp */}
          <div className="group relative flex items-center justify-between bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all duration-300 shadow-lg">
            <div
              onClick={() => onNavigate("wordup")}
              className="flex-1 flex items-center gap-3 cursor-pointer"
            >
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 group-hover:scale-105 transition-transform">
                {options[2].icon}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-indigo-400 transition-colors">
                  {options[2].title}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-tight">
                  {options[2].shortDesc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDetail(options[2])}
              className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              aria-label="Info"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </motion.div>

        {/* Daily Bot Event Marathon Banner */}
        {isMarathonLoading ? (
          <div className="w-full h-24 bg-slate-900/40 border border-white/5 rounded-2xl animate-pulse flex flex-col justify-center px-6 gap-2">
            <div className="h-3 bg-white/10 rounded-full w-24" />
            <div className="h-4 bg-white/10 rounded-full w-48" />
            <div className="h-3 bg-white/10 rounded-full w-32" />
          </div>
        ) : isMarathonError || !activeDailyMarathons || activeDailyMarathons.length === 0 ? (
          <div
            onClick={() => onNavigate("challenges")}
            className="w-full flex items-center justify-between bg-slate-900/40 backdrop-blur-md border border-white/5 border-dashed rounded-2xl p-4 hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all duration-300 shadow-lg cursor-pointer"
          >
            <div className="text-left space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Marathons Offline</span>
              <h4 className="text-xs font-black uppercase tracking-wide text-white">Check out active challenges</h4>
              <p className="text-[10px] text-gray-400 leading-tight">Find community games and player lobbies.</p>
            </div>
            <span className="text-indigo-400 font-bold text-xs shrink-0">&rarr;</span>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="w-full border border-white/5 rounded-2xl overflow-hidden shadow-xl"
          >
            <MarathonBanner
              challenges={activeDailyMarathons}
              onClick={(challenge) => {
                setSelectedChallengeId(challenge.challenge_id || challenge.challenge?.id);
                setIsChallengeOpen(true);
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Details / Help Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <button
                onClick={() => setSelectedDetail(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                  {selectedDetail.icon}
                </div>
                <h3 className="text-md font-black uppercase tracking-wider text-white">
                  {selectedDetail.title}
                </h3>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                  Details
                </p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {selectedDetail.fullDesc}
                </p>
              </div>

              <button
                onClick={() => {
                  const detail = selectedDetail;
                  setSelectedDetail(null);
                  if (detail.title === "Admire Puzzle") {
                    onAdmirePuzzle();
                  } else if (detail.title === "See Leaderboard") {
                    onNavigate("leaderboard");
                  } else if (detail.title === "Try WordUp") {
                    onNavigate("wordup");
                  }
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                Go to {selectedDetail.title}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
