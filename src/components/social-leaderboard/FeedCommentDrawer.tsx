/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle, Loader2, Trash2, Edit2, Check } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import formatUsername from "../../utils/formatUsername";

interface FeedCommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUsername: string;
  gameDate: string;
  canViewGuesses?: boolean;
  onCommentAdded?: () => void;
}

interface CommentItem {
  id: string;
  content: string;
  author_id: string;
  author_username?: string;
  created_at: string;
  is_edited?: boolean;
  is_deleted?: boolean;
}

export const FeedCommentDrawer: React.FC<FeedCommentDrawerProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  gameDate,
  canViewGuesses = true,
  onCommentAdded,
}) => {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = async () => {
    if (!targetUserId || !gameDate) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("guess_comments")
        .select("id, content, created_at, author_id, is_edited, is_deleted")
        .eq("target_user_id", targetUserId)
        .eq("game_date", gameDate)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const authorIds = Array.from(new Set(data.map((c) => c.author_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", authorIds);
        const map = new Map(profiles?.map((p) => [p.id, p.username]));
        setComments(
          data.map((c) => ({
            ...c,
            author_username: map.get(c.author_id) || "Someone",
          }))
        );
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error("Error fetching feed comments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setComments([]);
      setNewComment("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetUserId, gameDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || !currentUser || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("guess_comments")
        .insert({
          target_user_id: targetUserId,
          author_id: currentUser.id,
          game_date: gameDate,
          content: trimmed,
          guess_index: 0,
        })
        .select("id, content, created_at, author_id")
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] h-[600px] relative overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-5"
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

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 scrollbar-thin">
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
              <span className="text-[10px] font-black uppercase tracking-widest">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs font-semibold">
              No comments yet. Be the first to drop some banter! 💬
            </div>
          ) : (
            comments.map((c) => {
              const isMine = currentUser?.id === c.author_id;
              const isEditing = editingCommentId === c.id;

              return (
                <div
                  key={c.id}
                  className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-gray-200 text-[11px]">
                        @{formatUsername(c.author_username || "Player")}
                      </span>
                      {isMine && <span className="text-[9px] text-amber-400 uppercase font-mono font-bold">(You)</span>}
                      {c.is_edited && !c.is_deleted && (
                        <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded-sm text-gray-400 uppercase font-bold">
                          Edited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-gray-500 font-mono">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isMine && !c.is_deleted && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleStartEdit(c)}
                            className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
                            title="Edit comment"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
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
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        className="bg-black/60 border border-amber-400/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => setEditingCommentId(null)}
                          className="text-[9px] uppercase font-bold text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-md cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          className="text-[9px] uppercase font-bold text-black px-2.5 py-1 bg-amber-400 hover:bg-amber-300 rounded-md cursor-pointer flex items-center gap-1"
                        >
                          <Check size={10} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`font-medium break-words leading-relaxed text-xs ${c.is_deleted ? 'text-gray-500 italic' : 'text-gray-200'}`}>
                      {c.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Form input */}
        {canViewGuesses ? (
          <form onSubmit={handleSubmit} className="pt-2.5 border-t border-gray-800 shrink-0 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={currentUser ? "Drop a reaction or roast..." : "Log in to join the banter"}
              disabled={!currentUser || submitting}
              maxLength={280}
              className="flex-1 bg-black/50 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!currentUser || !newComment.trim() || submitting}
              className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </form>
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
