import { Calendar, ChevronRight, Gamepad2, Home, Swords } from "lucide-react";
import { MarathonBanner } from "../common/MarathonBanner";

interface NextActionCardProps {
  onOpenArchive: () => void;
  onOpenGuestGame: () => void;
  onNavigateWordUp: () => void;
  onNavigateChallenges: () => void;
  isGuestGame?: boolean;
  onReturnHome?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeDailyMarathons?: any[];
  isMarathonLoading?: boolean;
  isMarathonError?: boolean;
  setSelectedChallengeId?: (id: string | null) => void;
  setIsChallengeOpen?: (open: boolean) => void;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  onOpenArchive,
  onOpenGuestGame,
  onNavigateWordUp,
  onNavigateChallenges,
  isGuestGame = false,
  onReturnHome,
  activeDailyMarathons = [],
  isMarathonLoading = false,
  isMarathonError = false,
  setSelectedChallengeId,
  setIsChallengeOpen,
}) => {
  return (
    <div className="w-full space-y-4">
      {/* Daily Bot Marathon Banner if available */}
      {isMarathonLoading ? (
        <div className="w-full h-20 bg-slate-900/50 border border-white/5 rounded-2xl animate-pulse flex flex-col justify-center px-6 gap-2" />
      ) : isMarathonError || !activeDailyMarathons || activeDailyMarathons.length === 0 ? (
        <div
          onClick={onNavigateChallenges}
          className="w-full flex items-center justify-between bg-red-800 rounded-2xl p-4 transition-all duration-300 shadow-md cursor-pointer group"
        >
          <div className="flex items-center gap-2 md:gap-3 text-left">

            <div className="p-4">
              <span className="text-[14px] font-black uppercase tracking-widest text-white">Marathons & Challenges</span>
              <p className="text-[12px] text-white leading-tight">Compete in player lobbies and custom word rooms.</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
        </div>
      ) : (
        <div className="w-full border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <MarathonBanner
            challenges={activeDailyMarathons}
            onClick={(challenge) => {
              if (setSelectedChallengeId && setIsChallengeOpen) {
                setSelectedChallengeId(challenge.challenge_id || challenge.challenge?.id);
                setIsChallengeOpen(true);
              } else {
                onNavigateChallenges();
              }
            }}
          />
        </div>
      )}

      {/* Secondary Quick Action Launchpads */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Play Archive */}
        <button
          onClick={onOpenArchive}
          className="p-2.5 sm:p-3.5 bg-linear-to-br from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-lg group cursor-pointer active:scale-98 text-left"
        >
          <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/40 text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
            <Calendar size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-indigo-300 transition-colors truncate">
              Daily Archive
            </h5>
            <p className="text-[10px] text-gray-400 leading-tight truncate">Play any old puzzle</p>
          </div>
        </button>

        {/* Play WordUp */}
        <button
          onClick={onNavigateWordUp}
          className="p-2.5 sm:p-3.5 bg-linear-to-br from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/30 hover:border-purple-400 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-lg group cursor-pointer active:scale-98 text-left"
        >
          <div className="p-2.5 bg-purple-500/20 rounded-xl border border-purple-500/40 text-purple-400 group-hover:scale-110 transition-transform shrink-0">
            <Swords size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-purple-300 transition-colors truncate">
              Play WordUp
            </h5>
            <p className="text-[10px] text-gray-400 leading-tight truncate">Fast trivia word battle</p>
          </div>
        </button>

        {/* Practice / Guest Mode OR Return to Home */}
        {isGuestGame ? (
          <button
            onClick={onReturnHome}
            className="p-2.5 sm:p-3.5 bg-linear-to-br from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-lg group cursor-pointer active:scale-98 text-left"
          >
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/40 text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
              <Home size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-black uppercase tracking-wider text-indigo-400">Exit Mode</span>
              <h5 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-indigo-300 transition-colors truncate">
                Return to Home
              </h5>
              <p className="text-[10px] text-gray-400 leading-tight truncate">Back to main menu</p>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenGuestGame}
            className="p-3.5 bg-linear-to-br from-emerald-950/70 via-slate-900 to-slate-950 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-lg group cursor-pointer active:scale-98 text-left"
          >
            <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/40 text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
              <Gamepad2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-black uppercase tracking-wide text-white group-hover:text-emerald-300 transition-colors truncate">
                Guest Game
              </h5>
              <p className="text-[10px] text-gray-400 leading-tight truncate">Practice without stats</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
