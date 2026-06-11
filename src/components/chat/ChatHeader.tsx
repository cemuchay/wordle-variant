import { motion, AnimatePresence } from "framer-motion";
import { AudioChatControls } from "../challenge/AudioChatControls";
import { useApp } from "../../context/AppContext";
import { X, Search, Trash2, Zap, } from "lucide-react";
import type { ChatGroup } from "../../hooks/useChat";

interface ChatHeaderProps {
    typingUsers: string[];
    currentUserName?: string;
    onClose?: () => void;
    activeRoom?: ChatGroup | null;
    onToggleSearch?: () => void;
    showSearchIcon?: boolean;
    onChallenge?: () => void;
    onDeleteGroup?: () => void;
}

const ChatHeader = ({
    typingUsers,
    currentUserName,
    onClose,
    activeRoom,
    onToggleSearch,
    showSearchIcon,
    onChallenge,
    onDeleteGroup
}: ChatHeaderProps) => {
    const { profile, } = useApp();

    // Filter out the current user from typing indicators
    const otherTypingUsers = typingUsers.filter(name => name !== currentUserName);

    return (
        <div className={` p-3 sm:p-5 border-b border-white/5 bg-[#1f2c34] flex justify-between items-center backdrop-blur-md`}>
            <div className="flex items-center gap-4">
                <div className="relative ms-10 sm:ms-8">

                </div>
                <div>
                    <h4 className="text-[10px] sm:text-sm font-black uppercase tracking-widest text-white flex items-center gap-1.5">
                        {activeRoom ? (
                            <>
                                <Zap size={12} className="text-correct" />
                                {activeRoom.name}
                            </>
                        ) : "Chat (24h)"}
                    </h4>
                    <div className="h-4 flex items-center">
                        <AnimatePresence mode="wait">
                            {otherTypingUsers.length > 0 ? (
                                <motion.p
                                    key="typing"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-[7px] sm:text-[10px] text-correct font-bold uppercase flex items-center gap-1"
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
                                    className="text-[8px] sm:text-[10px] text-white/60 font-bold uppercase tracking-widest flex items-center gap-1.5"
                                >
                                    {activeRoom?.is_core && activeRoom.type !== "bugs_features" ? (
                                        <span className="text-amber-400 font-bold">(24h)</span>
                                    ) : activeRoom?.type === "dm" ? (
                                        null
                                    ) : (
                                        "Live Now"
                                    )}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
                {showSearchIcon && onToggleSearch && (
                    <button
                        onClick={onToggleSearch}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                        title="Search in conversation"
                    >
                        <Search size={16} />
                    </button>
                )}

                {onChallenge && (
                    <button
                        onClick={onChallenge}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] sm:text-[11px] font-black uppercase text-white cursor-pointer flex items-center gap-1 shadow-lg shadow-indigo-600/10 transition-all border border-indigo-400/20"
                        title="Create Challenge"
                    >
                        🏆
                    </button>
                )}

                {onDeleteGroup && (
                    <button
                        onClick={onDeleteGroup}
                        className="p-1.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-500/20"
                        title="Delete Group"
                    >
                        <Trash2 size={16} />
                    </button>
                )}

                <div className="w-px h-4 bg-white/10 mx-1" />

                {profile && (
                    <AudioChatControls
                        challengeId={activeRoom?.id || "global"}
                        userId={profile.id}
                    />
                )}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 text-white/60 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                        title="Close Chat"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChatHeader;
