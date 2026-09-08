/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle,
  HelpCircle,
  Trophy,
  XCircle,
  ChevronRight,
  Eye,
  Trash2,
  Edit2,
  Sparkles,
  MessageSquareQuote,
  Check,
  X,
} from 'lucide-react';
import { ProtectedAvatar } from '../chat/ProtectedAvatar';
import { ReigningBadge } from '../common/ReigningBadge';
import formatUsername from '../../utils/formatUsername';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import {
  type SocialActivityItem,
  updateSocialActivity,
  deleteSocialActivity,
} from '../../services/socialActivityService';
import { FeedCommentDrawer } from './FeedCommentDrawer';
import type { LeaderboardEntry } from '../../types/game';

interface SocialActivityCardProps {
  activity: SocialActivityItem;
  userRank?: number;
  canViewGuesses: boolean;
  hideGridWords?: boolean;
  onOpenPreview?: (entry: LeaderboardEntry, openAnalysis?: boolean) => void;
  onActivityDeleted?: (activityId: string) => void;
}

const FEED_EMOJIS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '😂', label: 'Funny' },
  { emoji: '💀', label: 'Dead' },
  { emoji: '👀', label: 'Watching' },
];

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export const SocialActivityCard: React.FC<SocialActivityCardProps> = ({
  activity,
  userRank,
  canViewGuesses,
  hideGridWords = false,
  onOpenPreview,
  onActivityDeleted,
}) => {
  const { user: currentUser } = useAuth();
  const [reactions, setReactions] = useState<{ reaction: string; user_id: string }[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);

  // CRUD Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(activity.payload?.content || '');
  const [isDeleting, setIsDeleting] = useState(false);

  const targetUserId = activity.payload?.target_user_id || activity.user_id;
  const gameDate = activity.game_date;
  const guessIdx = activity.guess_index ?? 0;
  const isOwner = currentUser?.id === activity.user_id;

  // Load reactions & comments count for this target user & guess index
  useEffect(() => {
    if (!targetUserId || !gameDate) return;

    let isMounted = true;

    const loadSocialData = async () => {
      try {
        const [rxRes, cmRes] = await Promise.all([
          supabase
            .from('guess_reactions')
            .select('reaction, user_id')
            .eq('target_user_id', targetUserId)
            .eq('game_date', gameDate)
            .eq('guess_index', guessIdx),
          supabase
            .from('guess_comments')
            .select('id', { count: 'exact', head: true })
            .eq('target_user_id', targetUserId)
            .eq('game_date', gameDate)
            .eq('guess_index', guessIdx),
        ]);

        if (isMounted) {
          if (rxRes.data) setReactions(rxRes.data);
          if (cmRes.count !== null) setCommentsCount(cmRes.count);
        }
      } catch (err) {
        console.error('Error loading activity card social data:', err);
      }
    };

    loadSocialData();

    const channel = supabase
      .channel(`act_card_${targetUserId}_${gameDate}_${guessIdx}_${Math.random().toString(36).slice(2, 6)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guess_reactions',
          filter: `target_user_id=eq.${targetUserId}`,
        },
        () => loadSocialData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guess_comments',
          filter: `target_user_id=eq.${targetUserId}`,
        },
        () => loadSocialData()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [targetUserId, gameDate, guessIdx]);

  const handleToggleReaction = async (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !targetUserId || !gameDate) return;

    const existingIndex = reactions.findIndex(
      (r) => r.user_id === currentUser.id && r.reaction === emoji
    );

    if (existingIndex >= 0) {
      setReactions((prev) => prev.filter((_, idx) => idx !== existingIndex));
      await supabase
        .from('guess_reactions')
        .delete()
        .eq('target_user_id', targetUserId)
        .eq('user_id', currentUser.id)
        .eq('game_date', gameDate)
        .eq('guess_index', guessIdx)
        .eq('reaction', emoji);
    } else {
      setReactions((prev) => [...prev, { reaction: emoji, user_id: currentUser.id }]);
      await supabase.from('guess_reactions').insert({
        target_user_id: targetUserId,
        user_id: currentUser.id,
        game_date: gameDate,
        guess_index: guessIdx,
        reaction: emoji,
      });
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    const updatedPayload = {
      ...activity.payload,
      content: editText.trim(),
      is_edited: true,
    };
    const success = await updateSocialActivity(activity.id, updatedPayload);
    if (success) {
      activity.payload.content = editText.trim();
      activity.payload.is_edited = true;
      setIsEditing(false);
    }
  };

  // Handle Delete Activity
  const handleDelete = async () => {
    if (!window.confirm('Delete this feed item?')) return;
    setIsDeleting(true);
    const success = await deleteSocialActivity(activity.id);
    if (success && onActivityDeleted) {
      onActivityDeleted(activity.id);
    }
    setIsDeleting(false);
  };

  const isCurrentUser = currentUser?.id === activity.user_id;
  const timeAgo = formatTimeAgo(activity.created_at);

  // Progressive guess matrix & highlighted rows
  const cumulativeGuesses = activity.payload?.all_guesses || [];
  const currentGuessResult = activity.payload?.guess_result || [];
  const highlightedRowIndex = activity.payload?.highlighted_row_index ?? null;
  const wordLen = activity.metadata?.word_length || 5;

  // Header badges & titles
  const activityHeader = useMemo(() => {
    switch (activity.activity_type) {
      case 'game_started': {
        return {
          title: "Started Today's Game",
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold',
          icon: <Sparkles size={11} className="text-amber-400" />,
        };
      }
      case 'guess_submitted': {
        const guessNum = activity.payload?.guess_number ?? (guessIdx + 1);
        return {
          title: `Made Guess #${guessNum}`,
          badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          icon: <Sparkles size={11} className="text-blue-400" />,
        };
      }
      case 'hint_used': {
        const canShowHintDetails = canViewGuesses || isCurrentUser;
        const letter = activity.payload?.letter || activity.payload?.hint_record?.letter;
        const pos =
          activity.payload?.position ||
          (activity.payload?.hint_record?.index !== undefined
            ? activity.payload.hint_record.index + 1
            : null);
        const detailStr = canShowHintDetails && letter && pos ? ` ("${letter}" @ pos ${pos})` : '';
        return {
          title: `Used a Hint${detailStr}`,
          badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold',
          icon: <HelpCircle size={11} className="text-purple-400" />,
        };
      }
      case 'guess_comment_posted': {
        const rowNum = (highlightedRowIndex ?? 0) + 1;
        return {
          title: `Commented on @${activity.payload?.target_username || 'Player'}'s Guess #${rowNum}`,
          badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-bold',
          icon: <MessageSquareQuote size={11} className="text-cyan-400" />,
        };
      }
      case 'guess_reaction_posted': {
        const rowNum = (highlightedRowIndex ?? 0) + 1;
        const rx = activity.payload?.reaction || '🔥';
        return {
          title: `Reacted ${rx} to @${activity.payload?.target_username || 'Player'}'s Guess #${rowNum}`,
          badgeBg: 'bg-pink-500/10 text-pink-400 border-pink-500/30 font-bold',
          icon: <span>{rx}</span>,
        };
      }
      case 'game_won': {
        const attempts = activity.payload?.attempts ?? (activity.payload?.all_guesses?.length || 6);
        const score = activity.payload?.total_score ?? activity.payload?.skill_score ?? 0;
        return {
          title: `Solved in ${attempts}/6 (${score} pts) 🎉`,
          badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black',
          icon: <Trophy size={11} className="text-emerald-400" />,
        };
      }
      case 'game_lost': {
        return {
          title: 'Fell in the Daily Gauntlet (X/6)',
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold',
          icon: <XCircle size={11} className="text-rose-400" />,
        };
      }
      default:
        return {
          title: 'Wordle Activity',
          badgeBg: 'bg-gray-700/50 text-gray-300 border-gray-600',
          icon: <Sparkles size={11} />,
        };
    }
  }, [activity.activity_type, activity.payload, guessIdx, highlightedRowIndex, canViewGuesses, isCurrentUser]);

  return (
    <div className="bg-gray-800/60 hover:bg-gray-800/80 transition-all border border-gray-700/60 rounded-2xl p-3 shadow-md relative overflow-hidden group">
      {/* Top Bar: Avatar + Rank Badge + Username + All Reigning Badges + Activity Pill + Actions + Timestamp */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with Crown Emoji for 1st Place + Highlighted Daily Rank Badge */}
          <div className="relative shrink-0 pt-1">
            {userRank === 1 && (
              <span
                className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg z-10 select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter brightness-110"
                role="img"
                aria-label="crown"
              >
                👑
              </span>
            )}
            <ProtectedAvatar
              userId={activity.user_id}
              src={activity.avatar_url}
              username={activity.username}
              className={`w-9 h-9 rounded-full border ${userRank === 1 ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-gray-700'
                }`}
            />
            {userRank !== undefined && (
              <span
                className={`absolute -bottom-1 -right-1 px-1 min-w-[17px] h-4 rounded-full text-[9px] font-black font-mono flex items-center justify-center border shadow-xs ${userRank === 1
                  ? 'bg-yellow-400 text-black border-yellow-300'
                  : userRank <= 3
                    ? 'bg-amber-500/90 text-black border-amber-400'
                    : 'bg-gray-800 text-gray-300 border-gray-600'
                  }`}
                title={`Daily Rank: #${userRank}`}
              >
                #{userRank}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-gray-100 truncate">
                {isCurrentUser ? 'You' : formatUsername(activity.username)}
              </span>
              {/* All Reigning Badges from user_awards */}
              {activity.user_id && <ReigningBadge userId={activity.user_id} type="weekly" />}
              {activity.user_id && <ReigningBadge userId={activity.user_id} type="bot_marathon" />}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-wider ${activityHeader.badgeBg}`}
              >
                {activityHeader.icon}
                {activityHeader.title}
              </span>
            </div>
          </div>
        </div>

        {/* Top Right: Full CRUD Controls (Edit/Delete for owner) + Timestamp */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isOwner && (
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              {activity.activity_type === 'guess_comment_posted' && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                  title="Edit comment"
                >
                  <Edit2 size={12} />
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 text-gray-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40"
                title="Delete feed item"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
          <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{timeAgo}</span>
        </div>
      </div>

      {/* Editable Content Block for Comments */}
      {activity.activity_type === 'guess_comment_posted' && (
        <div className="my-2 p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-gray-200 text-xs">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-black/40 border border-cyan-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-white"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2.5 py-0.5 rounded bg-cyan-500 text-black font-bold text-[10px] flex items-center gap-1"
                >
                  <Check size={12} /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="font-sans italic text-cyan-100">
              "{activity.payload?.content}"
              {activity.payload?.is_edited && (
                <span className="text-[9px] text-cyan-400/60 ml-1.5 font-mono">(edited)</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Progressive Guess Grid Visualization (Highlighted Row + Context for Guess Comments/Reactions) */}
      {(activity.activity_type === 'guess_submitted' ||
        activity.activity_type === 'game_started' ||
        activity.activity_type === 'guess_comment_posted' ||
        activity.activity_type === 'guess_reaction_posted') && (
          <div className="bg-black/30 rounded-xl p-2.5 my-2 border border-white/5 space-y-1">
            {canViewGuesses ? (
              cumulativeGuesses.length > 0 ? (
                cumulativeGuesses.map((row: any[], rIdx: number) => {
                  const isTargetRow =
                    highlightedRowIndex !== null
                      ? rIdx === highlightedRowIndex
                      : rIdx === cumulativeGuesses.length - 1;

                  return (
                    <div
                      key={rIdx}
                      className={`flex gap-1 justify-center transition-all ${isTargetRow
                        ? 'scale-[1.03] py-0.5 ring-1 ring-amber-400/60 rounded-md bg-amber-400/5'
                        : 'opacity-60'
                        }`}
                    >
                      {row.map((cell: any, cIdx: number) => {
                        const status = cell.status;
                        const bgClass =
                          status === 'correct'
                            ? 'bg-emerald-500 text-white'
                            : status === 'present'
                              ? 'bg-amber-400 text-black'
                              : 'bg-gray-700 text-white';

                        return (
                          <span
                            key={cIdx}
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-sm shadow-xs ${bgClass} flex items-center justify-center font-black uppercase text-[10px] sm:text-xs select-none transition-all ${hideGridWords
                              ? 'blur-[2px] opacity-40 select-none text-transparent'
                              : ''
                              } ${isTargetRow ? 'font-black' : ''}`}
                          >
                            {!hideGridWords ? cell.letter || '' : ''}
                          </span>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="flex gap-1 justify-center">
                  {currentGuessResult.map((cell: any, cIdx: number) => (
                    <span
                      key={cIdx}
                      className={`w-6 h-6 rounded-sm ${cell.status === 'correct'
                        ? 'bg-emerald-500'
                        : cell.status === 'present'
                          ? 'bg-amber-400'
                          : 'bg-gray-700'
                        }`}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="py-2 text-center space-y-1">
                <div className="flex gap-1 justify-center">
                  {Array.from({ length: wordLen }).map((_, cIdx) => (
                    <span
                      key={cIdx}
                      className="w-5 h-5 rounded-xs bg-white/10 border border-white/5 opacity-50"
                    />
                  ))}
                </div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                  Finish today's game to unmask live letters
                </p>
              </div>
            )}
          </div>
        )}

      {/* Completion Game Summary Visualization (Won/Lost with Attached Full Grid) */}
      {(activity.activity_type === 'game_won' || activity.activity_type === 'game_lost') && (
        <div className="bg-black/30 rounded-xl p-3 my-2 border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
                Final Result
              </span>
              <div className="text-sm font-black text-white font-mono flex items-center gap-2">
                <span>
                  {activity.payload?.total_score ?? activity.payload?.skill_score ?? 0} pts
                </span>
                <span className="text-xs text-gray-400">
                  • {activity.activity_type === 'game_won' ? `${activity.payload?.attempts || activity.payload?.all_guesses?.length || 6}/6` : 'X/6'}
                </span>
              </div>
            </div>

            {onOpenPreview && canViewGuesses && (
              <button
                onClick={() => {
                  const attempts = activity.payload?.attempts ?? (activity.payload?.all_guesses?.length || 6);
                  const score = activity.payload?.total_score ?? activity.payload?.skill_score ?? 0;
                  const entry: LeaderboardEntry = {
                    username: activity.username || 'Player',
                    avatar_url: activity.avatar_url || '',
                    user_id: activity.user_id,
                    total_score: score,
                    days_active: 1,
                    status: activity.activity_type === 'game_won' ? 'won' : 'lost',
                    attempts: attempts,
                    guesses: activity.payload?.all_guesses || [],
                  };
                  onOpenPreview(entry, false);
                }}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 cursor-pointer transition-colors"
              >
                <Eye size={12} /> Inspect Game <ChevronRight size={12} />
              </button>
            )}
          </div>

          {/* Attached Full Grid Summary */}
          {canViewGuesses && cumulativeGuesses.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1">
              {cumulativeGuesses.map((row: any[], rIdx: number) => (
                <div key={rIdx} className="flex gap-1 justify-center">
                  {row.map((cell: any, cIdx: number) => {
                    const status = cell.status;
                    const bgClass =
                      status === 'correct'
                        ? 'bg-emerald-500 text-white'
                        : status === 'present'
                          ? 'bg-amber-400 text-black'
                          : 'bg-gray-700 text-white';

                    return (
                      <span
                        key={cIdx}
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-xs shadow-xs ${bgClass} flex items-center justify-center font-black uppercase text-[9px] sm:text-[10px] select-none transition-all ${hideGridWords
                          ? 'blur-[2px] opacity-40 select-none text-transparent'
                          : ''
                          }`}
                      >
                        {!hideGridWords ? cell.letter || '' : ''}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint Activity Visualization */}
      {activity.activity_type === 'hint_used' && (
        <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-2.5 my-2 flex items-center gap-2.5 text-purple-200 text-xs">
          <HelpCircle size={18} className="text-purple-400 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold text-purple-300 block text-[11px]">
              {(canViewGuesses || isCurrentUser) && activity.payload?.letter && activity.payload?.position
                ? `Letter Hint: "${activity.payload.letter}" at Position ${activity.payload.position}`
                : 'Used a Strategic Letter Hint'}
            </span>
            <span className="text-[10px] text-purple-300/70 block">
              {(canViewGuesses || isCurrentUser)
                ? 'Narrowed down candidate possibilities.'
                : '🔒 Complete today\'s game to unmask hint details.'}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Bar: 1-Tap Reactions + Comments Button */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-2 gap-2">
        {/* Emoji Reaction Badges */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {FEED_EMOJIS.map(({ emoji, label }) => {
            const count = reactions.filter((r) => r.reaction === emoji).length;
            const hasReacted =
              currentUser && reactions.some((r) => r.user_id === currentUser.id && r.reaction === emoji);

            return (
              <button
                key={emoji}
                onClick={(e) => handleToggleReaction(emoji, e)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${hasReacted
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-xs scale-105'
                  : count > 0
                    ? 'bg-gray-700/60 text-gray-300 border-gray-600 hover:bg-gray-700'
                    : 'bg-transparent text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-300'
                  }`}
                title={label}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="text-[10px] font-mono font-bold">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Comment Drawer Button */}
        <button
          onClick={() => setIsCommentDrawerOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold shrink-0 cursor-pointer"
        >
          <MessageCircle size={13} />
          {commentsCount > 0 && <span className="font-mono text-[11px]">{commentsCount}</span>}
        </button>
      </div>

      {/* Comment Drawer Overlay for this specific activity item */}
      {isCommentDrawerOpen && (
        <FeedCommentDrawer
          isOpen={isCommentDrawerOpen}
          onClose={() => setIsCommentDrawerOpen(false)}
          targetUserId={targetUserId}
          targetUsername={activity.payload?.target_username || activity.username || 'Player'}
          gameDate={gameDate}
          canViewGuesses={canViewGuesses}
          hideGridWords={hideGridWords}
          rawGuesses={cumulativeGuesses}
          status={activity.payload?.status || 'playing'}
          attempts={activity.payload?.guess_number || (guessIdx + 1)}
          wordLength={wordLen}
          onCommentAdded={() => setCommentsCount((c) => c + 1)}
        />
      )}
    </div>
  );
};
