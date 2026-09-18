/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Send, MessageCircle, Loader2, Trash2, Edit2, Check, CornerDownRight, Tag, Smile } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import formatUsername from "../../utils/formatUsername";
import UserSuggestions from "../chat/UserSuggestions";

interface FeedCommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUsername: string;
  gameDate: string;
  canViewGuesses?: boolean;
  hideGridWords?: boolean;
  rawGuesses?: any[];
  status?: "won" | "lost" | "playing";
  attempts?: number | "X";
  wordLength?: number;
  onCommentAdded?: () => void;
}

interface CommentItem {
  id: string;
  content: string;
  author_id: string;
  author_username?: string;
  created_at: string;
  guess_index?: number | null;
  parent_id?: string | null;
  is_edited?: boolean;
  is_deleted?: boolean;
}

interface CommentReaction {
  comment_id: string;
  reaction: string;
  user_id: string;
}

interface SuggestionUser {
  username: string;
  avatar_url: string;
}

const EMOJIS = ["🔥", "😂", "👏", "💀", "🎯", "❤️", "👀"];

export const FeedCommentDrawer: React.FC<FeedCommentDrawerProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  gameDate,
  canViewGuesses = true,
  hideGridWords = false,
  rawGuesses = [],
  status = "won",
  attempts = 6,
  wordLength = 5,
  onCommentAdded,
}) => {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentReactions, setCommentReactions] = useState<CommentReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [taggedRow, setTaggedRow] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [fetchedGuesses, setFetchedGuesses] = useState<any[]>(rawGuesses);
  
  // Hold-to-react & Reaction Picker state
  const [activeReactionPickerCommentId, setActiveReactionPickerCommentId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  // Swipe-to-reply state (tracking touch/drag per comment)
  const [swipingCommentId, setSwipingCommentId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  // User @ mention state
  const [allUsers, setAllUsers] = useState<SuggestionUser[]>([]);
  const [mentionState, setMentionState] = useState<{ isVisible: boolean; filter: string; cursorPosition: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rawGuesses && rawGuesses.length > 0) {
      setFetchedGuesses(rawGuesses);
    }
  }, [rawGuesses]);

  // Compute grid rows for rendering
  const gridRows = useMemo(() => {
    const wordLen = wordLength || 5;
    const guessCount = typeof attempts === "number" ? attempts : 6;
    const effectiveGuesses = fetchedGuesses.length > 0 ? fetchedGuesses : rawGuesses;

    if (Array.isArray(effectiveGuesses) && effectiveGuesses.length > 0) {
      return effectiveGuesses.map((row: any[]) =>
        row.map((cell: any) => ({
          letter: cell.letter,
          status: cell.status,
        }))
      );
    }

    // Stylized fallback rows
    return Array.from({ length: Math.min(guessCount, 6) }).map((_, rIdx) => {
      const isWinningRow = rIdx === guessCount - 1 && status === "won";
      return Array.from({ length: wordLen }).map((_, cIdx) => ({
        letter: "",
        status: isWinningRow
          ? "correct"
          : (rIdx + cIdx) % 3 === 0
            ? "present"
            : "absent",
      }));
    });
  }, [fetchedGuesses, rawGuesses, attempts, status, wordLength]);

  const fetchComments = async (silent = false) => {
    if (!targetUserId || !gameDate) return;
    if (!silent) setLoading(true);
    try {
      // Fetch comments, scores, and users for @ tagging
      const promises: PromiseLike<any>[] = [
        supabase
          .from("guess_comments")
          .select("id, content, created_at, author_id, guess_index, parent_id, is_edited, is_deleted")
          .eq("target_user_id", targetUserId)
          .eq("game_date", gameDate)
          .order("created_at", { ascending: true })
      ];

      if (canViewGuesses && (!fetchedGuesses || fetchedGuesses.length === 0)) {
        promises.push(
          supabase
            .from("scores")
            .select("guesses")
            .eq("user_id", targetUserId)
            .eq("game_date", gameDate)
            .maybeSingle()
        );
      }

      const [commentsRes, scoreRes] = await Promise.all(promises);

      if (scoreRes?.data?.guesses && Array.isArray(scoreRes.data.guesses)) {
        setFetchedGuesses(scoreRes.data.guesses);
      }

      const data = commentsRes.data;
      if (commentsRes.error) throw commentsRes.error;

      if (data && data.length > 0) {
        const commentIds = data.map((c: any) => c.id);
        const authorIds = Array.from(new Set(data.map((c: any) => c.author_id)));
        
        // Fetch profiles & reactions in parallel
        const [{ data: profiles }, { data: reactions }] = await Promise.all([
          supabase.from("profiles").select("id, username, avatar_url").in("id", authorIds),
          supabase.from("comment_reactions").select("comment_id, reaction, user_id").in("comment_id", commentIds)
        ]);

        const map = new Map(profiles?.map((p) => [p.id, p.username]));
        setComments(
          data.map((c: any) => ({
            ...c,
            author_username: map.get(c.author_id) || "Someone",
          }))
        );

        if (reactions) {
          setCommentReactions(reactions);
        }
      } else {
        setComments([]);
        setCommentReactions([]);
      }
    } catch (err) {
      console.error("Error fetching feed comments:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch list of profiles for @ mention suggestions
  useEffect(() => {
    if (!isOpen) return;
    const fetchUsers = async () => {
      try {
        const { data: usersData } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .not("username", "is", null)
          .limit(50);

        if (usersData) {
          setAllUsers(usersData as SuggestionUser[]);
        }
      } catch (e) {
        console.error("Error loading mention profiles:", e);
      }
    };
    fetchUsers();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      setTaggedRow(null);
      setReplyTo(null);
      setActiveReactionPickerCommentId(null);
      setMentionState(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setComments([]);
      setCommentReactions([]);
      setNewComment("");
      setTaggedRow(null);
      setReplyTo(null);
      setActiveReactionPickerCommentId(null);
      setMentionState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetUserId, gameDate]);

  // Realtime subscription for comments and reactions (silent background updates)
  useEffect(() => {
    if (!isOpen || !targetUserId) return;

    const channel = supabase
      .channel(`feed_drawer_${targetUserId}_${gameDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guess_comments",
          filter: `target_user_id=eq.${targetUserId}`,
        },
        () => {
          fetchComments(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comment_reactions",
        },
        () => {
          fetchComments(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetUserId, gameDate]);

  // Threading computation
  const rootComments = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map: Record<string, CommentItem[]> = {};
    comments.forEach((c) => {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    });
    return map;
  }, [comments]);

  // Handle @ mention typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewComment(val);

    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
      if (!/\s/.test(textAfterAt)) {
        setMentionState({
          isVisible: true,
          filter: textAfterAt,
          cursorPosition: cursorPos,
        });
        return;
      }
    }
    setMentionState(null);
  };

  const handleSelectMention = (username: string) => {
    if (!mentionState || !inputRef.current) return;
    const textBeforeAt = newComment.slice(0, newComment.lastIndexOf("@", mentionState.cursorPosition - 1));
    const textAfterCursor = newComment.slice(mentionState.cursorPosition);
    const updated = `${textBeforeAt}@${username} ${textAfterCursor}`;
    setNewComment(updated);
    setMentionState(null);
    inputRef.current.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || !currentUser || submitting) return;

    setSubmitting(true);
    try {
      const parentId = replyTo ? (replyTo.parent_id || replyTo.id) : null;
      const guessIndexToSave = taggedRow !== null ? taggedRow : 0;

      const { data, error } = await supabase
        .from("guess_comments")
        .insert({
          target_user_id: targetUserId,
          author_id: currentUser.id,
          game_date: gameDate,
          content: trimmed,
          guess_index: guessIndexToSave,
          parent_id: parentId,
        })
        .select("id, content, created_at, author_id, guess_index, parent_id")
        .single();

      if (error) throw error;

      if (data) {
        setComments((prev) => [
          ...prev,
          {
            ...data,
            author_username:
              currentUser.user_metadata?.username ||
              formatUsername(currentUser.user_metadata?.full_name) ||
              "You",
          },
        ]);
        setNewComment("");
        setReplyTo(null);
        setMentionState(null);
        if (onCommentAdded) onCommentAdded();
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (comment: CommentItem) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editCommentText.trim();
    if (!trimmed || !currentUser) return;

    try {
      const { error } = await supabase
        .from("guess_comments")
        .update({
          content: trimmed,
          is_edited: true,
        })
        .eq("id", commentId)
        .eq("author_id", currentUser.id);

      if (!error) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, content: trimmed, is_edited: true } : c
          )
        );
        setEditingCommentId(null);
        if (onCommentAdded) onCommentAdded();
      }
    } catch (err) {
      console.error("Failed to update comment:", err);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from("guess_comments")
        .update({
          content: "[This comment has been deleted]",
          is_deleted: true,
        })
        .eq("id", commentId)
        .eq("author_id", currentUser.id);

      if (!error) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, content: "[This comment has been deleted]", is_deleted: true }
              : c
          )
        );
        if (onCommentAdded) onCommentAdded();
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const handleStartReply = (comment: CommentItem) => {
    setReplyTo(comment);
    if (comment.guess_index && comment.guess_index > 0 && taggedRow === null) {
      setTaggedRow(comment.guess_index);
    }
    inputRef.current?.focus();
  };

  // Optimistic UI reaction update
  const handleCommentReact = async (commentId: string, emoji: string) => {
    if (!currentUser) return;
    setActiveReactionPickerCommentId(null);

    const previousReactions = [...commentReactions];
    const existing = commentReactions.find(
      (r) => r.comment_id === commentId && r.user_id === currentUser.id
    );

    // 1. Immediately apply optimistic UI change
    if (existing && existing.reaction === emoji) {
      // Toggle off / remove reaction
      setCommentReactions((prev) =>
        prev.filter((r) => !(r.comment_id === commentId && r.user_id === currentUser.id))
      );

      // 2. Perform DB update in background without full refresh
      supabase
        .from("comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUser.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to remove reaction, rolling back:", error);
            setCommentReactions(previousReactions);
          }
        });
    } else {
      // Upsert reaction optimistically
      setCommentReactions((prev) => [
        ...prev.filter((r) => !(r.comment_id === commentId && r.user_id === currentUser.id)),
        { comment_id: commentId, user_id: currentUser.id, reaction: emoji },
      ]);

      // 2. Perform DB update in background without full refresh
      supabase
        .from("comment_reactions")
        .upsert({
          comment_id: commentId,
          user_id: currentUser.id,
          reaction: emoji,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Failed to add reaction, rolling back:", error);
            setCommentReactions(previousReactions);
          }
        });
    }
  };

  // Hold-to-react & touch handlers
  const handleTouchStart = (commentId: string, e: React.TouchEvent | React.MouseEvent) => {
    if (!currentUser) return;
    isLongPressTriggeredRef.current = false;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartPosRef.current = { x: clientX, y: clientY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setActiveReactionPickerCommentId(commentId);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) {
          // Ignore vibration failures
        }
      }
    }, 450); // 450ms hold
  };

  const handleTouchMove = (comment: CommentItem, e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartPosRef.current.x;
    const diffY = currentY - touchStartPosRef.current.y;

    // If user moves vertically or scrolls, cancel long press
    if (Math.abs(diffY) > 10 || Math.abs(diffX) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Swipe right to reply gesture (only allow horizontal drag to the right)
    if (diffX > 10 && Math.abs(diffY) < 30 && !comment.is_deleted) {
      setSwipingCommentId(comment.id);
      setSwipeOffset(Math.min(diffX * 0.45, 60)); // Max drag offset
    }
  };

  const handleTouchEnd = (comment: CommentItem) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // If swipe passed threshold (35px), trigger reply
    if (swipingCommentId === comment.id) {
      if (swipeOffset >= 35) {
        handleStartReply(comment);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(25);
          } catch (_) {
            // Ignore vibration error
          }
        }
      }
      setSwipingCommentId(null);
      setSwipeOffset(0);
    }

    touchStartPosRef.current = null;
  };

  // Format text to highlight @mentions
  const renderFormattedContent = (content: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_.-]+)/g;
    const parts = content.split(mentionRegex);

    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={i}
            className="text-amber-400 font-bold bg-amber-400/10 px-1 py-0.5 rounded-sm hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              const username = part.slice(1);
              setNewComment((prev) => `${prev} @${username} `);
              inputRef.current?.focus();
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  const renderCommentCard = (c: CommentItem, isReply = false) => {
    const isMine = currentUser?.id === c.author_id;
    const isEditing = editingCommentId === c.id;
    const hasTaggedRow = typeof c.guess_index === "number" && c.guess_index > 0;
    const isSwipingThis = swipingCommentId === c.id;
    const isPickerActive = activeReactionPickerCommentId === c.id;

    // Reactions calculations
    const cReactions = commentReactions.filter((r) => r.comment_id === c.id);
    const reactionCounts = EMOJIS.map((emoji) => ({
      emoji,
      count: cReactions.filter((r) => r.reaction === emoji).length,
      hasReacted: cReactions.some((r) => r.user_id === currentUser?.id && r.reaction === emoji),
    })).filter((r) => r.count > 0);

    return (
      <div key={c.id} className="relative group">
        {/* Swipe-to-reply background icon indicator */}
        {isSwipingThis && swipeOffset > 10 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-400 flex items-center gap-1 text-[11px] font-bold animate-in fade-in">
            <CornerDownRight size={14} />
            <span>Reply</span>
          </div>
        )}

        {/* Reaction Picker Popover (via Long Press or Smile Button) */}
        {isPickerActive && (
          <div
            className="absolute right-2 -top-9 bg-gray-950/95 border border-amber-400/40 rounded-full px-2.5 py-1 flex items-center gap-1.5 z-50 shadow-[0_10px_25px_rgba(0,0,0,0.8)] backdrop-blur-md animate-in zoom-in-90 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleCommentReact(c.id, emoji)}
                className="text-base p-1 hover:scale-130 active:scale-95 transition-transform cursor-pointer"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveReactionPickerCommentId(null)}
              className="text-gray-400 hover:text-white p-0.5 ml-0.5 cursor-pointer"
              title="Close reaction picker"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div
          style={{
            transform: isSwipingThis ? `translateX(${swipeOffset}px)` : undefined,
            transition: isSwipingThis ? "none" : "transform 0.2s ease-out",
          }}
          onTouchStart={(e) => handleTouchStart(c.id, e)}
          onTouchMove={(e) => handleTouchMove(c, e)}
          onTouchEnd={() => handleTouchEnd(c)}
          onMouseDown={(e) => handleTouchStart(c.id, e)}
          onMouseUp={() => handleTouchEnd(c)}
          onMouseLeave={() => handleTouchEnd(c)}
          className={`rounded-2xl p-3 flex flex-col gap-1 text-xs transition-all relative select-none ${
            isReply
              ? "bg-[#161c28] border border-cyan-500/20 shadow-[0_2px_8px_rgba(6,182,212,0.04)]"
              : "bg-[#1c1829] border border-purple-500/25 shadow-[0_3px_12px_rgba(168,85,247,0.06)]"
          } ${isPickerActive ? "ring-2 ring-amber-400/60" : ""}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-black text-[11px] ${
                  isReply ? "text-cyan-300" : "text-purple-200"
                }`}
              >
                @{formatUsername(c.author_username || "Player")}
              </span>
              {isReply && (
                <span className="text-[8px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  Reply
                </span>
              )}
              {isMine && (
                <span className="text-[9px] text-amber-400 uppercase font-mono font-bold">
                  (You)
                </span>
              )}
              {hasTaggedRow && (
                <span className="text-[9px] bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Tag size={9} />
                  Row {c.guess_index}
                </span>
              )}
              {c.is_edited && !c.is_deleted && (
                <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded-sm text-gray-400 uppercase font-bold">
                  Edited
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 font-mono">
                {new Date(c.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {isMine && !c.is_deleted && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(c);
                    }}
                    className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
                    title="Edit comment"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c.id);
                    }}
                    className="text-gray-400 hover:text-rose-400 p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
                    title="Delete comment"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                className="bg-black/60 border border-amber-400/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingCommentId(null)}
                  className="text-[9px] uppercase font-bold text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEdit(c.id)}
                  className="text-[9px] uppercase font-bold text-black px-2.5 py-1 bg-amber-400 hover:bg-amber-300 rounded-md cursor-pointer flex items-center gap-1"
                >
                  <Check size={10} /> Save
                </button>
              </div>
            </div>
          ) : (
            <p
              className={`font-medium wrap-break-word leading-relaxed text-xs py-2 border-t border-white/5 text-left ${
                c.is_deleted ? "text-gray-500 italic" : "text-gray-100"
              }`}
            >
              {c.is_deleted ? c.content : renderFormattedContent(c.content)}
            </p>
          )}

          {/* Emoji Reactions List on Comment */}
          {reactionCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              {reactionCounts.map(({ emoji, count, hasReacted }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCommentReact(c.id, emoji);
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                    hasReacted
                      ? "bg-amber-400/20 border border-amber-400/50 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
                      : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action footer: reply & quick reaction trigger */}
          {currentUser && !c.is_deleted && (
            <div
              className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleStartReply(c)}
                className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-amber-300 transition-colors cursor-pointer"
                title="Tap or swipe right to reply"
              >
                <CornerDownRight size={11} />
                <span>Reply</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveReactionPickerCommentId(
                    activeReactionPickerCommentId === c.id ? null : c.id
                  )
                }
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-400 p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
                title="Hold or tap to react"
              >
                <Smile size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] h-[640px] relative overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-amber-400" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Banter & Comments
              </h3>
              <p className="text-[10px] text-gray-400 font-medium">
                For {formatUsername(targetUsername)}'s solve
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Guess Grid Header & Row Tagging Selector */}
        {canViewGuesses && gridRows.length > 0 && (
          <div className="py-2.5 px-3 bg-black/30 border-b border-gray-800 shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                <span>🎯 Tap a row to tag:</span>
                {taggedRow !== null && (
                  <span className="text-amber-400 font-mono">Row {taggedRow}</span>
                )}
              </span>
              {taggedRow !== null && (
                <button
                  onClick={() => setTaggedRow(null)}
                  className="text-[9px] text-gray-400 hover:text-white uppercase font-bold tracking-wider underline cursor-pointer"
                >
                  Clear Tag
                </button>
              )}
            </div>

            {/* Interactive Grid preview */}
            <div className="flex flex-col gap-1 items-center justify-center">
              {gridRows.map((row, rIdx) => {
                const rowNum = rIdx + 1;
                const isSelected = taggedRow === rowNum;

                return (
                  <button
                    key={rIdx}
                    type="button"
                    onClick={() => setTaggedRow(isSelected ? null : rowNum)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-400/20 border border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                    title={`Tag Row ${rowNum}`}
                  >
                    <span
                      className={`text-[9px] font-mono font-bold w-3 text-right ${
                        isSelected ? "text-amber-300" : "text-gray-500"
                      }`}
                    >
                      {rowNum}
                    </span>
                    <div className="flex gap-1">
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
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs shadow-xs ${bgClass} flex items-center justify-center font-black uppercase text-[9px] sm:text-[10px] select-none transition-all ${
                              hideGridWords ? "blur-[2px] opacity-40 select-none text-transparent" : ""
                            }`}
                          >
                            {!hideGridWords ? cell.letter || "" : ""}
                          </span>
                        );
                      })}
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-black text-amber-300 uppercase tracking-tight ml-1">
                        Tagged
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin">
          {!canViewGuesses ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-center px-4">
              <span className="text-2xl">🔒</span>
              <p className="text-xs font-black uppercase tracking-wider text-amber-400">
                Comments Locked
              </p>
              <p className="text-[11px] text-gray-400 font-medium max-w-xs leading-relaxed">
                Play today's game first to unlock the community banter and view what players are saying!
              </p>
            </div>
          ) : loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 className="animate-spin text-amber-400" size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Loading comments...
              </span>
            </div>
          ) : rootComments.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs font-semibold">
              No comments yet. Be the first to drop some banter! 💬
            </div>
          ) : (
            rootComments.map((c) => {
              const replies = repliesByParent[c.id] || [];

              return (
                <div key={c.id} className="space-y-2">
                  {/* Root comment */}
                  {renderCommentCard(c, false)}

                  {/* Threaded nested replies */}
                  {replies.length > 0 && (
                    <div className="pl-3.5 ml-2.5 border-l-2 border-cyan-500/30 space-y-2">
                      {replies.map((reply) => renderCommentCard(reply, true))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Form input */}
        {canViewGuesses ? (
          <div className="pt-2.5 border-t border-gray-800 shrink-0 flex flex-col gap-1.5 relative">
            {/* User mention autocompletion dropdown */}
            {mentionState?.isVisible && (
              <UserSuggestions
                users={allUsers}
                filter={mentionState.filter}
                onSelect={handleSelectMention}
                isVisible={mentionState.isVisible}
                currentInput={newComment}
              />
            )}

            {/* Banner showing active Tagged Row or Reply To */}
            {(taggedRow !== null || replyTo !== null) && (
              <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-[10px]">
                <div className="flex items-center gap-2 flex-wrap">
                  {replyTo && (
                    <span className="flex items-center gap-1 text-gray-300">
                      <CornerDownRight size={10} className="text-cyan-400" />
                      <span>
                        Replying to{" "}
                        <span className="text-cyan-300 font-bold">
                          @{formatUsername(replyTo.author_username || "")}
                        </span>
                      </span>
                    </span>
                  )}
                  {taggedRow !== null && (
                    <span className="flex items-center gap-1 text-amber-300 font-bold bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded">
                      <Tag size={9} />
                      Row {taggedRow}
                      <button
                        type="button"
                        onClick={() => setTaggedRow(null)}
                        className="ml-1 text-amber-300 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                        title="Clear tagged row"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {replyTo && (
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                      title="Cancel reply"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1 relative flex items-center">
                {taggedRow !== null && (
                  <div className="absolute left-2.5 z-10 flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded">
                    <span>R{taggedRow}</span>
                    <button
                      type="button"
                      onClick={() => setTaggedRow(null)}
                      className="hover:text-white cursor-pointer ml-0.5"
                      title="Clear tag"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={handleInputChange}
                  placeholder={
                    replyTo
                      ? `Reply to @${formatUsername(replyTo.author_username || "Player")}...`
                      : taggedRow !== null
                        ? `Comment on Row ${taggedRow}...`
                        : currentUser
                          ? "Drop a reaction or roast (type @ to tag)..."
                          : "Log in to join the banter"
                  }
                  disabled={!currentUser || submitting}
                  maxLength={280}
                  className={`w-full bg-black/50 border border-gray-700 rounded-xl py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors ${
                    taggedRow !== null ? "pl-18 pr-3" : "px-3"
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={!currentUser || !newComment.trim() || submitting}
                className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer shrink-0"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="pt-2.5 border-t border-gray-800 text-center py-1 shrink-0">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              Finish your daily game to post comments
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

