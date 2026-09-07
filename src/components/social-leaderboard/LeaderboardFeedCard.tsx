/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from "react";
import { MessageCircle, Eye, User, X } from "lucide-react";
import { ProtectedAvatar } from "../chat/ProtectedAvatar";
import { ReigningBadge } from "../common/ReigningBadge";
import formatUsername from "../../utils/formatUsername";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import type { LeaderboardEntry } from "../../types/game";
import { FeedCommentDrawer } from "./FeedCommentDrawer";

interface LeaderboardFeedCardProps {
  entry: LeaderboardEntry;
  rank: number;
  gameDate: string;
  isCurrentUser: boolean;
  canViewGuesses: boolean;
  hideGridWords?: boolean;
  onOpenPreview: (entry: LeaderboardEntry, openAnalysis?: boolean) => void;
}

const FEED_EMOJIS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Funny" },
  { emoji: "💀", label: "Dead" },
  { emoji: "👀", label: "Watching" },
];

export const LeaderboardFeedCard: React.FC<LeaderboardFeedCardProps> = ({
  entry,
  rank,
  gameDate,
  isCurrentUser,
  canViewGuesses,
  hideGridWords = false,
  onOpenPreview,
}) => {
  const { user: currentUser } = useAuth();
  const [reactions, setReactions] = useState<{ reaction: string; user_id: string }[]>([]);
  const [reactionUsernames, setReactionUsernames] = useState<{ reaction: string; username: string }[]>([]);
  const [showReactionsViewer, setShowReactionsViewer] = useState(false);
  const [topComment, setTopComment] = useState<{ content: string; author_username?: string } | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [playerGuesses, setPlayerGuesses] = useState<any[]>((entry as any).guesses || []);

  const targetUserId = entry.user_id;
  const attempts = entry.status === "lost" ? "X" : entry.attempts;
  const isFirst = rank === 1;

  // Load reactions & top comment
  const loadSocialData = async () => {
    if (!targetUserId || !gameDate) return;

    try {
      const [rxRes, cmRes] = await Promise.all([
        supabase
          .from("guess_reactions")
          .select("reaction, user_id")
          .eq("target_user_id", targetUserId)
          .eq("game_date", gameDate),
        supabase
          .from("guess_comments")
          .select("id, content, created_at, author_id")
          .eq("target_user_id", targetUserId)
          .eq("game_date", gameDate)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (rxRes.data) {
        setReactions(rxRes.data);
        const uIds = Array.from(new Set(rxRes.data.map((r) => r.user_id)));
        if (uIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", uIds);
          const pMap = new Map(profiles?.map((p) => [p.id, p.username]));
          setReactionUsernames(
            rxRes.data.map((r) => ({
              reaction: r.reaction,
              username: pMap.get(r.user_id) || "Someone",
            }))
          );
        } else {
          setReactionUsernames([]);
        }
      } else {
        setReactionUsernames([]);
      }

      if (cmRes.data && cmRes.data.length > 0) {
        const first = cmRes.data[0];
        // Fetch author profile
        const { data: p } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", first.author_id)
          .single();
        setTopComment({
          content: first.content,
          author_username: p?.username || "Someone",
        });
      } else {
        setTopComment(null);
      }

      // Fetch count
      const { count } = await supabase
        .from("guess_comments")
        .select("id", { count: "exact", head: true })
        .eq("target_user_id", targetUserId)
        .eq("game_date", gameDate);

      if (count !== null) setCommentsCount(count);

      // Fetch actual guesses if allowed and not already populated
      if (canViewGuesses && (!playerGuesses || playerGuesses.length === 0)) {
        const { data: scoreData } = await supabase
          .from("scores")
          .select("guesses")
          .eq("user_id", targetUserId)
          .eq("game_date", gameDate)
          .maybeSingle();

        if (scoreData?.guesses && Array.isArray(scoreData.guesses) && scoreData.guesses.length > 0) {
          setPlayerGuesses(scoreData.guesses);
        }
      }
    } catch (err) {
      console.error("Error loading feed card social data:", err);
    }
  };

  useEffect(() => {
    loadSocialData();

    if (!targetUserId || !gameDate) return;

    const channel = supabase
      .channel(`feed_card_${targetUserId}_${gameDate}_${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guess_reactions", filter: `target_user_id=eq.${targetUserId}` },
        () => loadSocialData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guess_comments", filter: `target_user_id=eq.${targetUserId}` },
        () => loadSocialData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, gameDate]);

  // Handle 1-tap reaction
  const handleToggleReaction = async (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !targetUserId || !gameDate) return;

    const existingIndex = reactions.findIndex(
      (r) => r.user_id === currentUser.id && r.reaction === emoji
    );

    if (existingIndex >= 0) {
      // Optimistic remove
      setReactions((prev) => prev.filter((_, idx) => idx !== existingIndex));
      await supabase
        .from("guess_reactions")
        .delete()
        .eq("target_user_id", targetUserId)
        .eq("user_id", currentUser.id)
        .eq("game_date", gameDate)
        .eq("reaction", emoji);
    } else {
      // Optimistic add
      setReactions((prev) => [...prev, { reaction: emoji, user_id: currentUser.id }]);
      await supabase.from("guess_reactions").insert({
        target_user_id: targetUserId,
        user_id: currentUser.id,
        game_date: gameDate,
        reaction: emoji,
        guess_index: 0,
      });
    }
  };

  // Build mini grid visualization
  const miniGrid = useMemo(() => {
    const rawGuesses = playerGuesses.length > 0 ? playerGuesses : ((entry as any).guesses || []);
    const wordLen = entry.word_length || 5;
    const guessCount = typeof entry.attempts === "number" ? entry.attempts : (rawGuesses.length || 4);

    if (!canViewGuesses) {
      // Masked spoiler preview (squares with blurred mystery colors)
      return Array.from({ length: Math.min(guessCount, 6) }).map((_, rIdx) => (
        <div key={rIdx} className="flex gap-1 justify-center">
          {Array.from({ length: wordLen }).map((_, cIdx) => (
            <span
              key={cIdx}
              className="w-4 h-4 sm:w-5 sm:h-5 rounded-xs bg-white/10 border border-white/5 opacity-50"
            />
          ))}
        </div>
      ));
    }

    if (Array.isArray(rawGuesses) && rawGuesses.length > 0) {
      return rawGuesses.map((row: any[], rIdx: number) => (
        <div key={rIdx} className="flex gap-1 justify-center">
          {row.map((cell: any, cIdx: number) => {
            const status = cell.status;
            const bgClass =
              status === "correct"
                ? "bg-emerald-500 text-white"
                : status === "present"
                  ? "bg-amber-400 text-black"
                  : "bg-gray-700 text-white";
            return (
              <span
                key={cIdx}
                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-xs shadow-xs ${bgClass} flex items-center justify-center font-black uppercase text-[9px] sm:text-[10px] select-none transition-all ${hideGridWords ? "blur-[2px] opacity-40 select-none text-transparent" : ""
                  }`}
              >
                {!hideGridWords ? cell.letter || "" : ""}
              </span>
            );
          })}
        </div>
      ));
    }

    // Default stylized placeholders based on score if guesses array wasn't pre-populated
    return Array.from({ length: Math.min(guessCount, 6) }).map((_, rIdx) => {
      const isWinningRow = rIdx === guessCount - 1 && entry.status === "won";
      return (
        <div key={rIdx} className="flex gap-1 justify-center">
          {Array.from({ length: wordLen }).map((_, cIdx) => (
            <span
              key={cIdx}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-xs ${isWinningRow
                ? "bg-emerald-500"
                : (rIdx + cIdx) % 3 === 0
                  ? "bg-amber-400"
                  : "bg-gray-700"
                }`}
            />
          ))}
        </div>
      );
    });
  }, [entry, canViewGuesses, playerGuesses, hideGridWords]);

  return (
    <>
      <div
        onClick={() => onOpenPreview(entry, false)}
        className={`bg-gray-900/90 border rounded-2xl p-4 transition-all duration-300 relative shadow-xl hover:border-gray-600 cursor-pointer ${isFirst
          ? "border-yellow-500/50 bg-linear-to-b from-yellow-500/10 via-gray-900 to-gray-900 shadow-[0_0_20px_rgba(234,179,8,0.12)]"
          : isCurrentUser
            ? "border-emerald-500/40 bg-emerald-950/10"
            : "border-gray-800"
          }`}
      >
        {/* Top Player Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            {/* Rank badge */}
            <div className="relative flex items-center justify-center">
              <span
                className={`text-sm font-black font-mono w-6 text-center ${isFirst
                  ? "text-yellow-400 text-base"
                  : rank <= 3
                    ? "text-amber-300"
                    : "text-gray-500"
                  }`}
              >
                #{rank}
              </span>
              {isFirst && (
                <span
                  className="absolute -top-1.5 left-1 text-base select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter brightness-110 font-bold"
                  role="img"
                  aria-label="crown"
                >
                  👑
                </span>
              )}
            </div>

            <ProtectedAvatar
              userId={entry.user_id}
              src={entry.avatar_url}
              username={entry.username}
              className={`w-9 h-9 rounded-full border ${isFirst ? "border-yellow-400 ring-2 ring-yellow-400/20" : "border-gray-700"
                }`}
            />

            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs sm:text-sm font-black tracking-tight truncate max-w-[130px] sm:max-w-[180px] ${isFirst ? "text-yellow-200" : "text-white"
                    }`}
                >
                  {formatUsername(entry.username)}
                </span>
                {entry.user_id && <ReigningBadge userId={entry.user_id} type="weekly" />}
                {entry.user_id && <ReigningBadge userId={entry.user_id} type="bot_marathon" />}
              </div>
              <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                {attempts && `${attempts}/6`} •{" "}
                <span className="text-amber-400 font-black">{entry.total_score} pts</span>
                {entry.status === "playing" && (
                  <span className="ml-1.5 text-amber-400 animate-pulse font-mono font-bold">
                    • In Progress
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {entry.user_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("open-user-profile", { detail: { userId: entry.user_id } })
                  );
                }}
                className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                title="View Profile"
              >
                <User size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Card Body: Mini Grid + Highlight Pill */}
        <div className="py-3 flex flex-col items-center justify-center gap-2.5">
          <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl flex flex-col gap-1 shadow-inner">
            {miniGrid}
          </div>

          {!canViewGuesses && (
            <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider flex items-center gap-1">
              <span>🔒</span> Solve today's puzzle to unmask moves
            </p>
          )}


        </div>

        {/* 1-Tap Reaction Bar & Counts */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1 select-none">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {FEED_EMOJIS.map(({ emoji, label }) => {
              const count = reactions.filter((r) => r.reaction === emoji).length;
              const userHasReacted =
                currentUser &&
                reactions.some(
                  (r) => r.user_id === currentUser.id && r.reaction === emoji
                );

              return (
                <button
                  key={emoji}
                  onClick={(e) => handleToggleReaction(emoji, e)}
                  title={label}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all cursor-pointer ${userHasReacted
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black scale-105"
                    : "bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white"
                    }`}
                >
                  <span className="text-sm">{emoji}</span>
                  {count > 0 && <span className="text-[10px] font-bold font-mono">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Reactions Viewer Trigger */}
            {reactions.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionsViewer(true);
                }}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-all text-xs cursor-pointer"
                title="View who reacted"
              >
                <div className="flex -space-x-1">
                  {Array.from(new Set(reactions.map((r) => r.reaction)))
                    .slice(0, 3)
                    .map((emoji, idx) => (
                      <span key={idx} className="scale-90">
                        {emoji}
                      </span>
                    ))}
                </div>
                <span className="text-[10px] font-bold font-mono ml-1">{reactions.length}</span>
              </button>
            )}

            {/* Comment Drawer Trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCommentDrawerOpen(true);
              }}
              className="flex items-center gap-1 text-gray-400 hover:text-amber-300 text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              title={canViewGuesses ? "Comments & Banter" : "Play game to unlock comments"}
            >
              <MessageCircle size={14} />
              <span className="text-[10px] font-bold font-mono">{commentsCount}</span>
            </button>
          </div>
        </div>

        {/* Top Comment Preview Bubble - only visible if user has completed today's game */}
        {canViewGuesses && topComment && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsCommentDrawerOpen(true);
            }}
            className="mt-2.5 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-gray-300 hover:border-amber-400/30 transition-all cursor-pointer"
          >
            <MessageCircle size={12} className="text-amber-400 shrink-0" />
            <p className="text-[11px] truncate flex-1">
              <span className="font-bold text-white mr-1.5">
                @{formatUsername(topComment.author_username || "Player")}:
              </span>
              <span className="italic opacity-90">"{topComment.content}"</span>
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview(entry, false);
            }}
            className="flex items-center justify-center gap-1.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <Eye size={12} />
            <span>View Game</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview(entry, true);
            }}
            className="flex items-center justify-center gap-1.5 py-2 bg-linear-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <span>♟️</span>
            <span>Analyze Game</span>
          </button>
        </div>
      </div>

      {/* Slide-up Comments Drawer */}
      <FeedCommentDrawer
        isOpen={isCommentDrawerOpen}
        onClose={() => setIsCommentDrawerOpen(false)}
        targetUserId={targetUserId || ""}
        targetUsername={entry.username || "Player"}
        gameDate={gameDate}
        canViewGuesses={canViewGuesses}
        hideGridWords={hideGridWords}
        rawGuesses={playerGuesses.length > 0 ? playerGuesses : (entry as any).guesses}
        status={entry.status}
        attempts={entry.attempts}
        wordLength={entry.word_length || 5}
        onCommentAdded={loadSocialData}
      />

      {/* Modal to see who and who reacted and their reactions */}
      {showReactionsViewer && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowReactionsViewer(false);
          }}
          className="fixed inset-0 bg-black/80 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-default"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-4 w-full max-w-xs shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">❤️</span>
                <span className="text-[11px] uppercase font-black tracking-wider text-white">
                  Reactions ({reactionUsernames.length})
                </span>
              </div>
              <button
                onClick={() => setShowReactionsViewer(false)}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin py-1">
              {reactionUsernames.length === 0 ? (
                <p className="text-[10px] text-gray-500 uppercase text-center py-6 font-bold">
                  No reactions yet
                </p>
              ) : (
                reactionUsernames.map((ru, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-xs bg-white/5 py-2 px-3 rounded-xl border border-white/5"
                  >
                    <span className="font-bold text-gray-200">@{formatUsername(ru.username)}</span>
                    <span className="text-base">{ru.reaction}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
