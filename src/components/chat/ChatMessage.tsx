/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useMemo, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Reply, CheckCheck, Smile, Play, Pause, Pencil, Trash2 } from "lucide-react";
import type { Message } from "../../hooks/useChat";
import type { JSX } from "react";
import { ProtectedAvatar } from "./ProtectedAvatar";

interface ChatMessageProps {
    msg: Message;
    isMe: boolean;
    replyMsg?: Message;
    onReply: (msg: Message) => void;
    onMarkAsRead: (id: string) => void;
    users: { username: string; avatar_url: string; id: string }[];
    onReact: (emoji: string | null) => void;
    currentUserId: string;
    onEdit: (newContent: string) => Promise<void>;
    onDelete: () => Promise<void>;
    dailyGuesses?: any[];
}

const MENTION_COLORS = ["#4ade80", "#60a5fa", "#f87171", "#fbbf24", "#c084fc", "#22d3ee", "#f472b6", "#fb923c"];
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const AudioPlayer = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => console.error(err));
        }
        setIsPlaying(!isPlaying);
    };

    const handleSpeedChange = () => {
        if (!audioRef.current) return;
        let nextRate: number;
        if (playbackRate === 1) nextRate = 1.5;
        else if (playbackRate === 1.5) nextRate = 2;
        else nextRate = 1;

        audioRef.current.playbackRate = nextRate;
        setPlaybackRate(nextRate);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 bg-black/30 p-2.5 rounded-xl min-w-[220px] border border-white/5 my-1">
            <audio
                ref={audioRef}
                src={url}
                onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
            />
            <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-correct text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            >
                {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
            </button>
            <div className="flex-1 flex flex-col gap-1">
                {/* Seek Bar */}
                <div
                    className="h-1.5 w-full bg-white/20 rounded-full cursor-pointer relative"
                    onClick={(e) => {
                        if (!audioRef.current || duration === 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const newTime = (clickX / rect.width) * duration;
                        audioRef.current.currentTime = newTime;
                        setCurrentTime(newTime);
                    }}
                >
                    <div
                        className="h-full bg-correct rounded-full"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-white/80 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
            <button
                type="button"
                onClick={handleSpeedChange}
                className="text-[10px] font-black bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md transition-colors border border-white/5 cursor-pointer"
            >
                {playbackRate}x
            </button>
        </div>
    );
};

const ChatMessage = memo(({ msg, isMe, replyMsg, onReply, onMarkAsRead, users, onReact, currentUserId, onEdit, onDelete, dailyGuesses }: ChatMessageProps) => {
    const time = useMemo(() => new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), [msg.created_at]);
    const x = useMotionValue(0);

    // Inline edit and menu states
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(msg.content);
    const [showReactionsMenu, setShowReactionsMenu] = useState(false);
    const [zoomOpen, setZoomOpen] = useState(false);

    // Transform x position to reply icon properties (swipe to right)
    const replyIconOpacity = useTransform(x, [0, 50], [0, 1]);
    const replyIconScale = useTransform(x, [0, 50], [0.5, 1.1]);
    const replyIconTranslateX = useTransform(x, [0, 50], [-20, 12]);

    const senderColor = useMemo(() => {
        const userIndex = users.findIndex(u => u.username === msg.profiles?.username);
        return MENTION_COLORS[userIndex % MENTION_COLORS.length] || '#38bdf8';
    }, [users, msg.profiles?.username]);

    const isWithinTimeLimit = useMemo(() => {
        // eslint-disable-next-line react-hooks/purity
        const elapsed = Date.now() - new Date(msg.created_at).getTime();
        return elapsed < 5 * 60 * 1000; // 5 minutes
    }, [msg.created_at]);

    const isEditable = isMe && !msg.is_deleted && isWithinTimeLimit;

    const renderedContent = useMemo(() => {
        const content = msg.content;
        if (!content) return null;

        // Render Guess tag inline
        const guessMatch = content.match(/\[guess:([a-zA-Z0-9-]+)\]/);
        if (guessMatch && dailyGuesses) {
            const guessData = dailyGuesses.find(dg => dg.user_id === guessMatch[1]);
            if (guessData) {
                const username = guessData.profiles?.username || "Player";
                const won = guessData.status === "won";
                const score = won ? guessData.guesses.length : "X";
                const grid = guessData.guesses.map((row: any[], rIdx: number) => (
                    <div key={rIdx} className="flex gap-0.5 justify-center">
                        {row.map((cell: any, cIdx: number) => (
                            <div
                                key={cIdx}
                                className={`w-3.5 h-3.5 rounded-sm ${cell.status === "correct"
                                        ? "bg-correct"
                                        : cell.status === "present"
                                            ? "bg-present"
                                            : "bg-gray-700/50"
                                    }`}
                            />
                        ))}
                    </div>
                ));

                return (
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 my-2 text-center shadow-inner max-w-full">
                        <p className="text-[10px] font-black uppercase text-correct tracking-wider mb-3">
                            🎯 {username}'s Guess Board ({score}/6)
                        </p>
                        <div className="flex flex-col gap-0.5 bg-black/20 p-3 rounded-xl inline-block">
                            {grid}
                        </div>
                    </div>
                );
            }
        }

        const sortedUsers = [...users].sort((a, b) => b.username.length - a.username.length);
        let parts: (string | JSX.Element)[] = [content];

        // Handle Mentions
        sortedUsers.forEach((user) => {
            const userIndex = users.findIndex(u => u.username === user.username);
            const color = MENTION_COLORS[userIndex % MENTION_COLORS.length];
            const mention = `@${user.username}`;

            const newParts: (string | JSX.Element)[] = [];
            parts.forEach((part, pIdx) => {
                if (typeof part !== 'string') {
                    newParts.push(part);
                    return;
                }

                const subParts = part.split(new RegExp(`(${mention}(?:\\s|$))`, 'g'));
                subParts.forEach((subPart, sIdx) => {
                    if (subPart.startsWith(mention)) {
                        const endsWithSpace = subPart.endsWith(' ');
                        const cleanMention = endsWithSpace ? subPart.slice(0, -1) : subPart;

                        newParts.push(
                            <span
                                key={`mention-${user.username}-${pIdx}-${sIdx}`}
                                className={`inline-block px-1.5 py-0.5 rounded-md text-[12px] font-black transition-all`}
                                style={{
                                    backgroundColor: `${color}33`,
                                    color: isMe ? '#fff' : color,
                                    border: `1px solid ${color}20`
                                }}
                            >
                                {cleanMention}
                            </span>
                        );
                        if (endsWithSpace) newParts.push(' ');
                    } else if (subPart !== '') {
                        newParts.push(subPart);
                    }
                });
            });
            parts = newParts;
        });

        // Handle URLs
        const finalParts: (string | JSX.Element)[] = [];
        parts.forEach((part, pIdx) => {
            if (typeof part !== 'string') {
                finalParts.push(part);
                return;
            }

            const subParts = part.split(URL_REGEX);
            subParts.forEach((subPart, sIdx) => {
                if (URL_REGEX.test(subPart)) {
                    finalParts.push(
                        <a
                            key={`url-${pIdx}-${sIdx}`}
                            href={subPart}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`underline break-all transition-colors ${isMe ? 'text-white hover:text-white/80' : 'text-correct hover:text-correct/80'}`}
                        >
                            {subPart}
                        </a>
                    );
                } else if (subPart !== '') {
                    finalParts.push(subPart);
                }
            });
        });

        return finalParts;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [msg.content, users, isMe]);

    return (
        <div className="relative group overflow-visible">
            {/* Swipe Reply Indicator */}
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
                dragElastic={{ left: 0, right: 0.6 }} // Only allow dragging to the right
                style={{ x }}
                onDragEnd={(_, info) => {
                    if (info.offset.x > 50) {
                        onReply(msg);
                    }
                }}
                onMouseLeave={() => setShowReactionsMenu(false)}
                initial={{ opacity: 0, x: isMe ? 20 : -20, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 cursor-grab active:cursor-grabbing touch-pan-y relative`}
                onMouseEnter={() => !isMe && !msg.is_read && onMarkAsRead(msg.id)}
            >
                {/* Reply Preview */}
                {replyMsg && !msg.is_deleted && (
                    <div className={`text-[10px] mb-1.5 flex items-center gap-2 text-white/60 bg-white/5 px-3 py-1.5 rounded-t-xl border-l-2 border-correct/40 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                        <Reply size={10} className="text-correct shrink-0" />
                        <span className="opacity-60 truncate">
                            {replyMsg.profiles?.username}: {replyMsg.content}
                        </span>
                    </div>
                )}

                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Action buttons (Reply, React, Edit, Delete) */}
                    {!msg.is_deleted && !isEditing && (
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 transition-all bg-black/25 rounded-md px-1 py-0.5 border border-white/5">
                            <button
                                type="button"
                                onClick={() => onReply(msg)}
                                className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                                title="Reply"
                            >
                                <Reply size={13} className="text-correct" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowReactionsMenu(!showReactionsMenu)}
                                className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer relative"
                                title="React"
                            >
                                <Smile size={13} className="text-white" />
                            </button>
                            {isEditable && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditText(msg.content);
                                            setIsEditing(true);
                                        }}
                                        className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                                        title="Edit message"
                                    >
                                        <Pencil size={13} className="text-blue-400" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm("Delete this message?")) {
                                                onDelete();
                                            }
                                        }}
                                        className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                                        title="Delete message"
                                    >
                                        <Trash2 size={13} className="text-red-400" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Reactions Quick Picker popover */}
                    <AnimatePresence>
                        {showReactionsMenu && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                                className={`absolute ${isMe ? 'right-0' : 'left-0'} top-[-40px] flex items-center gap-1.5 bg-[#1f2c34] border border-white/15 rounded-full px-2 py-1.5 shadow-2xl z-50`}
                            >
                                {EMOJIS.map((emoji) => {
                                    const hasReacted = msg.reactions?.[currentUserId] === emoji;
                                    return (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => {
                                                onReact(hasReacted ? null : emoji);
                                                setShowReactionsMenu(false);
                                            }}
                                            className={`text-[15px] hover:scale-135 transition-transform duration-100 cursor-pointer ${hasReacted ? 'bg-white/10 rounded-full px-0.5' : ''}`}
                                        >
                                            {emoji}
                                        </button>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className={`relative max-w-[85%] p-3 px-4 shadow-lg transition-all ${isMe
                    ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-none'
                    : 'bg-[#202c33] border border-white/5 text-white rounded-2xl rounded-tl-none hover:bg-[#2a3942]'
                    }`}>

                    {/* Sender profile header inside the bubble container */}
                    <div className={`flex items-center gap-1.5 mb-1.5 justify-start text-left`}>
                        <ProtectedAvatar
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
                                color: isMe
                                    ? '#82e0aa' // Outgoing gets a light green sender name
                                    : senderColor // Incoming gets their custom mention color
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
                            <AudioPlayer url={msg.voice_url} />
                        ) : msg.image_url ? (
                            <>
                                <div className="mt-1 relative overflow-hidden rounded-xl border border-white/10 group cursor-pointer max-w-full" onClick={() => setZoomOpen(true)}>
                                    <img
                                        src={msg.image_url}
                                        className="max-h-60 w-auto rounded-xl hover:scale-102 transition-transform duration-300"
                                        alt="shared file"
                                    />
                                </div>
                                <AnimatePresence>
                                    {zoomOpen && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onClick={() => setZoomOpen(false)}
                                            className="fixed inset-0 bg-black/90 z-200 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
                                        >
                                            <motion.img
                                                initial={{ scale: 0.9 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0.9 }}
                                                src={msg.image_url}
                                                className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                                                alt="zoomed shared file"
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        ) : (
                            renderedContent
                        )}
                    </div>

                    <div className={`text-[10px] mt-1 flex font-mono font-bold items-center gap-1.5 justify-end text-white/60 text-left`}>
                        {msg.is_edited && !msg.is_deleted && (
                            <span className="text-[8px] font-black uppercase tracking-wider text-white/40 italic">(edited)</span>
                        )}
                        {time}
                        {isMe && (
                            <CheckCheck
                                size={14}
                                className={msg.is_read ? "text-blue-400" : "text-white/40"}
                            />
                        )}
                    </div>

                    {/* Reactions Count Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && !msg.is_deleted && (
                        <div className={`absolute bottom-[-10px] ${isMe ? 'left-3' : 'right-3'} flex items-center gap-0.5 bg-[#1f2c34] border border-white/10 rounded-full px-1.5 py-0.5 shadow-md z-30`}>
                            {Array.from(new Set(Object.values(msg.reactions))).slice(0, 3).map((emoji, idx) => (
                                <span key={idx} className="text-[10px]">{emoji as string}</span>
                            ))}
                            <span className="text-[9px] text-white font-black ml-0.5">
                                {Object.keys(msg.reactions).length}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;

