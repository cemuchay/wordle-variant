import { useEffect, useRef, useState, useMemo } from "react";
import { useChat, type Message } from "../hooks/useChat";
import { MessageSquare, Lock, ChevronLeft, Plus, Users, User, Trash2, ShieldAlert, Zap } from "lucide-react";
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
    const { setUnreadCount, setIsChallengeOpen } = useApp();
    const { ask } = useConfirmation();
    const {
        groups,
        invites,
        activeRoom,
        activeRoomId,
        setActiveRoomId,
        messages,
        sendMessage,
        sendImageMessage,
        reactToMessage,
        editMessage,
        deleteMessage,
        typingUsers,
        setTyping,
        markAsRead,
        firstUnreadId,
        createCustomGroup,
        acceptInvite,
        declineInvite,
        deleteGroup,
        startDM,
        users,
        hasPlayedToday,
        dailyGuesses
    } = useChat(user?.id);

    const [showSidebar, setShowSidebar] = useState(true);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    
    const [showUnreadLine, setShowUnreadLine] = useState(true);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { signInWithGoogle } = useAuth();

    // Clear unread count when chat is opened
    useEffect(() => {
        if (user?.id) {
            safeLocalStorage.setItem(`lastSeen_${user.id}_${activeRoomId}`, new Date().toISOString());
            setUnreadCount(0);
        }
    }, [user?.id, activeRoomId, setUnreadCount]);

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

    // Auto-scroll on mount and new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: messages.length > 50 ? "auto" : "smooth"
            });
        }
    }, [messages.length, showSidebar]);

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

    // Sorting: Core groups -> DMs -> Regular groups
    const sortedRooms = useMemo(() => {
        const cores = groups.filter(g => g.is_core);
        const dms = groups.filter(g => g.type === "dm");
        const customs = groups.filter(g => g.type === "custom");
        return [...cores, ...dms, ...customs];
    }, [groups]);

    const handleCreateGroupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) {
            alert("Please enter a group name.");
            return;
        }
        if (selectedUsers.length < 2) {
            alert("A group must have at least 3 members. Please select at least 2 users.");
            return;
        }

        const success = await createCustomGroup(newGroupName.trim(), selectedUsers);
        if (success) {
            setNewGroupName("");
            setSelectedUsers([]);
            setIsCreatingGroup(false);
        }
    };

    const toggleSelectUser = (id: string) => {
        setSelectedUsers(prev =>
            prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
        );
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
            {/* Background WhatsApp pattern */}
            <div 
                className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm1-61c3.148 0 5.7-2.552 5.7-5.7 0-3.148-2.552-5.7-5.7-5.7-3.148 0-5.7 2.552-5.7 5.7 0 3.148 2.552 5.7 5.7 5.7zm50 17c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM25 50c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm14 7c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm36-20c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM51 8c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-2 42c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-12-9c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM70 70c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM30 30c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z'/%3E%3C/g%3E%3C/svg%3E")`
                }}
            />

            <AnimatePresence mode="wait">
                {showSidebar ? (
                    // Sidebar view listing groups/DMs/invites
                    <motion.div
                        key="sidebar"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex flex-col h-full z-10"
                    >
                        {/* Sidebar Header */}
                        <div className="p-6 border-b border-white/5 bg-[#1f2c34] flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                                <MessageSquare className="text-correct" size={20} /> Messages
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsCreatingGroup(true)}
                                    className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all"
                                    title="Create Group"
                                >
                                    <Plus size={16} className="text-white" />
                                </button>
                                {onClose && (
                                    <button
                                        onClick={onClose}
                                        className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all"
                                    >
                                        <ChevronLeft size={16} className="text-white" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Rooms & Invites list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Invites Section */}
                            {invites.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-black uppercase text-amber-400 tracking-widest pl-2">Group Invites ({invites.length})</h3>
                                    {invites.map(invite => (
                                        <div key={invite.id} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-bold text-white">{invite.name}</span>
                                                <span className="text-[9px] text-white/60">by {invite.creator}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => declineInvite(invite.id)}
                                                    className="px-2.5 py-1 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-lg text-[9px] font-black uppercase text-red-400 cursor-pointer"
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    onClick={() => acceptInvite(invite.id)}
                                                    className="px-2.5 py-1 bg-correct text-black font-black rounded-lg text-[9px] uppercase cursor-pointer"
                                                >
                                                    Join
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Chat Rooms Section */}
                            <div className="space-y-1">
                                <h3 className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2 mb-2">Chats & Groups</h3>
                                {sortedRooms.map(room => {
                                    const isActive = activeRoomId === room.id;
                                    return (
                                        <button
                                            key={room.id}
                                            onClick={() => {
                                                setActiveRoomId(room.id);
                                                setShowSidebar(false);
                                            }}
                                            className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all ${isActive ? 'bg-[#005c4b]/30 border border-correct/30 shadow-[0_0_15px_rgba(0,255,0,0.05)]' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${room.is_core ? 'bg-correct text-black font-black' : room.type === 'dm' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-white'}`}>
                                                    {room.is_core ? "#" : room.type === 'dm' ? <User size={18} /> : <Users size={18} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-white tracking-tight">{room.name}</span>
                                                    <span className="text-[9px] text-white/50 uppercase tracking-widest mt-0.5">
                                                        {room.type === 'dm' ? 'Direct Message' : room.type === 'custom' ? 'Group Chat' : 'Core Channel'}
                                                    </span>
                                                </div>
                                            </div>
                                            {room.type === 'dm' && <span title="End-to-End Encrypted"><Lock size={12} className="text-white/30" /></span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* DM directory selector */}
                            <div className="pt-2">
                                <h3 className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2 mb-2">Start a DM</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {users.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={async () => {
                                                const id = await startDM(u.id);
                                                if (id) setShowSidebar(false);
                                            }}
                                            className="p-2.5 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-2 truncate cursor-pointer transition-all"
                                        >
                                            <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}`} className="w-5 h-5 rounded-full border border-white/10" alt="avatar" />
                                            <span className="text-[10.5px] font-bold text-white truncate">{u.username}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Group Creation Popup Panel */}
                        <AnimatePresence>
                            {isCreatingGroup && (
                                <motion.div
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 50 }}
                                    className="absolute inset-0 bg-[#0b141a] z-50 p-6 flex flex-col justify-between"
                                >
                                    <div className="space-y-6 flex-1 overflow-y-auto">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-black uppercase tracking-wider text-white">Create Group</h3>
                                            <button onClick={() => setIsCreatingGroup(false)} className="text-white/60 hover:text-white text-xs font-black uppercase">Cancel</button>
                                        </div>

                                        <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Group Name</label>
                                                <input
                                                    type="text"
                                                    value={newGroupName}
                                                    onChange={e => setNewGroupName(e.target.value)}
                                                    placeholder="Type name..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-correct"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Select Users (at least 2)</label>
                                                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                                                    {users.map(u => {
                                                        const isSelected = selectedUsers.includes(u.id);
                                                        return (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                onClick={() => toggleSelectUser(u.id)}
                                                                className={`p-2.5 border rounded-xl text-left flex items-center gap-2 truncate cursor-pointer transition-all ${isSelected ? 'bg-correct border-correct text-black' : 'bg-white/5 border-white/5 text-white hover:bg-white/10'}`}
                                                            >
                                                                <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}`} className="w-5 h-5 rounded-full border border-white/10" alt="avatar" />
                                                                <span className="text-[10.5px] font-bold truncate">{u.username}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                className="w-full py-4 bg-correct hover:brightness-110 text-black font-black uppercase tracking-[0.2em] rounded-xl text-xs cursor-pointer shadow-lg shadow-correct/10 transition-all"
                                            >
                                                Create Group
                                            </button>
                                        </form>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    // Active chat view
                    <motion.div
                        key="chat"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex flex-col h-full z-10 relative"
                    >
                        {/* Custom header overrides within ChatHeader */}
                        <div className="shrink-0 relative">
                            {/* Back to sidebar controls */}
                            <div className="absolute top-1/2 left-3 -translate-y-1/2 z-30 flex items-center">
                                <button
                                    onClick={() => setShowSidebar(true)}
                                    className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-white cursor-pointer transition-all"
                                    title="Back to Chats"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                            </div>

                            <ChatHeader
                                typingUsers={typingUsers}
                                currentUserName={nameOfUser}
                            />
                        </div>

                        {/* Top Group actions toolbar */}
                        {activeRoom && (
                            <div className="px-6 py-2.5 bg-black/40 border-b border-white/5 flex justify-between items-center shrink-0">
                                <span className="text-[9.5px] font-black uppercase tracking-wider text-correct flex items-center gap-1.5">
                                    <Zap size={10} /> Active: {activeRoom.name}
                                    {activeRoom.type === "dm" && <span className="text-white/40">(E2EE Encrypted)</span>}
                                    {activeRoom.is_core && activeRoom.type !== "bugs_features" && <span className="text-amber-400 font-bold">(Auto-Purges Daily)</span>}
                                </span>
                                <div className="flex gap-2">
                                    {/* Create Challenge from chats button */}
                                    {(activeRoom.type === "dm" || activeRoom.type === "custom") && (
                                        <button
                                            onClick={() => {
                                                if (onClose) onClose();
                                                setIsChallengeOpen(true);
                                            }}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9px] font-black uppercase text-white cursor-pointer flex items-center gap-1 shadow-lg shadow-indigo-600/10 transition-all border border-indigo-400/20"
                                            title="Create Challenge"
                                        >
                                            🏆 Challenge
                                        </button>
                                    )}
                                    {/* Delete group action */}
                                    {activeRoom.type === "custom" && activeRoom.created_by === user.id && (
                                        <button
                                            onClick={async () => {
                                                const confirmed = await ask({
                                                    title: "Delete Group",
                                                    message: `Are you sure you want to delete "${activeRoom.name}"? This action cannot be undone.`,
                                                    confirmLabel: "Delete Group",
                                                    cancelLabel: "Cancel",
                                                    type: "danger"
                                                });
                                                if (confirmed) {
                                                    await deleteGroup(activeRoom.id);
                                                    setShowSidebar(true);
                                                }
                                            }}
                                            className="p-1 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-500/20"
                                            title="Delete Group"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Game Analysis lock validation */}
                        {activeRoom && activeRoom.type === "game_analysis" && !hasPlayedToday ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-950/40 backdrop-blur-xs">
                                <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mb-4 animate-pulse">
                                    <ShieldAlert size={28} />
                                </div>
                                <h4 className="text-base font-black uppercase text-white tracking-tight mb-2">Analysis Room Locked</h4>
                                <p className="text-white/60 text-xs leading-relaxed max-w-[260px]">
                                    Complete today's daily puzzle first to unlock this discussion and view daily stats and player guess breakdowns!
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Message Area */}
                                <div
                                    ref={scrollRef}
                                    onScroll={handleScroll}
                                    className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-hide z-10"
                                >
                                    <AnimatePresence initial={false}>
                                        {messages.map((msg: any) => {
                                            const isMe = msg.user_id === user.id;
                                            const replyMsg = messages.find((m: any) => m.id === msg.reply_to);

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
                                                        dailyGuesses={dailyGuesses}
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
                                        onSendVoice={null as any} // Simplify voice out for now
                                        onSendImage={sendImageMessage}
                                        onTyping={handleTyping}
                                        replyingTo={replyingTo}
                                        onCancelReply={() => setReplyingTo(null)}
                                        users={users}
                                        isGameAnalysis={!!(activeRoom && activeRoom.type === "game_analysis")}
                                        dailyGuesses={dailyGuesses}
                                    />
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatRoom;