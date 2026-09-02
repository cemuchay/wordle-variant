import React from "react";
import { motion } from "framer-motion";
import type { GuessResult } from "../../types/game";
import { useApp } from "../../context/AppContext";
import { WordTriviaCard } from "./WordTriviaCard";
import { ShareCard } from "./ShareCard";
import { NextActionCard } from "./NextActionCard";
import { StreakMilestoneCard } from "./StreakMilestoneCard";
import { MiniLeaderboardSnapshot } from "./MiniLeaderboardSnapshot";

interface PostGameHubProps {
  word: string;
  guesses: GuessResult[][];
  maxAttempts: number;
  isWon: boolean;
  usedHint: boolean;
  gameMessage?: string;
  date: string;
  hintRecord?: { index: number; letter: string; row?: number } | null;
  onNavigate: (item: "play" | "chat" | "leaderboard" | "challenges" | "wordup") => void;
  onOpenFreePlay?: (mode: "guest" | "archive") => void;
  activeDailyMarathons?: any[];
  isMarathonLoading?: boolean;
  isMarathonError?: boolean;
  setSelectedChallengeId?: (id: string | null) => void;
  setIsChallengeOpen?: (open: boolean) => void;
}

export const PostGameHub: React.FC<PostGameHubProps> = ({
  word,
  guesses,
  maxAttempts,
  isWon,
  usedHint,
  gameMessage,
  date,
  hintRecord,
  onNavigate,
  onOpenFreePlay,
  activeDailyMarathons = [],
  isMarathonLoading = false,
  isMarathonError = false,
  setSelectedChallengeId,
  setIsChallengeOpen,
}) => {
  const { stats, profile } = useApp();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full mx-auto flex flex-col space-y-3 pb-8 md:pb-2 pt-1 px-1 text-white"
    >
      {/* Row 1: Share Victory Card & Word Trivia Side by Side on Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <ShareCard
          date={date}
          guesses={guesses}
          maxAttempts={maxAttempts}
          won={isWon}
          usedHint={usedHint}
          gameMessage={gameMessage}
          wordLength={word.length}
          hintRecord={hintRecord}
          isAuthenticated={!!profile}
        />

        <WordTriviaCard
          word={word}
          isWon={isWon}
          attemptsCount={guesses.length}
          maxAttempts={maxAttempts}
          date={date}
        />
      </div>

      {/* Row 2: Secondary Game Loops & Launchpads */}
      <NextActionCard
        onOpenArchive={() => onOpenFreePlay?.("archive")}
        onOpenGuestGame={() => onOpenFreePlay?.("guest")}
        onNavigateWordUp={() => onNavigate("wordup")}
        onNavigateChallenges={() => onNavigate("challenges")}
        activeDailyMarathons={activeDailyMarathons}
        isMarathonLoading={isMarathonLoading}
        isMarathonError={isMarathonError}
        setSelectedChallengeId={setSelectedChallengeId}
        setIsChallengeOpen={setIsChallengeOpen}
      />

      {/* Row 3: Streak Milestones & Leaderboard Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <StreakMilestoneCard
          stats={stats}
          guesses={guesses}
          isWon={isWon}
        />

        <MiniLeaderboardSnapshot
          onOpenLeaderboard={() => onNavigate("leaderboard")}
        />
      </div>
    </motion.div>
  );
};
