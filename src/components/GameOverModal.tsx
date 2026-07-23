import { Eye, Trophy, X } from "lucide-react";
import React, { useState } from "react";
import { useIsStandalone } from "../hooks/useIsStandalone";
import { generateShareText } from "../lib/share";
import type { GameConfig, GameStats, GuessResult } from "../types/game";
import CountDown from "./common/CountDown";
import { ShareButton } from "./ShareButton";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  guesses: GuessResult[][];
  date: string;
  config: GameConfig;
  usedHint: boolean;
  gameMessage: string;
  stats: GameStats;
  isAuthenticated: boolean;
}

export const GameOverModal: React.FC<Props> = ({
  isOpen,
  onClose,
  guesses,
  date,
  config,
  usedHint,
  gameMessage,
  stats,
  isAuthenticated,
}) => {
  const won =
    guesses[guesses.length - 1]?.every((r) => r.status === "correct") ?? false;

  const [showWord, setShowWord] = useState(false);
  const isStandalone = useIsStandalone();

  const revealWord = () => {
    if (showWord) return; // Prevent multiple timers
    setShowWord(true);
    setTimeout(() => {
      setShowWord(false);
    }, 15000); // 15 seconds
  };

  const handleOpenLeaderboard = () => {
    onClose();
    window.dispatchEvent(
      new CustomEvent("open-stats-modal", { detail: { tab: "leaderboard" } }),
    );
  };

  // Defensive checks to prevent crashes if props are briefly inconsistent or missing
  if (!isOpen || !config || !guesses || guesses.length === 0 || !stats)
    return null;

  return (
    <div
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-150 p-4 overflow-y-auto ${isStandalone ? "pb-4" : "pb-20 sm:pb-4"
        }`}
    >
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-8 pt-2 shadow-2xl text-center relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-red-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/5 cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="mb-3 mt-6 flex flex-col items-center">
          {showWord ? (
            <h2 className="text-2xl font-serif font-bold text-white tracking-widest animate-in fade-in zoom-in duration-300">
              {config?.word || "???"}
            </h2>
          ) : (
            <button
              onClick={revealWord}
              className="group flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
            >
              <Eye
                size={14}
                className="text-gray-500 group-hover:text-correct transition-colors"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">
                Tap to reveal answer
              </span>
            </button>
          )}

          {showWord && (
            <div className="w-full max-w-25 h-0.5 bg-gray-800 mt-2 rounded-full overflow-hidden">
              <div className="h-full bg-correct animate-[progress_15s_linear_forwards]" />
            </div>
          )}
        </div>
        <p className="text-base font-serif font-bold text-white mb-6 mt-2">
          {gameMessage || (won ? "Splendid!" : "Next time!")}
        </p>

        {/* Statistics Section */}
        <div className="mb-8">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Statistics
          </h3>
          <div className="flex justify-between px-4 mb-4">
            <StatBox value={stats?.gamesPlayed ?? 0} label="Played" />
            <StatBox
              value={
                stats?.gamesPlayed
                  ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
                  : 0
              }
              label="Win %"
            />
            <StatBox value={stats?.currentStreak ?? 0} label="Streak" />
            <StatBox value={stats?.maxStreak ?? 0} label="Max" />
          </div>
          {
            isAuthenticated && (<button
              onClick={handleOpenLeaderboard}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-300 transition-all border border-white/5"
            >
              <Trophy size={14} className="text-yellow-500" /> See your place in
              the leaderboard
            </button>)
          }
        </div>

        {/* Guess Distribution */}
        <div className="mb-8 text-left">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 text-center">
            Guess Distribution
          </h3>
          <div className="space-y-1.5">
            {Object.entries(stats?.guesses || {}).map(([num, count]) => {
              const isCurrentDist = won && guesses.length === parseInt(num);
              const maxVal = Math.max(
                ...(Object.values(stats?.guesses || {}) as number[]),
                1,
              );
              return (
                <div key={num} className={`flex items-center gap-2 text-xs `}>
                  <span className="w-2 font-medium text-gray-300">{num}</span>
                  <div className="flex-1 h-4 bg-gray-800/50 rounded-md">
                    <div
                      style={{
                        width: `${Math.max(((count as number) / maxVal) * 100, 8)}%`,
                      }}
                      className={`h-full flex items-center justify-end px-1 font-bold text-white transition-all duration-1000 ${isCurrentDist ? "bg-correct" : num === "X" ? `bg-red-400` : "bg-gray-600"}`}
                    >
                      {count as number}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <hr className="border-gray-800 mb-6" />

        {/* Footer: Countdown & Share */}
        <div className="flex items-center justify-between gap-6">
          <CountDown isOpen={isOpen} />
          <div className="flex-1">
            <ShareButton
              text={generateShareText({
                date,
                guesses,
                maxAttempts: config?.maxAttempts || 6,
                won:
                  guesses[guesses.length - 1]?.every(
                    (r) => r.status === "correct",
                  ) ?? false,
                usedHint,
                gameMessage,
                wordLength: config?.word?.length || 0,
                isAuthenticated,
              })}
            />
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 text-gray-500 text-xs hover:text-white uppercase tracking-widest transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const StatBox = ({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) => (
  <div className="flex flex-col items-center">
    <span className="text-3xl font-light text-white">{value}</span>
    <span className="text-[9px] uppercase tracking-tighter text-gray-500">
      {label}
    </span>
  </div>
);
