/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageCircle, Heart, Send, X, Edit2, Trash2, Smile, Loader2, CornerDownRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import formatUsername from '../../utils/formatUsername';

interface GuessReactionsCommentsProps {
    targetUserId: string;
    gameDate: string;
    guessIndex: number;
    commentsDisabledByTarget: boolean;
    formattedTime?: string | null;
    row?: any[];
    canSeeDetails?: boolean;
}

interface Comment {
    id: string;
    content: string;
    author_id: string;
    created_at: string;
    author_username?: string;
    is_edited: boolean;
    is_deleted: boolean;
    parent_id?: string | null;
}

interface Reaction {
    reaction: string;
    user_id: string;
}

interface CommentReaction {
    comment_id: string;
    reaction: string;
    user_id: string;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👀'];

const getCommenterBgColor = (authorId: string) => {
    let hash = 0;
    for (let i = 0; i < authorId.length; i++) {
        hash = authorId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 45%, 15%)`;
};

export const GuessReactionsComments: React.FC<GuessReactionsCommentsProps> = ({
    targetUserId,
    gameDate,
    guessIndex,
    commentsDisabledByTarget,
    formattedTime,
    row,
    canSeeDetails,
}) => {
    const { user: currentUser } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [reactionUsernames, setReactionUsernames] = useState<{ reaction: string; username: string }[]>([]);
    const [commentReactions, setCommentReactions] = useState<CommentReaction[]>([]);
    const [showCommentDrawer, setShowCommentDrawer] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
    const longPressTimer = useRef<any>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);

    // Edit state
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [activeCommentReactionPicker, setActiveCommentReactionPicker] = useState<string | null>(null);
    const [selectedEmojiFilter, setSelectedEmojiFilter] = useState<string | null>(null);

    const fetchData = async () => {
        // Parallelized fetch of reactions and comments
        const fetchReactionsPromise = async () => {
            const { data: rxData } = await supabase
                .from('guess_reactions')
                .select('reaction, user_id')
                .eq('target_user_id', targetUserId)
                .eq('game_date', gameDate)
                .eq('guess_index', guessIndex);

            if (rxData) {
                setReactions(rxData);
                const rxUserIds = Array.from(new Set(rxData.map(r => r.user_id)));
                if (rxUserIds.length > 0) {
                    const { data: rxProfiles } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .in('id', rxUserIds);
                    const rxProfileMap = new Map(rxProfiles?.map(p => [p.id, p.username]));
                    setReactionUsernames(
                        rxData.map(r => ({
                            reaction: r.reaction,
                            username: rxProfileMap.get(r.user_id) || 'Someone'
                        }))
                    );
                } else {
                    setReactionUsernames([]);
                }
            }
        };

        const fetchCommentsPromise = async () => {
            if (commentsDisabledByTarget) return;

            const { data: cmData } = await supabase
                .from('guess_comments')
                .select('id, content, author_id, created_at, is_edited, is_deleted, parent_id')
                .eq('target_user_id', targetUserId)
                .eq('game_date', gameDate)
                .eq('guess_index', guessIndex)
                .order('created_at', { ascending: true });

            if (cmData) {
                const authorIds = Array.from(new Set(cmData.map(c => c.author_id)));
                if (authorIds.length > 0) {
                    // Parallelized fetch of authors and comment reactions
                    const [authorsResult, cRxResult] = await Promise.all([
                        supabase
                            .from('profiles')
                            .select('id, username')
                            .in('id', authorIds),
                        supabase
                            .from('comment_reactions')
                            .select('comment_id, reaction, user_id')
                            .in('comment_id', cmData.map(c => c.id))
                    ]);

                    const authors = authorsResult.data;
                    const cRxData = cRxResult.data;

                    const authorMap = new Map(authors?.map(a => [a.id, a.username]));
                    const commentsWithUsernames = cmData.map(c => ({
                        ...c,
                        author_username: authorMap.get(c.author_id) || 'Someone',
                        is_edited: c.is_edited || false,
                        is_deleted: c.is_deleted || false,
                        parent_id: c.parent_id || null
                    }));
                    setComments(commentsWithUsernames);

                    if (cRxData) {
                        setCommentReactions(cRxData);
                    }
                } else {
                    setComments([]);
                    setCommentReactions([]);
                }
            }
        };

        await Promise.all([fetchReactionsPromise(), fetchCommentsPromise()]);
    };

    // Fetch comments and reactions
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();

        // Set up Realtime subscriptions
        const rxChannel = supabase
            .channel(`rx_${targetUserId}_${gameDate}_${guessIndex}_${Math.random().toString(36).slice(2, 9)}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'guess_reactions',
                    filter: `target_user_id=eq.${targetUserId}`,
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        const cmChannel = supabase
            .channel(`cm_${targetUserId}_${gameDate}_${guessIndex}_${Math.random().toString(36).slice(2, 9)}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'guess_comments',
                    filter: `target_user_id=eq.${targetUserId}`,
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        const cRxChannel = supabase
            .channel(`crx_${targetUserId}_${gameDate}_${guessIndex}_${Math.random().toString(36).slice(2, 9)}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comment_reactions',
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(rxChannel);
            supabase.removeChannel(cmChannel);
            supabase.removeChannel(cRxChannel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId, gameDate, guessIndex, commentsDisabledByTarget]);

    // Handle custom event to open the comment drawer
    useEffect(() => {
        const handleOpenComments = (e: CustomEvent) => {
            const { guessIndex: targetIdx } = e.detail || {};
            if (targetIdx === guessIndex) {
                setShowCommentDrawer(true);
            }
        };

        window.addEventListener('open-row-comments' as any, handleOpenComments);
        return () => {
            window.removeEventListener('open-row-comments' as any, handleOpenComments);
        };
    }, [guessIndex]);

    const handleReact = async (emoji: string) => {
        if (!currentUser) return;
        setShowEmojiPicker(false);

        // Check if user already reacted with this emoji
        const existing = reactions.find(r => r.user_id === currentUser.id);
        if (existing && existing.reaction === emoji) {
            // Delete reaction
            const { error } = await supabase
                .from('guess_reactions')
                .delete()
                .eq('target_user_id', targetUserId)
                .eq('game_date', gameDate)
                .eq('guess_index', guessIndex)
                .eq('user_id', currentUser.id);
            if (!error) {
                setReactions(prev => prev.filter(r => r.user_id !== currentUser.id));
            }
        } else {
            // Upsert reaction
            const { error } = await supabase
                .from('guess_reactions')
                .upsert({
                    target_user_id: targetUserId,
                    game_date: gameDate,
                    guess_index: guessIndex,
                    user_id: currentUser.id,
                    reaction: emoji
                });
            if (!error) {
                setReactions(prev => {
                    const filtered = prev.filter(r => r.user_id !== currentUser.id);
                    return [...filtered, { reaction: emoji, user_id: currentUser.id }];
                });
            }
        }
    };

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newComment.trim() || commentsDisabledByTarget || submittingComment) return;

