/* eslint-disable @typescript-eslint/no-explicit-any */
import { CHALLENGE_LIMITS } from "../../constants/challenge";
import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { parseMarathonGames } from "../../utils/marathon";
import formatUsername from "../../utils/formatUsername";

export const ChallengeSkeleton = memo(function ChallengeSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="w-full bg-white/5 border border-white/5 p-4 rounded-3xl flex flex-col gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <div className="h-4 w-32 bg-white/10 rounded" />
            </div>
            <div className="h-4 w-12 bg-white/10 rounded" />
          </div>
          <div className="flex items-center justify-between w-full">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-4 w-20 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const LobbyParticipantsSkeleton = memo(function LobbyParticipantsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-3 w-16 bg-white/10 rounded" />
            </div>
          </div>
          <div className="h-6 w-12 bg-white/10 rounded-xl" />
        </div>
      ))}
    </div>
  );
});

export const ErrorFallback = memo(function ErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="py-12 text-center">
      <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl border border-red-500/20 mb-4 mx-6">
        <p className="text-sm font-bold">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
});

export const ExpirationTimer = memo(function ExpirationTimer({
  expiresAt,
  createdAt,
}: {
  expiresAt: string;
  createdAt: string;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculate = () => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      setTimeLeft(Math.max(0, end - now));
    };
    calculate();
    const interval = setInterval(calculate, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft <= 0)
    return (
      <span className="text-red-500 text-[10px] font-black uppercase tracking-wider">
        Expired
      </span>
    );

  const totalDuration =
    new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  const percent = (timeLeft / totalDuration) * 100;

  let textClass = "text-correct";
  if (percent < 25) {
    textClass = "text-red-500";
  } else if (percent < 50) {
    textClass = "text-yellow-500";
  }

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <span className={`${textClass} text-[10px] font-black uppercase tracking-wider`}>
      {days > 0
        ? `${days}d ${hours}h`
        : hours > 0
          ? `${hours}h ${minutes}m`
          : `${minutes}m`} left
    </span>
  );
});

