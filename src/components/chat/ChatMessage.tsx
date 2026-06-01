import { memo, useMemo, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Reply, CheckCheck, Smile, Play, Pause } from "lucide-react";
import type { Message } from "../../hooks/useChat";
import type { JSX } from "react";

interface ChatMessageProps {
    msg: Message;
    isMe: boolean;
    replyMsg?: Message;
    onReply: (msg: Message) => void;
    onMarkAsRead: (id: string) => void;
    users: { username: string; avatar_url: string; id: string }[];
    onReact: (emoji: string | null) => void;
    currentUserId: string;
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
        let nextRate = 1;
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

const ChatMessage = memo(({ msg, isMe, replyMsg, onReply, onMarkAsRead, users, onReact, currentUserId }: ChatMessageProps) => {
    const time = useMemo(() => new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), [msg.created_at]);
    const x = useMotionValue(0);
    const [showReactionsMenu, setShowReactionsMenu] = useState(false);

    // Transform x position to reply icon properties (swipe to right)
    const replyIconOpacity = useTransform(x, [0, 50], [0, 1]);
    const replyIconScale = useTransform(x, [0, 50], [0.5, 1.1]);
    const replyIconTranslateX = useTransform(x, [0, 50], [-20, 12]);

    const senderColor = useMemo(() => {
        const userIndex = users.findIndex(u => u.username === msg.profiles?.username);
        return MENTION_COLORS[userIndex % MENTION_COLORS.length] || '#38bdf8';
    }, [users, msg.profiles?.username]);

    const renderedContent = useMemo(() => {
        const content = msg.content;
        if (!content) return null;
        
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
    }, [msg.content, users, isMe]);

    return (
        <div className="relative group overflow-visible">
            {/* Swipe Reply Indicator */}
            <motion.div
                style={{ opacity: replyIconOpacity, scale: replyIconScale, x: replyIconTranslateX }}
                className="absolute left-0 top-1/2 -translate-y-1/2 text-correct pointer-events-none"
            >
                <Reply size={24} />
            </motion.div>

            <motion.div
                drag="x"
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
                {replyMsg && (
                    <div className={`text-[10px] mb-1.5 flex items-center gap-2 text-white/60 bg-white/5 px-3 py-1.5 rounded-t-xl border-l-2 border-correct/40 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                        <Reply size={10} className="text-correct shrink-0" />
                        <span className="opacity-60 truncate">
                            {replyMsg.profiles?.username}: {replyMsg.content}
                        </span>
                    </div>
                )}

                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Action buttons (Reply & React) */}
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 transition-all bg-black/25 rounded-md px-1 py-0.5 border border-white/5">
                        <button
                            type="button"
                            onClick={() => onReply(msg)}
                            className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                        >
                            <Reply size={13} className="text-correct" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowReactionsMenu(!showReactionsMenu)}
                            className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer relative"
                        >
                            <Smile size={13} className="text-white" />
                        </button>
                    </div>

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
                        <img 
                            src={msg.profiles?.avatar_url} 
                            className="w-4 h-4 rounded-full border border-white/10 cursor-pointer hover:scale-105 transition-transform" 
                            alt="avatar" 
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
                        {msg.voice_url ? (
                            <AudioPlayer url={msg.voice_url} />
                        ) : (
                            renderedContent
                        )}
                    </div>

                    <div className={`text-[10px] mt-1 flex font-mono font-bold items-center gap-1.5 justify-end text-white/60 text-left`}>
                        {time}
                        {isMe && (
                            <CheckCheck
                                size={14}
                                className={msg.is_read ? "text-blue-400" : "text-white/40"}
                            />
                        )}
                    </div>

                    {/* Reactions Count Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
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

