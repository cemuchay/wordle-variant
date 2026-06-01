import { useEffect, useRef, useState } from "react";
import { useChat, type Message } from "../hooks/useChat";
import { MessageSquare, Lock } from "lucide-react";
import type { AppUser } from "../types/game";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import { safeLocalStorage } from "../utils/storage";
import { useConfirmation } from "../hooks/useConfirmation";

// Sub-components
import ChatHeader from "./chat/ChatHeader";
import ChatMessage from "./chat/ChatMessage";
import MessageInput from "./chat/MessageInput";

const ChatRoom = ({ user, onClose }: { user: AppUser; onClose?: () => void }) => {
    const { setUnreadCount } = useApp();
    const { ask } = useConfirmation();
    const {
        messages,
        sendMessage,
        reactToMessage,
        sendVoiceMessage,
        editMessage,
        deleteMessage,
        typingUsers,
        setTyping,
        markAsRead,
        firstUnreadId,
        users
    } = useChat(user?.id);

    const [showUnreadLine, setShowUnreadLine] = useState(true);

    // Clear unread count when chat is opened
    useEffect(() => {
        if (user?.id) {
            safeLocalStorage.setItem(`lastSeen_${user.id}`, new Date().toISOString());
            setUnreadCount(0);
        }
    }, [user?.id, setUnreadCount]);

    useEffect(() => {
        if (firstUnreadId) {
            setShowUnreadLine(true);
            const timer = setTimeout(() => {
                setShowUnreadLine(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [firstUnreadId]);

    const handleScroll = () => {
        if (showUnreadLine) {
            setShowUnreadLine(false);
        }
    };

    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { signInWithGoogle } = useAuth();

    // Auto-scroll on mount and new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: messages.length > 50 ? "auto" : "smooth" // Use auto for initial jump
            });
        }
    }, [messages.length]); // Scroll when message count changes

    // Also scroll on typing indicators
    useEffect(() => {
        if (scrollRef.current) {
            const isAtBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop <= scrollRef.current.clientHeight + 150;
            if (isAtBottom) {
                scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth"
                });
            }
        }
    }, [typingUsers]);

    const nameOfUser = user?.user_metadata?.full_name as string;

    const handleTyping = (isTyping: boolean) => {
        if (user && nameOfUser) {
            setTyping(isTyping, nameOfUser);
        }
    };

    if (!user) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col h-screen w-full max-w-lg mx-auto bg-[#0b141a] border border-[#22303c] rounded-[40px] overflow-hidden backdrop-blur-2xl items-center justify-center p-12 text-center shadow-2xl"
            >
                <div className="relative mb-8">
                    <motion.div
                        animate={{ rotate: [12, -12, 12] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-xl"
                    >
                        <MessageSquare size={40} className="text-white" />
                    </motion.div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-correct rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,255,0,0.4)] border-4 border-gray-950">
                        <Lock size={18} className="text-black" />
                    </div>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-4">Chat restricted</h3>
                <p className="text-white/80 text-sm mb-10 max-w-[280px] leading-relaxed">
                    Join the community to discuss strategies and share your daily wins.
                </p>
                <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: "#00ff00" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={signInWithGoogle}
                    className="w-full bg-white text-black py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-colors"
                >
                    Login with Google
                </motion.button>
            </motion.div>
        );
    }

    return (
        <div 
            className="flex flex-col h-[92vh] w-full max-w-lg mx-auto bg-[#0b141a] border border-white/10 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative"
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        >
            {/* Background WhatsApp classic tile pattern overlay */}
            <div 
                className="absolute inset-0 opacity-[0.06] pointer-events-none" 
                style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm1-61c3.148 0 5.7-2.552 5.7-5.7 0-3.148-2.552-5.7-5.7-5.7-3.148 0-5.7 2.552-5.7 5.7 0 3.148 2.552 5.7 5.7 5.7zm50 17c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM25 50c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm14 7c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm36-20c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM51 8c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-2 42c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-12-9c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM70 70c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM30 30c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z'/%3E%3C/g%3E%3C/svg%3E")` 
                }}
            />

            <ChatHeader
                typingUsers={typingUsers}
                currentUserName={nameOfUser}
                onClose={onClose}
            />

            {/* Message Area */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-hide z-10"
            >
                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        const isMe = msg.user_id === user.id;
                        const replyMsg = messages.find(m => m.id === msg.reply_to);

                        return (
                            <div key={msg.id}>
                                {msg.id === firstUnreadId && showUnreadLine && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center my-6 gap-4 px-4"
                                    >
                                        <div className="h-px flex-1 bg-white/20" />
                                        <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] bg-white/10 px-4 py-1.5 rounded-full border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            Unread Messages
                                        </span>
                                        <div className="h-px flex-1 bg-white/20" />
                                    </motion.div>
                                )}
                                <ChatMessage
                                    msg={msg}
                                    isMe={isMe}
                                    replyMsg={replyMsg}
                                    onReply={(m) => setReplyingTo(m)}
                                    onMarkAsRead={(id) => markAsRead(id)}
                                    users={users}
                                    onReact={(emoji) => reactToMessage(msg.id, emoji)}
                                    currentUserId={user.id}
                                    onEdit={(newContent) => editMessage(msg.id, newContent)}
                                    onDelete={async () => {
                                        const confirmed = await ask({
                                            title: "Delete Message",
                                            message: "Are you sure you want to delete this message? This action cannot be undone.",
                                            confirmLabel: "Delete",
                                            cancelLabel: "Cancel",
                                            type: "danger"
                                        });
                                        if (confirmed) {
                                            await deleteMessage(msg.id);
                                        }
                                    }}
                                />
                            </div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="z-10">
                <MessageInput
                    onSend={sendMessage}
                    onSendVoice={sendVoiceMessage}
                    onTyping={handleTyping}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                    users={users}
                />
            </div>
        </div>
    );
};

export default ChatRoom;