export const ChallengeItem = memo(function ChallengeItem({
  item,
  user,
  onSelect,
  index,
}: {
  item: any;
  user: any;
  onSelect: (id: string) => void;
  index: number;
}) {
  const { challenge, status, score, challenge_id } = item;
  const {
    expires_at,
    created_at,
    mode,
    word_length,
    participants: rawParticipants,
  } = challenge;

  const isExpired = useMemo(
    () => new Date(expires_at) < new Date(),
    [expires_at],
  );
  const isFinished = useMemo(
    () =>
      status === "completed" || status === "timed_out" || status === "declined",
    [status],
  );

  const participants = useMemo(() => rawParticipants || [], [rawParticipants]);

  const maxScore = useMemo(() => {
    let max = 0;
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (p.status !== "pending") {
        const s = p.score || 0;
        if (s > max) max = s;
      }
    }
    return max;
  }, [participants]);

  const myScore = score || 0;
  const hasStarted =
    status !== "pending" && status !== "open" && status !== "not_joined";

  const handleSelect = useCallback(() => {
    onSelect(challenge_id);
  }, [onSelect, challenge_id]);

  const opponents = useMemo(
    () =>
      participants.filter(
        (p: any) => p.user_id !== user?.id && p.guest_id !== user?.id,
      ),
    [participants, user?.id],
  );

  const isSelfChallenge = useMemo(
    () => !isExpired && opponents.length === 0 && !challenge.is_public,
    [isExpired, opponents.length, challenge.is_public],
  );

  const leaderParticipant = useMemo(() => {
    if (maxScore === 0) return null;
    return participants.find((p: any) => p.score === maxScore);
  }, [participants, maxScore]);

  const showOpponentLeader =
    leaderParticipant &&
    leaderParticipant.user_id !== user?.id &&
    leaderParticipant.guest_id !== user?.id;

  const isMarathon = word_length === 1;

  const marathonCompletedCount = useMemo(() => {
    if (!isMarathon || !item.marathon_progress) return 0;
    let count = 0;
    for (let i = 0; i < item.marathon_progress.length; i++) {
      const s = item.marathon_progress[i].status;
      if (s === "completed" || s === "timed_out") count++;
    }
    return count;
  }, [isMarathon, item.marathon_progress]);

  const totalMarathonGames = useMemo(() => {
    if (!isMarathon) return 0;
    return parseMarathonGames(challenge.target_word, challenge.salt).length;
  }, [isMarathon, challenge.target_word, challenge.salt]);

  const guesses = item.attempts || item.guesses?.length || 0;
  const guessLabel = guesses === 1 ? "Guess" : "Guesses";

  const isNewChallenge = useMemo(() => {
    const diffMs = Date.now() - new Date(created_at).getTime();
    return diffMs < 3600000 && diffMs >= 0 && !isFinished;
  }, [created_at, isFinished]);

  const itemType = useMemo((): 'active' | 'open' | 'played' | 'expired' => {
    if (status === 'open') return 'open';
    if (isExpired) return 'expired';
    if (isFinished) return 'played';
    return 'active';
  }, [status, isExpired, isFinished]);

  const gameType = useMemo(() => {
    if (mode === "LIVE") return isMarathon ? 'timed-marathon' : 'timed-single';
    return isMarathon ? 'untimed-marathon' : 'untimed-single';
  }, [mode, isMarathon]);

  const bgGradient = gameType === 'timed-single' ? 'from-red-500/[15%] to-transparent' :
    gameType === 'timed-marathon' ? 'from-amber-500/[15%] to-transparent' :
      gameType === 'untimed-single' ? 'from-cyan-500/[15%] to-transparent' :
        'from-violet-500/[15%] to-transparent';

  const borderAccent = itemType === 'active' ? 'border-l-indigo-500 border-l-[3px]' :
    itemType === 'open' ? 'border-l-sky-500 border-l-[3px]' :
      itemType === 'played' ? 'border-l-emerald-500 border-l-[3px]' :
        'border-l-red-500/50 border-l-[3px]';

  return (
    <button
      onClick={handleSelect}
      className={`w-full text-left bg-linear-to-br ${bgGradient} ${borderAccent} border border-white/5 p-3 sm:p-4 rounded-3xl hover:bg-white/10 transition-all duration-300 relative overflow-hidden`}
    >
      {/* Row 1: Header */}
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-white">
          <span className="font-mono">#{index + 1}</span>
          <span className="text-white/40">·</span>
          <span>{mode === "LIVE" ? "LIVE" : "ASYNC"}</span>
          <span className="text-white/40">·</span>
          {challenge?.is_sentence ? (
            <span className="text-indigo-400 font-black text-[10px] tracking-wide">S</span>
          ) : isMarathon ? (
            <span>MARATHON</span>
          ) : (
            <span>{word_length} LETTERS</span>
          )}
          {challenge.creator && (
            <>
              <span className="text-white/40">·</span>
              <span className="text-white/50 font-bold">
                @{challenge.is_bot_marathon ? "Variant Bot" : formatUsername(challenge.creator?.username) || "Host"}
              </span>
            </>
          )}
        </div>

        {!isExpired && !isFinished ? (
          <ExpirationTimer expiresAt={expires_at} createdAt={created_at} />
        ) : isExpired ? (
          <span className="text-red-500 text-[10px] font-black uppercase tracking-wider">Expired</span>
        ) : (
          <span className="text-correct text-[10px] font-black uppercase tracking-wider">Done</span>
        )}
      </div>

      {/* Row 2: Main status + secondary info */}
      <div className="flex items-baseline justify-between w-full">
        <div className="text-xs sm:text-sm font-black text-white">
          {status === "host" ? (
            "Host (Spectating)"
          ) : status === "timed_out" ? (
            <span className="text-red-500">Time Expired</span>
          ) : isMarathon && hasStarted ? (
            <>{marathonCompletedCount}/{totalMarathonGames} Games</>
          ) : (status === "completed" || status === "playing") && hasStarted ? (
            <>{myScore} pts{
              guesses > 0 && status === "completed" ? (
                <span className="text-white/60 font-bold ml-1.5">· {guesses} {guessLabel}</span>
              ) : null
            }</>
          ) : (
            <span className="text-white/60">Open</span>
          )}
        </div>

        <div className="text-[10px] sm:text-xs font-bold text-white/60 text-right">
          {hasStarted && showOpponentLeader ? (
            <span>vs @{leaderParticipant.profiles?.username || "Player"} ({leaderParticipant.score})</span>
          ) : isSelfChallenge ? (
            <span>Solo</span>
          ) : null}
        </div>
      </div>

      {isNewChallenge && (
        <div className="absolute top-2 right-2 z-20 px-2 py-0.5 bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 text-[9px] font-black uppercase tracking-wider rounded-full shadow-lg backdrop-blur-sm pointer-events-none">
          New
        </div>
      )}
    </button>
  );
});

export const NetworkLog = memo(function NetworkLog({
  logs,
}: {
  logs: Array<{ id: string; msg: string; duration?: number }>;
}) {
  if (logs.length === 0) return null;
  return (
    <div className="absolute top-2 right-2 z-110 flex-col items-end gap-1 pointer-events-none max-w-[200px] hidden">
      {logs.slice(-CHALLENGE_LIMITS.MAX_CONNECTION_LOGS).map((log, index) => (
        <div
          key={log.id}
          className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 text-[8px] font-mono text-white uppercase tracking-tighter animate-in fade-in slide-in-from-right-2"
        >
          {index + 1}. {log.msg}{" "}
          {log.duration !== undefined && (
            <span className="text-correct">({log.duration}ms)</span>
          )}
        </div>
      ))}
    </div>
  );
});
