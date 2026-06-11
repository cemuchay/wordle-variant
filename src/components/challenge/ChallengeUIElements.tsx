/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Trophy,
  Shield,
  Globe,
  Lock,
  Sparkles,
  User,
  Users,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatTime } from "./lib";

export const ChallengeSkeleton = memo(function ChallengeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 bg-white/5 rounded-4xl" />
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
    const interval = setInterval(calculate, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft <= 0)
    return (
      <span className="text-red-500 text-[10px] font-black uppercase">
        Expired
      </span>
    );

  const totalDuration =
    new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  const percent = (timeLeft / totalDuration) * 100;

  let colorClass = "bg-correct"; // Green
  let textClass = "text-correct";
  if (percent < 25) {
    colorClass = "bg-red-500";
    textClass = "text-red-500";
  } else if (percent < 50) {
    colorClass = "bg-yellow-500";
    textClass = "text-yellow-500";
  }

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`${textClass} text-[10px] font-black uppercase tracking-widest flex items-center gap-1`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${colorClass} animate-pulse`}
        />
        {days > 0
          ? `${days}d ${hours}h`
          : hours > 0
            ? `${hours}h ${minutes}m`
            : `${minutes}m`}{" "}
        left
      </span>
      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${colorClass}`}
        />
      </div>
    </div>
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
  const { challenge, status, score, time_taken, challenge_id } = item;
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
  const isLeader = myScore === maxScore && myScore > 0;
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

  // Find the current leader profile
  const leaderParticipant = useMemo(() => {
    if (maxScore === 0) return null;
    return participants.find((p: any) => p.score === maxScore);
  }, [participants, maxScore]);

  const formattedDate = useMemo(() => {
    const d = new Date(created_at);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [created_at]);

  const isMarathon = word_length === 1;

  return (
    <button
      onClick={handleSelect}
      className={`w-full text-left bg-linear-to-br from-white/5 to-transparent border ${isExpired
        ? "border-white/5 opacity-65 hover:opacity-100 hover:border-white/15"
        : isSelfChallenge
          ? "border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:border-indigo-500/50"
          : isLeader
            ? "border-correct/30 shadow-[0_0_15px_rgba(46,204,113,0.1)] hover:border-correct/50"
            : mode === "LIVE"
              ? "border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:border-red-500/35"
              : "border-blue-500/20 hover:border-blue-500/35"
        } p-2 sm:p-4 rounded-3xl hover:bg-white/10 transition-all duration-300 group relative overflow-hidden flex flex-col gap-4`}
    >
      {/* Ambient Background Glows */}
      {!isExpired && isSelfChallenge && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl -mr-16 -mt-16 pointer-events-none" />
      )}
      {!isExpired && !isSelfChallenge && isLeader && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-correct/5 blur-2xl -mr-16 -mt-16 pointer-events-none" />
      )}
      {!isExpired && !isSelfChallenge && !isLeader && mode === "LIVE" && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/3 blur-2xl -mr-16 -mt-16 pointer-events-none" />
      )}
      {!isExpired && !isSelfChallenge && !isLeader && mode !== "LIVE" && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/3 blur-2xl -mr-16 -mt-16 pointer-events-none" />
      )}

      {/* HEADER ROW */}
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-wrap items-center gap-2">
          {/* Index Number Badge */}
          <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded-lg font-mono">
            #{index + 1}
          </span>
          {/* Mode Pill */}
          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${mode === "LIVE"
              ? "bg-linear-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/30"
              : "bg-linear-to-r from-blue-500/20 to-cyan-500/20 text-cyan-400 border border-blue-500/30"
              }`}
          >
            {mode === "LIVE" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block mr-0.5" />
                <Zap size={10} className="fill-current text-red-400" />
                LIVE RACE
              </>
            ) : (
              <>
                <Clock size={10} />
                ASYNC PLAY
              </>
            )}
          </span>

          {/* Word Size / Mode Pill */}
          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${isMarathon
              ? "bg-linear-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30"
              : "bg-linear-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-indigo-500/30"
              }`}
          >
            {isMarathon ? (
              <>
                <Trophy size={10} />
                MARATHON
              </>
            ) : (
              <>
                <Sparkles size={10} />
                {word_length} LETTERS
              </>
            )}
          </span>
        </div>

        {/* Expiry Timer */}
        <div className="flex items-center gap-1.5">
          {!isExpired && !isFinished ? (
            <ExpirationTimer expiresAt={expires_at} createdAt={created_at} />
          ) : isExpired ? (
            <span className="text-red-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <AlertCircle size={10} />
              Expired
            </span>
          ) : (
            <span className="text-correct text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={10} />
              Done
            </span>
          )}
        </div>
      </div>

      {/* CONFIGURATION OPTIONS SUB-LINE */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.625rem] font-bold text-white border-t border-b border-white/5 py-2 w-full">
        {/* Privacy Badge */}
        <span className="flex items-center gap-1 text-white">
          {challenge.is_public ? (
            <Globe size={9} className="text-emerald-400" />
          ) : (
            <Lock size={9} className="text-amber-400" />
          )}
          {challenge.is_public ? "Public" : "Private"}
        </span>

        {/* Custom Word Badge */}
        {challenge.is_custom_word && (
          <span className="flex items-center gap-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded">
            <Sparkles size={9} />
            Custom Word
          </span>
        )}

        {/* Handicap Badge */}
        {(challenge.handicap_starter || challenge.handicap_starters) && (
          <span className="flex items-center gap-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded">
            <Shield size={9} />
            Handicap
          </span>
        )}

        {/* Host Creator Profile */}
        <span className="flex items-center gap-1 ml-auto text-white text-[0.625rem]">
          <User size={11} />
          by @{challenge.is_bot_marathon
            ? "Variant Bot"
            : challenge.creator?.username || "Host"}
        </span>
      </div>

      {/* PROGRESS SPLIT GRID */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {/* My Stats Box */}
        <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-2xl flex flex-col gap-1.5 justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem] font-black uppercase text-indigo-300 tracking-wider font-mono">
              My Status
            </span>
            {isLeader && !isExpired && (
              <span className="text-[0.625rem] font-black text-correct bg-correct/10 border border-correct/20 px-1.5 py-0.2 rounded-full uppercase tracking-tighter">
                Leader
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <span
              className={`text-[9px] sm:text-[12px] font-black uppercase font-mono ${status === "completed" || status === "host"
                ? "text-correct"
                : status === "playing"
                  ? "text-yellow-500"
                  : "text-white/80"
                }`}
            >
              {status === "host" ? "Host (Spectating)" : status}
            </span>
            {status !== "host" && hasStarted && (
              <span className="text-[9px] sm:text-lg font-black text-white font-mono">
                {myScore}{" "}
                <span className="text-[9px] font-medium text-white/80 font-sans">
                  pts
                </span>
              </span>
            )}
          </div>

          {status !== "host" && hasStarted && (
            <div className="flex items-center justify-between text-[8px] font-bold text-white mt-1 pt-1 border-t border-white/5">
              <span>
                {item.attempts || item.guesses?.length || 0}{" "}
                {(item.attempts || item.guesses?.length || 0) === 1
                  ? "Guess"
                  : "Guesses"}
              </span>
              {mode === "LIVE" && time_taken && (
                <span className="flex items-center gap-0.5 text-white">
                  <Clock size={8} />
                  {formatTime(time_taken)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Opponents Stats Box */}
        <div className="bg-black/15 border border-white/5 p-3 rounded-2xl flex flex-col gap-1.5 justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem] font-black uppercase text-white tracking-wider">
              Opponents ({opponents.length})
            </span>
            <span className="flex items-center gap-0.5 text-[0.625rem] font-bold text-white">
              <Users size={12} />
              {participants.length} total
            </span>
          </div>

          {opponents.length > 0 ? (
            <div className="flex flex-col gap-1">
              {/* Avatar facepile */}
              <div className="flex items-center gap-1 mb-1">
                <div className="flex -space-x-2 overflow-hidden">
                  {opponents.slice(0, 3).map((p: any) => (
                    <div
                      key={p.id}
                      className="inline-block h-5 w-5 rounded-full ring-2 ring-black bg-white/5 overflow-hidden"
                    >
                      {p.profiles?.avatar_url ? (
                        <img
                          src={p.profiles.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[7px] font-black uppercase text-white bg-white/10 ring-1 ring-white/20">
                          {p.profiles?.username
                            ?.substring(0, 2)
                            .toUpperCase() || "??"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {opponents.length > 3 && (
                  <span className="text-[8px] font-bold text-white/80 ml-1">
                    +{opponents.length - 3} more
                  </span>
                )}
              </div>

              {/* Top Opponent Text summary */}
              {leaderParticipant ? (
                <p className="text-[0.625rem] font-bold text-white truncate">
                  Leader:{" "}
                  <span className="text-white">
                    @{leaderParticipant.profiles?.username || "Player"}
                  </span>{" "}
                  ({leaderParticipant.score} pts)
                </p>
              ) : (
                <p className="text-[9px] font-bold text-white/80 italic">
                  No submissions yet
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-1">
              <p className="text-[8px] font-bold text-white/80 uppercase tracking-widest italic animate-pulse">
                Waiting for others
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Row */}
      <div className="flex items-center justify-between w-full border-t border-white/5 pt-2 mt-1">
        <span className="text-[9px] sm:text-[12px] font-bold text-white uppercase">
          Created {formattedDate}
        </span>
        <span className="text-[9px] sm:text-[12px] font-black uppercase tracking-wider text-correct group-hover:translate-x-1 transition-transform flex items-center gap-1">
          Enter Lobby &rarr;
        </span>
      </div>
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
      {logs.slice(-5).map((log, index) => (
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
