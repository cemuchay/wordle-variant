import { motion, AnimatePresence } from "framer-motion";

interface ChatHeaderProps {
    typingUsers: string[];
    currentUserName?: string;
}

const ChatHeader = ({ typingUsers, currentUserName }: ChatHeaderProps) => {
    // Filter out the current user from typing indicators
    const otherTypingUsers = typingUsers.filter(name => name !== currentUserName);

    return (
        <div className="p-5 border-b border-white/5 bg-white/5 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-correct to-emerald-400 flex items-center justify-center text-black shadow-lg shadow-correct/20">
                        <span className="font-black text-sm">#</span>
                    </div>
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-correct border-2 border-gray-950 rounded-full"
                    />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Wordle ChatRoom (24h)</h3>
                    <div className="h-4 flex items-center">
                        <AnimatePresence mode="wait">
                            {otherTypingUsers.length > 0 ? (
                                <motion.p
                                    key="typing"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-[10px] text-correct font-bold uppercase flex items-center gap-1"
                                >
                                    <span className="flex gap-0.5">
                                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1 h-1 bg-correct rounded-full" />
                                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-correct rounded-full" />
                                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-correct rounded-full" />
                                    </span>
                                    {otherTypingUsers.join(", ")} is typing...
                                </motion.p>
                            ) : (
                                <motion.p
                                    key="live"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-[9px] text-gray-500 font-bold uppercase tracking-widest"
                                >
                                    Live Now
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatHeader;