        setSubmittingComment(true);
        const parentId = replyToComment ? (replyToComment.parent_id || replyToComment.id) : null;

        const { error } = await supabase
            .from('guess_comments')
            .insert({
                target_user_id: targetUserId,
                game_date: gameDate,
                guess_index: guessIndex,
                author_id: currentUser.id,
                content: newComment.trim(),
                parent_id: parentId
            });

        if (!error) {
            setNewComment('');
            setReplyToComment(null);
            fetchData();
        }
        setSubmittingComment(false);
    };

    const handleStartReply = (comment: Comment) => {
        setReplyToComment(comment);
        if (commentInputRef.current) {
            commentInputRef.current.focus();
        }
    };

    const handleStartEdit = (comment: Comment) => {
        setEditingCommentId(comment.id);
        setEditCommentText(comment.content);
    };

    const handleSaveEdit = async (commentId: string) => {
        if (!editCommentText.trim() || !currentUser) return;
        const { error } = await supabase
            .from('guess_comments')
            .update({
                content: editCommentText.trim(),
                is_edited: true
            })
            .eq('id', commentId)
            .eq('author_id', currentUser.id);

        if (!error) {
            setEditingCommentId(null);
            fetchData();
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!currentUser) return;
        const { error } = await supabase
            .from('guess_comments')
            .update({
                content: '[This comment has been deleted]',
                is_deleted: true
            })
            .eq('id', commentId)
            .eq('author_id', currentUser.id);

        if (!error) {
            fetchData();
        }
    };

    const handleCommentReact = async (commentId: string, emoji: string) => {
        if (!currentUser) return;
        setActiveCommentReactionPicker(null);

        const existing = commentReactions.find(
            r => r.comment_id === commentId && r.user_id === currentUser.id
        );

        if (existing && existing.reaction === emoji) {
            // Remove reaction
            await supabase
                .from('comment_reactions')
                .delete()
                .eq('comment_id', commentId)
                .eq('user_id', currentUser.id);
        } else {
            // Upsert reaction
            await supabase
                .from('comment_reactions')
                .upsert({
                    comment_id: commentId,
                    user_id: currentUser.id,
                    reaction: emoji
                });
        }
        fetchData();
    };

    // Threading computation
    const rootComments = useMemo(() => comments.filter(c => !c.parent_id), [comments]);
    const repliesByParent = useMemo(() => {
        const map: Record<string, Comment[]> = {};
        comments.forEach(c => {
            if (c.parent_id) {
                if (!map[c.parent_id]) map[c.parent_id] = [];
                map[c.parent_id].push(c);
            }
        });
        return map;
    }, [comments]);

    // Calculate aggregated reactions count
    const reactionCounts = EMOJIS.map(emoji => ({
        emoji,
        count: reactions.filter(r => r.reaction === emoji).length,
        hasReacted: reactions.some(r => r.user_id === currentUser?.id && r.reaction === emoji)
    })).filter(r => r.count > 0);

    const myActiveReaction = reactions.find(r => r.user_id === currentUser?.id)?.reaction;

    // Hold to react triggers
    const handleTouchStart = () => {
        if (!currentUser) return;
        longPressTimer.current = setTimeout(() => {
            setShowEmojiPicker(true);
        }, 500); // 500ms long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    // Reusable single comment renderer
    const renderCommentBox = (c: Comment, isReply = false) => {
        const isAuthor = currentUser?.id === c.author_id;
        const isEditing = editingCommentId === c.id;

        // Comment reactions calculation
        const cReactions = commentReactions.filter(r => r.comment_id === c.id);
        const cReactionCounts = EMOJIS.map(emoji => ({
            emoji,
            count: cReactions.filter(r => r.reaction === emoji).length,
            hasReacted: cReactions.some(r => r.user_id === currentUser?.id && r.reaction === emoji)
        })).filter(r => r.count > 0);

        const commenterBg = getCommenterBgColor(c.author_id);

        return (
            <div
                key={c.id}
                className="p-2.5 rounded-xl text-left relative group border border-white/5"
                style={{ backgroundColor: commenterBg }}
            >
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-black text-white">@{formatUsername(c.author_username || '')}</span>
                        {isReply && (
                            <span className="text-[9px] text-white/70 font-semibold italic">reply</span>
                        )}
                        {c.is_edited && !c.is_deleted && (
                            <span className="text-[7.5px] bg-white/20 px-1 rounded-sm text-white font-bold uppercase">Edited</span>
                        )}
                    </div>
                    <span className="text-[10px] text-white/80">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {isEditing ? (
                    <div className="flex flex-col gap-1.5 mt-1.5">
                        <input
                            type="text"
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setEditingCommentId(null)}
                                className="text-[9px] uppercase font-black text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSaveEdit(c.id)}
                                className="text-[9px] uppercase font-black text-white px-2 py-1 bg-indigo-600 rounded-md"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className={`text-xs wrap-break-word font-medium ${c.is_deleted ? 'text-white/60 italic' : 'text-white'}`}>{c.content}</p>

                        {/* Reactions on Comment */}
                        {cReactionCounts.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                {cReactionCounts.map(({ emoji, count, hasReacted }) => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleCommentReact(c.id, emoji)}
                                        className={`flex items-center gap-0.5 px-1 py-0.2 rounded-full text-[8px] ${hasReacted
                                            ? 'bg-correct/20 border border-correct/30 text-correct'
                                            : 'bg-white/5 border border-white/5 text-gray-400'
                                            }`}
                                    >
                                        <span>{emoji}</span>
                                        <span className="font-bold">{count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Actions bar */}
                        {currentUser && !c.is_deleted && (
                            <div className="flex items-center justify-end gap-2 mt-1.5 pt-1 border-t border-white/10">
                                {/* Reply button */}
                                <button
                                    onClick={() => handleStartReply(c)}
                                    className="text-white/60 hover:text-white transition-colors mr-auto"
                                    title="Reply"
                                >
                                    <CornerDownRight size={10} />
                                </button>

                                {/* React button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setActiveCommentReactionPicker(activeCommentReactionPicker === c.id ? null : c.id)}
                                        className="text-white/60 hover:text-white transition-colors"
                                        title="React to comment"
                                    >
                                        <Smile size={10} />
                                    </button>

                                    {activeCommentReactionPicker === c.id && (
                                        <div className="absolute right-0 bottom-4 bg-gray-950 border border-gray-800 rounded-xl p-1 flex gap-1 z-50 shadow-2xl animate-in zoom-in-95 duration-100">
                                            {EMOJIS.slice(0, 3).map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleCommentReact(c.id, emoji)}
                                                    className="text-sm p-1 hover:bg-white/10 rounded-md"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {isAuthor && (
                                    <>
                                        <button
                                            onClick={() => handleStartEdit(c)}
                                            className="text-white/60 hover:text-white transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteComment(c.id)}
                                            className="text-white/60 hover:text-red-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    return (
        <div
            className="flex flex-col w-full relative mt-1 select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="flex items-center justify-between px-1 py-1">
                {/* Reactions list */}
                <div className="flex flex-wrap items-center gap-1">
                    {reactionCounts.map(({ emoji, count, hasReacted }) => (
                        <button
                            key={emoji}
                            onClick={() => setSelectedEmojiFilter(emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all ${hasReacted
                                ? 'bg-correct/20 border border-correct/30 text-correct'
                                : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <span>{emoji}</span>
                            <span className="font-bold">{count}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`text-gray-500 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors ${showEmojiPicker ? 'text-indigo-400' : ''}`}
                        title="Add Reaction"
                    >
                        <Heart size={12} className={myActiveReaction ? 'fill-indigo-400 text-indigo-400' : ''} />
                    </button>
                </div>

                {/* Timestamp in the middle */}
                {formattedTime && (
                    <span className="text-[9px] font-mono text-gray-400/80 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {formattedTime}
                    </span>
                )}

                {/* Comments button */}
                {!commentsDisabledByTarget && (
                    <button
                        onClick={() => setShowCommentDrawer(true)}
                        className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        <MessageCircle size={12} />
                        <span>{comments.length}</span>
                    </button>
                )}
            </div>

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
                <div className="absolute bottom-7 left-0 bg-gray-950 border border-gray-800 rounded-xl p-1.5 flex gap-1 z-50 shadow-2xl animate-in zoom-in-95 duration-150">
                    {EMOJIS.map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => handleReact(emoji)}
                            className={`text-lg p-1.5 hover:bg-white/10 rounded-lg transition-colors ${myActiveReaction === emoji ? 'bg-white/5 ring-1 ring-indigo-500' : ''
                                }`}
                        >
                            {emoji}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowEmojiPicker(false)}
                        className="text-gray-500 hover:text-white p-1.5"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Comments Modal (Centered) */}
            {showCommentDrawer && !commentsDisabledByTarget && (
                <div className="fixed inset-0 bg-black/60 z-250 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setShowCommentDrawer(false)} />
                    <div className="relative w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col max-h-[75vh] z-10 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Comments</span>
                                {row && (
                                    <div className="flex gap-0.5">
                                        {row.map((cell: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className={`w-5 h-5 rounded-[4px] flex items-center justify-center font-black uppercase text-[9px] shadow-inner ${cell.status === "correct"
                                                        ? "bg-correct text-white"
                                                        : cell.status === "present"
                                                            ? "bg-present text-white"
                                                            : "bg-gray-800 text-white border border-gray-700"
                                                    }`}
                                            >
                                                {canSeeDetails ? cell.letter : ""}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowCommentDrawer(false)} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        {/* List of comments */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide py-1">
                            {comments.length === 0 ? (
                                <p className="text-[10px] text-gray-600 uppercase tracking-wider text-center py-8">No comments yet. Say something nice!</p>
                            ) : (
                                rootComments.map(c => (
                                    <div key={c.id} className="space-y-2">
                                        {/* Parent comment */}
                                        {renderCommentBox(c, false)}

                                        {/* Nested replies */}
                                        {repliesByParent[c.id]?.length > 0 && (
                                            <div className="pl-4 ml-3 border-l-2 border-indigo-500/20 space-y-2">
                                                {repliesByParent[c.id].map(reply => renderCommentBox(reply, true))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Comment Input or Sign-in Prompt */}
                        {!currentUser ? (
                            <div className="text-center py-3 text-[9px] font-black uppercase tracking-widest text-indigo-400/80 border-t border-gray-900 mt-2 bg-gray-900/20 rounded-xl">
                                Sign in to leave a comment
                            </div>
                        ) : (
                            <div className="border-t border-gray-900 pt-3 mt-2 flex flex-col gap-1.5">
                                {/* Reply indicator banner */}
                                {replyToComment && (
                                    <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-lg px-2.5 py-1 text-[10px] text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <CornerDownRight size={10} className="text-indigo-400" />
                                            <span>Replying to <span className="text-indigo-300 font-bold">@{formatUsername(replyToComment.author_username || '')}</span></span>
                                        </span>
                                        <button onClick={() => setReplyToComment(null)} className="text-gray-500 hover:text-white p-0.5">
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}
                                <form onSubmit={handleSendComment} className="flex gap-2">
                                    <input
                                        ref={commentInputRef}
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder={replyToComment ? `Reply to @${formatUsername(replyToComment.author_username || '')}...` : "Add a comment..."}
                                        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500/50 text-white placeholder-gray-600"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newComment.trim() || submittingComment}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center min-w-[34px]"
                                    >
                                        {submittingComment ? (
                                            <Loader2 size={14} className="animate-spin text-white" />
                                        ) : (
                                            <Send size={14} />
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Reactions Detail Viewer Modal */}
            {selectedEmojiFilter && (
                <div
                    onClick={() => setSelectedEmojiFilter(null)}
                    className="fixed inset-0 bg-black/60 z-300 flex items-center justify-center p-4 animate-in fade-in duration-150"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-950 border border-gray-800 rounded-2xl p-4 w-full max-w-xs shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-150"
                    >
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2 mb-3">
                            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Reacted with {selectedEmojiFilter}</span>
                            <button onClick={() => setSelectedEmojiFilter(null)} className="text-gray-500 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-hide py-1">
                            {reactionUsernames.filter(ru => ru.reaction === selectedEmojiFilter).map((ru, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-white/5 py-1.5 px-2.5 rounded-lg">
                                    <span className="font-bold text-gray-200">@{formatUsername(ru.username)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
