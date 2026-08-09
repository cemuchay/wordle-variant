/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Calendar, Trophy, Eye, Swords, HelpCircle, X } from "lucide-react";
import { MarathonBanner } from "./common/MarathonBanner";
import CountDown from "./common/CountDown"

interface AlreadyPlayedScreenProps {
  onNavigate: (item: "play" | "chat" | "leaderboard" | "challenges" | "wordup") => void;
  onAdmirePuzzle: () => void;
  onOpenFreePlay?: (mode: 'guest' | 'archive') => void;
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
  onOpenFreePlay,
  activeDailyMarathons,
  isMarathonLoading = false,
  isMarathonError = false,
  setSelectedChallengeId,
  setIsChallengeOpen,
}: AlreadyPlayedScreenProps) => {
  const [selectedDetail, setSelectedDetail] = useState<OptionDetail | null>(null);

  const options: OptionDetail[] = [
    {
      title: "See Your Board",
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
      title: "Play WordUp",
      shortDesc: "Battle friends with quick fire questions and answers.",
      fullDesc: "WordUp is a fast-paced multiplayer game mode. Play live or async matches, guess words based on definitions, and challenge friends or bots.",
      icon: <Swords className="text-indigo-400" size={20} />,
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto scrollbar-hide px-4 sm:px-8 py-6 flex flex-col items-center justify-start select-none text-white bg-dark">
      <div className="w-full max-w-3xl mx-auto flex flex-col space-y-6">

        {/* Top Header Block */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center space-y-3 bg-slate-900/70 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <CountDown isOpen={true} />

          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
              Daily Puzzle Completed! 🎉
            </h2>
          </div>
        </motion.div>

        {/* TOP SECTION: Daily Bot Event Marathon Banner */}
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
            transition={{ delay: 0.05, duration: 0.3 }}
            className="w-full border border-white/5 rounded-3xl overflow-hidden shadow-xl"
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

        {/* MOBILE HORIZONTAL SCROLL STRIP (visible on mobile < md) */}
        <div className="block md:hidden w-full">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
              ⚡ Select Game Mode
            </span>
            <span className="text-[10px] text-gray-400 font-bold">Swipe &rarr;</span>
          </div>
          <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide space-x-3 pb-3 -mx-4 px-4">

            {/* 1. See Your Board */}
            <button
              onClick={onAdmirePuzzle}
              className="snap-center shrink-0 w-60 p-4 bg-slate-900/90 border border-emerald-500/30 rounded-2xl flex flex-col justify-between gap-3 shadow-xl text-left active:scale-98"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Eye size={20} />
                </div>
                <span className="text-[9px] font-black uppercase text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">Today</span>
              </div>
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-white">See Your Board</h4>
                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight">Review completed grid & share results.</p>
              </div>
            </button>

            {/* 2. Play Archive */}
            <button
              onClick={() => onOpenFreePlay?.('archive')}
              className="snap-center shrink-0 w-60 p-4 bg-linear-to-br from-indigo-950/90 via-slate-900 to-slate-950 border border-indigo-500/40 rounded-2xl flex flex-col justify-between gap-3 shadow-xl text-left active:scale-98"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                  <Calendar size={20} />
                </div>
                <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Archive</span>
              </div>
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-white">Play Archive</h4>
                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight">Browse and play past daily puzzles.</p>
              </div>
            </button>

            {/* 3. Play Guest Game */}
            <button
              onClick={() => onOpenFreePlay?.('guest')}
              className="snap-center shrink-0 w-60 p-4 bg-linear-to-br from-emerald-950/90 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl flex flex-col justify-between gap-3 shadow-xl text-left active:scale-98"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                  <Gamepad2 size={20} />
                </div>
                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Local</span>
              </div>
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-white">Play Guest Game</h4>
                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight">Daily local puzzle without cloud stats.</p>
              </div>
            </button>

            {/* 4. See Leaderboard */}
            <button
              onClick={() => onNavigate("leaderboard")}
              className="snap-center shrink-0 w-60 p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl flex flex-col justify-between gap-3 shadow-xl text-left active:scale-98"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Trophy size={20} />
                </div>
                <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Rank</span>
              </div>
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-white">See Leaderboard</h4>
                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight">Compare daily stats & player rank.</p>
              </div>
            </button>

            {/* 5. Play WordUp */}
            <button
              onClick={() => onNavigate("wordup")}
              className="snap-center shrink-0 w-60 p-4 bg-slate-900/90 border border-indigo-500/30 rounded-2xl flex flex-col justify-between gap-3 shadow-xl text-left active:scale-98"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                  <Swords size={20} />
                </div>
                <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">PVP</span>
              </div>
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-white">Play WordUp</h4>
                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight">Fast-paced multiplayer battle mode.</p>
              </div>
            </button>
          </div>
        </div>

        {/* DESKTOP 2-COLUMN GRID (visible on desktop md:grid) */}
        <div className="hidden md:grid md:grid-cols-2 gap-5 items-stretch">

          {/* LEFT COLUMN: Free Play & Archive Modes */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex flex-col space-y-3 bg-slate-900/50 border border-white/5 rounded-3xl p-4 backdrop-blur-md shadow-xl"
          >
            <div className="flex items-center justify-between px-1 pb-1 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                🎮 Non-Competitive Modes
              </span>
              <span className="text-[10px] text-gray-400 font-bold">Local Play</span>
            </div>

            {/* Play Guest Game Card */}
            <button
              onClick={() => onOpenFreePlay?.('guest')}
              className="p-4 bg-linear-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl flex items-center gap-3.5 transition-all duration-300 shadow-lg group cursor-pointer active:scale-98 text-left"
            >
              <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/40 text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                <Gamepad2 size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black uppercase tracking-wider text-white group-hover:text-emerald-300 transition-colors">
                  Play Guest Game
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-tight">
                  Free-play daily puzzle without cloud stats. Resets every midnight.
                </p>
              </div>
            </button>

            {/* Play Archive Card */}
            <button
              onClick={() => onOpenFreePlay?.('archive')}
              className="p-4 bg-linear-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl flex items-center gap-3.5 transition-all duration-300 shadow-lg group cursor-pointer active:scale-98 text-left"
            >
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/40 text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                <Calendar size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black uppercase tracking-wider text-white group-hover:text-indigo-300 transition-colors">
                  Play Archive
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium leading-tight">
                  Browse and play past daily puzzles with date picker & shuffle.
                </p>
              </div>
            </button>
          </motion.div>

          {/* RIGHT COLUMN: Daily Options & Hub */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="flex flex-col space-y-3 bg-slate-900/50 border border-white/5 rounded-3xl p-4 backdrop-blur-md shadow-xl"
          >
            <div className="flex items-center justify-between px-1 pb-1 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                🏆 Daily Hub & Stats
              </span>
              <span className="text-[10px] text-gray-400 font-bold">Community</span>
            </div>

            {/* See Your Board */}
            <div className="group relative flex items-center justify-between bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 hover:border-emerald-500/40 transition-all duration-300 shadow-md">
              <div onClick={onAdmirePuzzle} className="flex-1 flex items-center gap-3 cursor-pointer">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                  {options[0].icon}
                </div>
                <div className="text-left min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-emerald-400 transition-colors truncate">
                    {options[0].title}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-tight truncate">Review grid & share results</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(options[0])}
                className="p-1.5 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <HelpCircle size={16} />
              </button>
            </div>

            {/* See Leaderboard */}
            <div className="group relative flex items-center justify-between bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 hover:border-amber-500/40 transition-all duration-300 shadow-md">
              <div onClick={() => onNavigate("leaderboard")} className="flex-1 flex items-center gap-3 cursor-pointer">
                <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                  {options[1].icon}
                </div>
                <div className="text-left min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-amber-400 transition-colors truncate">
                    {options[1].title}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-tight truncate">Check global stats & rank</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(options[1])}
                className="p-1.5 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <HelpCircle size={16} />
              </button>
            </div>

            {/* Play WordUp */}
            <div className="group relative flex items-center justify-between bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 hover:border-indigo-500/40 transition-all duration-300 shadow-md">
              <div onClick={() => onNavigate("wordup")} className="flex-1 flex items-center gap-3 cursor-pointer">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
                  {options[2].icon}
                </div>
                <div className="text-left min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-indigo-400 transition-colors truncate">
                    {options[2].title}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-tight truncate">Battle friends in multiplayer</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(options[2])}
                className="p-1.5 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <HelpCircle size={16} />
              </button>
            </div>

          </motion.div>
        </div>
      </div>

      {/* Details / Help Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
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
                  if (detail.title === "See Your Board") {
                    onAdmirePuzzle();
                  } else if (detail.title === "See Leaderboard") {
                    onNavigate("leaderboard");
                  } else if (detail.title === "Play WordUp") {
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
