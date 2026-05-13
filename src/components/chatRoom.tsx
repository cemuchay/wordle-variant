import { useEffect, useRef, useState } from "react";
import { type Message } from "../hooks/useChat";
import { MessageSquare, Lock } from "lucide-react";
import type { AppUser } from "../types/game";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

// Sub-components
import ChatHeader from "./chat/ChatHeader";
import ChatMessage from "./chat/ChatMessage";
import MessageInput from "./chat/MessageInput";

const ChatRoom = ({ user, chatData }: { user: AppUser, chatData: any }) => {
    const {
        messages,
        sendMessage,
        typingUsers,
        setTyping,
        markAsRead,
        firstUnreadId,
        users,
        isAtBottom,
        setIsAtBottom
    } = chatData;

    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { signInWithGoogle } = useAuth();

    // Track scroll position to update isAtBottom
    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Use a small threshold (e.g., 50px) to consider "at bottom"
            const atBottom = scrollHeight - scrollTop - clientHeight < 50;
            setIsAtBottom(atBottom);
        }
    };

    // Auto-scroll on mount and new messages
    useEffect(() => {
        if (scrollRef.current && isAtBottom) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: messages.length > 50 ? "auto" : "smooth"
            });
        }
    }, [messages.length, isAtBottom]);

    // Also scroll on typing indicators
    useEffect(() => {
        if (scrollRef.current && isAtBottom) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth"
            });
        }
    }, [typingUsers, isAtBottom]);

    const nameOfUser = user?.user_metadata?.full_name as string;

    const handleTyping = (isTyping: boolean) => {
        if (user && nameOfUser) {
            setTyping(isTyping, nameOfUser);
        }
    };

    const currentUserProfile = users?.find((u: any) => u.id === user?.id);
    const currentUsername = currentUserProfile?.username;

    if (!user) {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="pointer-events-auto flex flex-col h-[85vh] sm:h-[90vh] w-full max-w-lg mx-auto bg-gray-950/40 border border-white/10 rounded-[40px] overflow-hidden backdrop-blur-2xl items-center justify-center p-12 text-center shadow-2xl"
                >
                    <div className="relative mb-8">
                        <motion.div
                            animate={{ rotate: [12, -12, 12] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-xl"
                        >
                            <MessageSquare size={40} className="text-gray-400" />
                        </motion.div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-correct rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,255,0,0.4)] border-4 border-gray-950">
                            <Lock size={18} className="text-black" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-4">Chat restricted</h3>
                    <p className="text-gray-400 text-sm mb-10 max-w-[280px] leading-relaxed">
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
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <div className="pointer-events-auto flex flex-col h-[85vh] sm:h-[90vh] w-full max-w-lg mx-auto bg-gray-950 border border-white/10 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-3xl relative">
                <ChatHeader
                    typingUsers={typingUsers}
                    currentUserName={nameOfUser}
                />

                {/* Message Area */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-hide"
                >
                    <AnimatePresence initial={false}>
                        {messages.map((msg: any) => {
                            const isMe = msg.user_id === user.id;
                            const replyMsg = messages.find((m: any) => m.id === msg.reply_to);
                            const isMentioned = !isMe && currentUsername && msg.content.includes(`@${currentUsername}`);

                            return (
                                <div key={msg.id}>
                                    {msg.id === firstUnreadId && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex items-center my-10 gap-4 px-4"
                                        >
                                            <div className="h-px flex-1 bg-correct/20" />
                                            <span className="text-[10px] font-black text-correct uppercase tracking-[0.3em] bg-correct/10 px-4 py-1.5 rounded-full border border-correct/20 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                                                New Messages
                                            </span>
                                            <div className="h-px flex-1 bg-correct/20" />
                                        </motion.div>
                                    )}
                                    <ChatMessage
                                        msg={msg}
                                        isMe={isMe}
                                        isMentioned={isMentioned}
                                        replyMsg={replyMsg}
                                        onReply={(m) => setReplyingTo(m)}
                                        onMarkAsRead={(id) => markAsRead(id)}
                                        users={users}
                                    />
                                </div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <MessageInput
                    onSend={sendMessage}
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