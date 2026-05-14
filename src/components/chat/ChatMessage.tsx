import { motion, useMotionValue, useTransform } from "framer-motion";
import { Reply, CheckCheck } from "lucide-react";
import type { Message } from "../../hooks/useChat";
import type { JSX } from "react";

interface ChatMessageProps {
    msg: Message;
    isMe: boolean;
    replyMsg?: Message;
    onReply: (msg: Message) => void;
    onMarkAsRead: (id: string) => void;
    users: { username: string; avatar_url: string }[];
}

const MENTION_COLORS = ["#4ade80", "#60a5fa", "#f87171", "#fbbf24", "#c084fc", "#22d3ee", "#f472b6", "#fb923c"];

const ChatMessage = ({ msg, isMe, replyMsg, onReply, onMarkAsRead, users }: ChatMessageProps) => {
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const x = useMotionValue(0);

    // Transform x position to reply icon properties
    const replyIconOpacity = useTransform(x, [0, 60], [0, 1]);
    const replyIconScale = useTransform(x, [0, 60], [0.5, 1.1]);
    const replyIconTranslateX = useTransform(x, [0, 60], [-20, 12]);

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const renderContent = (content: string) => {
    if (!content) return null;
    const sortedUsers = [...users].sort((a, b) => b.username.length - a.username.length);
    let parts: (string | JSX.Element)[] = [content];

    // Handle Mentions
    sortedUsers.forEach((user) => {
        const userIndex = users.findIndex(u => u.username === user.username);
        const color = MENTION_COLORS[userIndex % MENTION_COLORS.length];
        const mention = `@${user.username}`;

        const newParts: (string | JSX.Element)[] = [];
        parts.forEach((part) => {
            if (typeof part !== 'string') {
                newParts.push(part);
                return;
            }

            const subParts = part.split(new RegExp(`(${mention}(?:\\s|$))`, 'g'));
            subParts.forEach((subPart) => {
                if (subPart.startsWith(mention)) {
                    const endsWithSpace = subPart.endsWith(' ');
                    const cleanMention = endsWithSpace ? subPart.slice(0, -1) : subPart;

                    newParts.push(
                        <span
                            key={`${user.username}-${Math.random()}`}
                            className={`inline-block px-1.5 py-0.5 rounded-md text-[12px] font-black transition-all`}
                            style={{
                                backgroundColor: `${color}33`,
                                color: isMe ? '#000' : color,
                                border: isMe ? 'none' : `1px solid ${color}20`
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
    parts.forEach((part) => {
        if (typeof part !== 'string') {
            finalParts.push(part);
            return;
        }

        const subParts = part.split(URL_REGEX);
        subParts.forEach((subPart) => {
            if (URL_REGEX.test(subPart)) {
                finalParts.push(
                    <a
                        key={subPart + Math.random()}
                        href={subPart}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`underline break-all transition-colors ${isMe ? 'text-black/80 hover:text-black' : 'text-correct hover:text-correct/80'}`}
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
};

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
                dragConstraints={{ left: 0, right: 0 }}
                dragSnapToOrigin
                dragElastic={0.6}
                style={{ x }}
                onDragEnd={(_, info) => {
                    if (info.offset.x > 80) {
                        onReply(msg);
                    }
                }}
                initial={{ opacity: 0, x: isMe ? 20 : -20, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 cursor-grab active:cursor-grabbing touch-pan-y`}
                onMouseEnter={() => !isMe && !msg.is_read && onMarkAsRead(msg.id)}
            >
                {/* Reply Preview */}
                {replyMsg && (
                    <div className={`text-[10px] mb-1.5 flex items-center gap-2 text-gray-500 bg-white/5 px-3 py-1.5 rounded-t-xl border-l-2 border-correct/40 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                        <Reply size={10} className="text-correct shrink-0" />
                        <span className="opacity-60 truncate">
                            {replyMsg.profiles?.username}: {replyMsg.content}
                        </span>
                    </div>
                )}

                <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <img src={msg.profiles?.avatar_url} className="w-5 h-5 rounded-full border border-white/5" alt="avatar" />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{msg.profiles?.username}</span>

                    {/* More prominent reply button on mobile (visible or prominent) */}
                    <button
                        onClick={() => onReply(msg)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all ml-1"
                    >
                        <Reply size={14} className="text-correct sm:text-gray-400" />
                    </button>
                </div>

                <div className={`relative max-w-[85%] p-3 px-4 shadow-lg transition-all ${isMe
                    ? 'bg-linear-to-br from-correct to-emerald-600 text-black font-semibold rounded-2xl rounded-tr-none'
                    : 'bg-[#202c33] border border-white/5 text-[#e9edef] rounded-2xl rounded-tl-none hover:bg-[#2a3942]'
                    }`}>

                    <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap wrap-break-word">
                        {renderContent(msg.content)}
                    </div>

                    <div className={`text-[11px] mt-1 flex font-mono font-bold items-center gap-1.5 ${isMe ? 'justify-end text-black' : 'justify-end text-[#8696a0]'}`}>
                        {time}
                        {isMe && (
                            <CheckCheck
                                size={16}
                                className={msg.is_read ? "text-blue-500" : "text-gray-400"}
                            />
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ChatMessage;
