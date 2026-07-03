/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Reply, CheckCheck, Smile, Pencil, Trash2 } from "lucide-react";
import { ReigningBadge } from "../../common/ReigningBadge";
import { ProtectedAvatar } from "../ProtectedAvatar";
import { useAppStore } from '../../../store/useAppStore';

import type { ChatMessageProps } from './types';
import { MENTION_COLORS } from './constants';
import { ReactionPicker } from './ReactionPicker';
import { ReactionModal } from './ReactionModal';
import { ReactionBadge } from './ReactionBadge';
import { ConnectedAudioPlayer } from './ConnectedAudioPlayer';
import { ChatImage } from './ChatImage';
import { MessageContent } from './MessageContent';

const ChatMessage = memo(({
    msg,
    isMe,
    replyMsg,
    onReply,
    onScrollToMessage,
    onMarkAsRead,
    users,
    allProfiles,
    onReact,
    currentUserId,
    onEdit,
    onDelete,
    dailyGuesses,
    onResend,
    allMessageIds,
    allMessages
}: ChatMessageProps) => {
    const triggerToast = useAppStore(s => s.triggerToast);
    const time = useMemo(() => new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), [msg.created_at]);
    const x = useMotionValue(0);

    // Inline edit and menu states
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.content);
    const [showReactionsMenu, setShowReactionsMenu] = useState(false);
    const [showReactionsModal, setShowReactionsModal] = useState(false);
    const [showReactionDetails, setShowReactionDetails] = useState(false);
    const reactionsRef = useRef<HTMLDivElement>(null);
    const detailsRef = useRef<HTMLDivElement>(null);

    // Outside click to close menus
    useEffect(() => {
        if (!showReactionsMenu && !showReactionDetails) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (showReactionsMenu && reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
                setShowReactionsMenu(false);
            }
            if (showReactionDetails && detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
                setShowReactionDetails(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showReactionsMenu, showReactionDetails]);

    // Transform x position to reply icon properties (swipe to right)
    const replyIconOpacity = useTransform(x, [0, 50], [0, 1]);
    const replyIconScale = useTransform(x, [0, 50], [0.5, 1.1]);
    const replyIconTranslateX = useTransform(x, [0, 50], [-20, 12]);

    const copyToClipboard = async (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.width = "1px";
                textArea.style.height = "1px";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (copyErr) {
                    console.error('execCommand copy failed:', copyErr);
                }
                textArea.remove();
            }
            triggerToast("Message copied to clipboard", 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            triggerToast("Failed to copy message", 2000);
        }
    };

    const senderColor = useMemo(() => {
        const userIndex = users.findIndex(u => u.username === msg.profiles?.username);
        return MENTION_COLORS[userIndex % MENTION_COLORS.length] || '#38bdf8';
    }, [users, msg.profiles?.username]);

    const isWithinTimeLimit = useMemo(() => {
        const elapsed = Date.now() - new Date(msg.created_at).getTime();
        return elapsed < 5 * 60 * 1000; // 5 minutes
    }, [msg.created_at]);

    const isEditable = isMe && !msg.is_deleted && isWithinTimeLimit;

    // Long press logic for mobile reaction toggling
    const longPressTimeoutRef = useRef<any>(null);
    const hasDraggedRef = useRef<boolean>(false);

    useEffect(() => {
        return () => {
            if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
        };
    }, []);

    const handleTouchStart = () => {
        hasDraggedRef.current = false;
        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = setTimeout(() => {
            if (!hasDraggedRef.current) {
                setShowReactionsModal(prev => !prev);
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    const handleTouchMove = () => {
        hasDraggedRef.current = true;
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
    };

    return (
        <div className={`relative group ${showReactionsMenu || showReactionsModal ? 'z-50' : 'z-auto'} overflow-visible`} data-message-id={msg.id}>
            <AnimatePresence>
                {showReactionsModal && (
                    <ReactionModal
                        isMe={isMe}
                        onReact={(emoji) => {
                            onReact(emoji);
                            setShowReactionsModal(false);
                        }}
                        currentReaction={msg.reactions?.[currentUserId]}
                        onCopy={() => {
                            copyToClipboard(msg.content);
                            setShowReactionsModal(false);
                        }}
                        onEdit={isEditable ? () => { setEditText(msg.content); setIsEditing(true); setShowReactionsModal(false); } : undefined}
                        onDelete={isEditable ? () => { onDelete(); setShowReactionsModal(false); } : undefined}
                        onClose={() => setShowReactionsModal(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showReactionsMenu && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowReactionsMenu(false)}
                        className="fixed inset-0 bg-black/20 z-40"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showReactionsMenu && (
                    <ReactionPicker
                        ref={reactionsRef}
                        isMe={isMe}
                        onReact={(emoji) => {
                            onReact(emoji);
                            setShowReactionsMenu(false);
                        }}
                        currentReaction={msg.reactions?.[currentUserId]}
                        onCopy={() => {
                            copyToClipboard(msg.content);
                            setShowReactionsMenu(false);
                        }}
                        onEdit={isEditable ? () => { setEditText(msg.content); setIsEditing(true); setShowReactionsMenu(false); } : undefined}
                        onDelete={isEditable ? () => { onDelete(); setShowReactionsMenu(false); } : undefined}
                    />
                )}
            </AnimatePresence>

            {(!msg.is_deleted && !isEditing) && (
                <motion.div
                    style={{ opacity: replyIconOpacity, scale: replyIconScale, x: replyIconTranslateX }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 text-correct pointer-events-none"
                >
                    <Reply size={24} />
                </motion.div>
            )}

            <motion.div
                drag={(!msg.is_deleted && !isEditing) ? "x" : false}
                dragDirectionLock
                dragConstraints={{ left: 0, right: 0 }}
                dragSnapToOrigin
                dragElastic={{ left: 0, right: 0.6 }}
                style={{ x }}
                onDragEnd={(_, info) => {
                    if (info.offset.x > 50) {
                        onReply(msg);
                    }
                }}
                initial={{ opacity: 0, x: isMe ? 20 : -20, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 cursor-grab active:cursor-grabbing touch-pan-y relative`}
                onMouseEnter={() => !isMe && !msg.is_read && onMarkAsRead(msg.id)}
            >
                {replyMsg && !msg.is_deleted && (
                    <div
                        onClick={() => onScrollToMessage?.(replyMsg.id)}
                        className={`text-[10px] mb-1.5 flex items-center gap-2 text-white/60 bg-white/5 px-3 py-1.5 rounded-t-xl border-l-2 border-correct/40 max-w-[80%] hover:bg-white/10 cursor-pointer transition-colors ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                        <Reply size={10} className="text-correct shrink-0" />
                        <span className="opacity-60 truncate">
                            {replyMsg.profiles?.username}: {replyMsg.content}
                        </span>
                    </div>
                )}

                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!msg.is_deleted && !isEditing && (
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 transition-all bg-black/25 rounded-md px-1 py-0.5 border border-white/5">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReply(msg);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                                title="Reply"
                            >
                                <Reply size={13} className="text-correct" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowReactionsMenu(!showReactionsMenu);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer relative hidden sm:inline-flex"
                                title="React"
                            >
                                <Smile size={13} className="text-white" />
                            </button>
                            {isEditable && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditText(msg.content);
                                            setIsEditing(true);
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer hidden sm:inline-flex"
                                        title="Edit message"
                                    >
                                        <Pencil size={13} className="text-blue-400" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete()
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer hidden sm:inline-flex"
                                        title="Delete message"
                                    >
                                        <Trash2 size={13} className="text-red-400" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onTouchCancel={handleTouchEnd}
                    className={`relative max-w-[85%] p-1.5 pb-2 sm:pb-3 px-2 sm:p-3 sm:px-4 shadow-lg transition-all ${isMe
                        ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-none'
                        : 'bg-[#202c33] border border-white/5 text-white rounded-2xl rounded-tl-none hover:bg-[#2a3942]'
                        }`}
                >
                    <div className={`flex items-center gap-1.5 mb-1.5 justify-start text-left`}>
                        <ProtectedAvatar
                            userId={msg.user_id}
                            src={msg.profiles?.avatar_url}
                            username={msg.profiles?.username}
                            className="w-4 h-4 rounded-full border border-white/10 hover:scale-105 transition-transform"
                            onClick={(e) => {
                                if (msg.user_id) {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: msg.user_id } }));
                                }
                            }}
                        />
                        <span
                            className="text-[9px] font-black uppercase tracking-wider cursor-pointer hover:underline text-left"
                            style={{
                                color: isMe ? '#82e0aa' : senderColor
                            }}
                            onClick={(e) => {
                                if (msg.user_id) {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: msg.user_id } }));
                                }
                            }}
                        >
                            {isMe ? 'You' : msg.profiles?.username}
                        </span>
                        {!isMe && msg.user_id && <ReigningBadge userId={msg.user_id} type="weekly" />}
                        {!isMe && msg.user_id && <ReigningBadge userId={msg.user_id} type="bot_marathon" />}
                    </div>

                    <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap wrap-break-word text-left">
                        {msg.is_deleted ? (
                            <span className="text-white/40 italic font-medium flex items-center gap-1">
                                🚫 This message was deleted
                            </span>
                        ) : isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[200px] mt-1">
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full bg-black/25 text-white border border-white/15 rounded-lg p-1.5 text-xs outline-none focus:border-correct resize-none font-sans"
                                    rows={2}
                                    maxLength={300}
                                />
                                <div className="flex justify-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="text-white/60 hover:text-white text-[10px] font-black uppercase bg-white/5 px-2.5 py-1 rounded cursor-pointer transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (editText.trim() && editText.trim() !== msg.content) {
                                                await onEdit(editText.trim());
                                            }
                                            setIsEditing(false);
                                        }}
                                        className="text-black bg-correct hover:brightness-110 text-[10px] font-black uppercase px-2.5 py-1 rounded cursor-pointer transition-all"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : msg.voice_url ? (
                            <ConnectedAudioPlayer
                                url={msg.voice_url}
                                messageId={msg.id}
                                allMessageIds={allMessageIds}
                                allMessages={allMessages}
                                userId={currentUserId}
                            />
                        ) : msg.image_url ? (
                            <ChatImage url={msg.image_url} />
                        ) : (
                            <MessageContent
                                content={msg.content}
                                isMe={isMe}
                                users={users}
                                dailyGuesses={dailyGuesses}
                                currentUserId={currentUserId}
                            />
                        )}
                    </div>

                    <div className={`text-[9px] mt-1 flex font-mono font-bold items-center gap-1.5 justify-end text-white/60 text-left`}>
                        {msg.is_edited && !msg.is_deleted && (
                            <span className="text-[8px] font-black uppercase tracking-wider text-white/40 italic">(edited)</span>
                        )}
                        {time}
                        {isMe && (
                            msg.status === "sending" ? (
                                <span className="animate-spin text-white/50 text-[10px] select-none" title="Sending...">⌛</span>
                            ) : msg.status === "failed" ? (
                                <span
                                    className="text-red-400 text-[11px] font-black cursor-pointer hover:scale-110 active:scale-95 transition-transform flex items-center gap-0.5 select-none"
                                    title="Failed. Click to retry."
                                    onClick={() => onResend?.(msg.id)}
                                >
                                    ⚠️ Retry
                                </span>
                            ) : (
                                <CheckCheck
                                    size={14}
                                    className={msg.is_read ? "text-blue-400" : "text-white/40"}
                                />
                            )
                        )}
                    </div>

                    {msg.reactions && Object.keys(msg.reactions).length > 0 && !msg.is_deleted && (
                        <>
                            <ReactionBadge
                                ref={detailsRef}
                                reactions={msg.reactions}
                                isMe={isMe}
                                onShowDetails={() => setShowReactionDetails(!showReactionDetails)}
                            />

                            <AnimatePresence>
                                {showReactionDetails && (
                                    <motion.div
                                        ref={detailsRef}
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                        className={`absolute bottom-full mb-2 ${isMe ? 'left-0' : 'right-0'} bg-[#1f2c34] border border-white/15 rounded-2xl p-2 shadow-2xl z-50 min-w-[140px] max-w-[200px]`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex flex-col gap-1.5">
                                            {Object.entries(msg.reactions).map(([uid, emoji]) => {
                                                const profile = (allProfiles || users).find(p => p.id === uid);
                                                return (
                                                    <div key={uid} className="flex items-center justify-between gap-3 px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <ProtectedAvatar
                                                                userId={uid}
                                                                src={profile?.avatar_url}
                                                                username={profile?.username || 'Unknown'}
                                                                className="w-4 h-4 rounded-full shrink-0"
                                                            />
                                                            <span className="text-[10px] font-black text-white truncate">
                                                                {uid === currentUserId ? 'You' : (profile?.username || 'Someone')}
                                                            </span>
                                                        </div>
                                                        <span className="text-[12px] shrink-0">{emoji as string}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
