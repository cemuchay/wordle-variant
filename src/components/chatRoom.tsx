/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useChat, type Message, getDMRoomKey, decryptDM } from "../hooks/useChat";
import { MessageSquare, Lock, ChevronLeft, Plus, Users, User, ShieldAlert, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import type { AppUser } from "../types/game";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import { useConfirmation } from "../hooks/useConfirmation";
import { useAppStore } from "../store/useAppStore";

// Sub-components
import ChatHeader from "./chat/ChatHeader";
import ChatMessage from "./chat/ChatMessage";
import MessageInput from "./chat/MessageInput";
import formatLastSeen from "../utils/formatLastSeen";
import { ProtectedAvatar } from "./chat/ProtectedAvatar";

const ChatRoom = ({ user, onClose }: { user: AppUser; onClose?: () => void }) => {
    const { setIsChallengeOpen, allProfiles, isDynamicIslandVisible, } = useApp();
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
        sendVoiceMessage,
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
        dailyGuesses,
        resendMessage
    } = useChat(user?.id);

    const globalMessages = useAppStore((state) => state.globalMessages);
    const readReceipts = useAppStore((state) => state.readReceipts);

    const setChatConversationOpen = useAppStore(s => s.setChatConversationOpen);
    const pendingDMUserId = useAppStore(s => s.pendingDMUserId);
    const setPendingDMUserId = useAppStore(s => s.setPendingDMUserId);
    const pendingChatGroupId = useAppStore(s => s.pendingChatGroupId);
    const setPendingChatGroupId = useAppStore(s => s.setPendingChatGroupId);
    const setPendingChallengeUserId = useAppStore(s => s.setPendingChallengeUserId);

    const [showSidebar, setShowSidebar] = useState(true);
    const [isStartingDM, setIsStartingDM] = useState(false);

    // Sync conversation state to store so App.tsx can hide navigation
    useEffect(() => {
        setChatConversationOpen(!showSidebar);
    }, [showSidebar, setChatConversationOpen]);

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isCreatingDM, setIsCreatingDM] = useState(false);
    const [dmSearchQuery, setDmSearchQuery] = useState("");
    const [chatSearchQuery, setChatSearchQuery] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

    const [showUnreadLine, setShowUnreadLine] = useState(true);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Conversation search state
    const [showConversationSearch, setShowConversationSearch] = useState(false);
    const [conversationSearchQuery, setConversationSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ index: number; id: string; preview: string }[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom button visibility
    const [showScrollDown, setShowScrollDown] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Scroll to a specific message by ID
    const scrollToMessage = useCallback((messageId: string) => {
        const el = document.querySelector(`[data-message-id="${messageId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-correct', 'rounded-2xl');
            setTimeout(() => {
                el.classList.remove('ring-2', 'ring-correct', 'rounded-2xl');
            }, 2000);
        }
    }, []);

    // Search messages in current conversation
    useEffect(() => {
        if (!conversationSearchQuery.trim()) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSearchResults([]);
            return;
        }
        const q = conversationSearchQuery.toLowerCase();
        const results = messages
            .map((msg: any, index: number) => ({
                index,
                id: msg.id,
                preview: (msg.content || '').slice(0, 60)
            }))
            .filter(r => r.preview.toLowerCase().includes(q));
        setSearchResults(results);
        setCurrentSearchIndex(0);
        if (results.length > 0) {
            scrollToMessage(results[0].id);
        }
    }, [conversationSearchQuery, messages, scrollToMessage]);

    const navigateSearch = useCallback((direction: 'next' | 'prev') => {
        if (searchResults.length === 0) return;
        const newIndex = direction === 'next'
            ? (currentSearchIndex + 1) % searchResults.length
            : (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentSearchIndex(newIndex);
        scrollToMessage(searchResults[newIndex].id);
    }, [searchResults, currentSearchIndex, scrollToMessage]);

    const { signInWithGoogle } = useAuth();



    useEffect(() => {
        if (firstUnreadId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowUnreadLine(true);
            const timer = setTimeout(() => {
                setShowUnreadLine(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [firstUnreadId]);

    // Handle pending DM from Store
    useEffect(() => {
        const initDM = async () => {
            if (pendingDMUserId) {
                setIsStartingDM(true);
                try {
                    await startDM(pendingDMUserId);
                    setShowSidebar(false);
                } finally {
                    setIsStartingDM(false);
                    setPendingDMUserId(null);
                }
            }
        };
        initDM();
    }, [pendingDMUserId, startDM, setPendingDMUserId]);

    // Handle pending group selection (e.g. from push notifications routing)
    useEffect(() => {
        if (pendingChatGroupId && groups.length > 0) {
            const groupExists = groups.some(g => g.id === pendingChatGroupId);
            if (groupExists) {
                setActiveRoomId(pendingChatGroupId);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setShowSidebar(false);
                setPendingChatGroupId(null);
            }
        }
    }, [pendingChatGroupId, groups, setActiveRoomId, setPendingChatGroupId]);

    const handleScroll = () => {
        if (showUnreadLine) {
            setShowUnreadLine(false);
        }
        // Show scroll-down button when scrolled up more than 300px from bottom
        if (scrollNode) {
            const isAtBottom = scrollNode.scrollHeight - scrollNode.scrollTop <= scrollNode.clientHeight + 250;
            setShowScrollDown(!isAtBottom);
        }
    };

    const lastRoomIdRef = useRef<string | null>(null);

    // Handle scrolling when entering a room or toggling sidebar (once messages are loaded)
    useEffect(() => {
        if (showSidebar) {
            lastRoomIdRef.current = null;
            return;
        }

        if (activeRoomId && lastRoomIdRef.current !== activeRoomId) {
            const timer = setTimeout(() => {
                const unreadEl = document.getElementById("unread-line");
                if (unreadEl && showUnreadLine) {
                    unreadEl.scrollIntoView({ behavior: "auto", block: "center" });
                } else {
                    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
                }

                // Only mark as scrolled if messages have been populated
                if (messages.length > 0) {
                    lastRoomIdRef.current = activeRoomId;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeRoomId, showSidebar, messages.length, showUnreadLine]);

    // Handle scroll to bottom on new incoming messages or typing changes only if already at the bottom
    useEffect(() => {
        // Check scrollNode instead of scrollRef.current
        if (lastRoomIdRef.current === activeRoomId && scrollNode) {
            const isAtBottom = scrollNode.scrollHeight - scrollNode.scrollTop <= scrollNode.clientHeight + 250;

            if (isAtBottom) {
                // Using requestAnimationFrame ensures the DOM has updated and rendered 
                // the new message before we attempt to smoothly scroll past it
                requestAnimationFrame(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                });
            }
        }
    }, [messages.length, activeRoomId, typingUsers, scrollNode]);

    // Triggers the exact millisecond the DOM element is painted and available
    useEffect(() => {
        if (showSidebar || !activeRoomId || messages.length === 0 || firstUnreadId || !scrollNode) {
            return;
        }

        // Immediate scroll to bottom now that the node is alive
        scrollNode.scrollTo({ top: scrollNode.scrollHeight });

        // Handle Framer Motion transition scaling
        const resizeObserver = new ResizeObserver(() => {
            scrollNode.scrollTo({ top: scrollNode.scrollHeight });
        });

        resizeObserver.observe(scrollNode);
        const timer = setTimeout(() => resizeObserver.disconnect(), 400);

        return () => {
            resizeObserver.disconnect();
            clearTimeout(timer);
        };
    }, [activeRoomId, showSidebar, messages.length, firstUnreadId, scrollNode]); // <-- Watches the element directly

    const nameOfUser = user?.user_metadata?.full_name as string;

    const handleTyping = (isTyping: boolean) => {
        if (user && nameOfUser) {
            setTyping(isTyping, nameOfUser);
        }
    };

    const lastMessages = useMemo(() => {
        const map: Record<string, any> = {};
        globalMessages.forEach((m) => {
            const existing = map[m.group_id];
            if (!existing || new Date(m.created_at) > new Date(existing.created_at)) {
                map[m.group_id] = m;
            }
        });
        return map;
    }, [globalMessages]);

    const unreadCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        globalMessages.forEach((m) => {
            if (m.user_id !== user?.id) {
                // Game Analysis is locked if user hasn't played today
                if (m.group_id === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday) return;

                const lastSeen = readReceipts[m.group_id] || new Date(0).toISOString();
                if (new Date(m.created_at).getTime() > new Date(lastSeen).getTime()) {
                    counts[m.group_id] = (counts[m.group_id] || 0) + 1;
                }
            }
        });
        return counts;
    }, [globalMessages, readReceipts, user?.id, hasPlayedToday]);

    const sortRooms = (rooms: any[]) => {
        return [...rooms].sort((a, b) => {
            const aUnread = unreadCounts[a.id] || 0;
            const bUnread = unreadCounts[b.id] || 0;
            if (aUnread > 0 && bUnread === 0) return -1;
            if (bUnread > 0 && aUnread === 0) return 1;

            const aLastMsg = lastMessages[a.id];
            const bLastMsg = lastMessages[b.id];
            const aTime = aLastMsg ? new Date(aLastMsg.created_at).getTime() : 0;
            const bTime = bLastMsg ? new Date(bLastMsg.created_at).getTime() : 0;
            return bTime - aTime;
        });
    };

    // Unified chats list sorted by unread first, then latest message timestamp
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const sortedAllRooms = useMemo(() => sortRooms(groups), [groups, unreadCounts, lastMessages]);

    // Filtered chats list based on search query
    const filteredAllRooms = useMemo(() => {
        if (!chatSearchQuery.trim()) return sortedAllRooms;
        const q = chatSearchQuery.toLowerCase();
        return sortedAllRooms.filter(room =>
            room.name.toLowerCase().includes(q)
        );
    }, [sortedAllRooms, chatSearchQuery]);

    // Calculate unread messages in other rooms
    const otherUnreadCount = useMemo(() => {
        let total = 0;
        Object.entries(unreadCounts).forEach(([roomId, count]) => {
            if (roomId !== activeRoomId) {
                total += count;
            }
        });
        return total;
    }, [unreadCounts, activeRoomId]);

    const filteredDMSearchUsers = useMemo(() => {
        if (!dmSearchQuery.trim()) return users;
        const q = dmSearchQuery.toLowerCase();
        return users.filter(u =>
            u.username.toLowerCase().includes(q)
        );
    }, [users, dmSearchQuery]);


    const renderLastMessage = (room: any) => {
        if (room.type === "game_analysis" && !hasPlayedToday) {
            return <span className="text-[10px] text-white/30 italic flex items-center gap-1">🔒 Play daily to unlock analysis</span>;
        }

        const lastMsg = lastMessages[room.id];
        if (!lastMsg) return <span className="text-[10px] text-white/30 italic">No messages yet</span>;

        if (lastMsg.is_deleted) {
            return <span className="text-[10px] text-white/30 italic flex items-center gap-1">🚫 Message deleted</span>;
        }
        if (lastMsg.image_url) {
            return <span className="text-[10px] text-correct font-semibold flex items-center gap-1">📷 Photo</span>;
        }
        if (lastMsg.voice_url) {
            return <span className="text-[10px] text-correct font-semibold flex items-center gap-1">🎤 Voice note</span>;
        }

        let text = lastMsg.content || "";
        if (room.type === "dm" && room.dm_partner && text.startsWith("e2ee:")) {
            const key = getDMRoomKey(user.id, room.dm_partner.id);
            text = decryptDM(text, key);
        }

        // Clean Guess tags
        if (text.startsWith("[guess:")) {
            text = "🎯 Shared guess board";
        }

        const sender = lastMsg.user_id === user.id ? "You" : lastMsg.profiles?.username || "";
        const prefix = sender ? `${sender}: ` : "";
        const truncated = text.length > 25 ? text.slice(0, 25) + "..." : text;
        return (
            <span className="text-[12px] text-white/80 truncate max-w-50 mt-0.5 block">
                {prefix}{truncated}
            </span>
        );
    };

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
                <p className="text-white/80 text-sm mb-10 max-w-70 leading-relaxed">
                    Join the community to discuss strategies and share your daily wins.
                </p>
                <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: "#00ff00" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={signInWithGoogle}
                    className="w-full bg-white text-black py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-colors"
                >
                    Login with Google
                </motion.button>
            </motion.div>
        );
    }

    return (
        <div
            className={`flex flex-col w-full max-w-lg mx-auto bg-[#0b141a] border border-white/10 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative h-[92vh] max-h-[92vh]`}
            style={{
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            }}
        >
            {/* DM Loading Overlay */}
            <AnimatePresence>
                {isStartingDM && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-100 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4"
                    >
                        <div className="w-12 h-12 border-4 border-correct border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(0,255,0,0.2)]" />
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Opening Chat</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Securing Connection...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <div className={`p-6 border-b border-white/5 bg-[#1f2c34] flex justify-between items-center shrink-0 transition-all ${isDynamicIslandVisible ? 'mt-7 sm:mt-9' : ''}`}>
                            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                                <MessageSquare className="text-correct" size={20} /> Messages
                            </h2>
                            <div className="flex gap-2">
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

                        {/* Chat Search Box */}
                        <div className="px-6 py-3 border-b border-white/5 shrink-0 bg-[#0b141a]/60">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={chatSearchQuery}
                                    onChange={(e) => setChatSearchQuery(e.target.value)}
                                    placeholder="Search chats..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/30 outline-none focus:border-correct transition-all"
                                />
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                            </div>
                        </div>

                        {/* Rooms & Invites list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
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

                            {/* Merged Chats Section */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between pl-2 mb-2">
                                    <h3 className="text-[10px] font-black uppercase text-white/40 tracking-widest">Chats</h3>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setIsCreatingDM(true)}
                                            className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all"
                                            title="Start DM"
                                        >
                                            <Plus size={14} className="text-white" />
                                        </button>
                                        <button
                                            onClick={() => setIsCreatingGroup(true)}
                                            className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all"
                                            title="Create Group"
                                        >
                                            <Users size={14} className="text-white" />
                                        </button>
                                    </div>
                                </div>
                                {filteredAllRooms.length === 0 ? (
                                    <div className="text-[10px] text-white/30 pl-2 py-2 italic bg-white/2 rounded-xl border border-white/5 text-center">
                                        {chatSearchQuery ? "No matching chats found." : "No chats yet."}
                                    </div>
                                ) : (
                                    filteredAllRooms.map(room => {
                                        const isActive = activeRoomId === room.id;
                                        const unreadCount = unreadCounts[room.id] || 0;

                                        let icon;
                                        if (room.is_core) {
                                            icon = (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-correct text-black font-black shrink-0">
                                                    #
                                                </div>
                                            );
                                        } else if (room.type === "dm") {
                                            icon = (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/20 text-indigo-300 shrink-0">
                                                    <User size={18} />
                                                </div>
                                            );
                                        } else {
                                            icon = (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white shrink-0">
                                                    <Users size={18} />
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                key={room.id}
                                                onClick={() => {
                                                    setActiveRoomId(room.id);
                                                    setShowSidebar(false);
                                                }}
                                                className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all ${isActive ? 'bg-[#005c4b]/30 border border-correct/30 shadow-[0_0_15px_rgba(0,255,0,0.05)]' : unreadCount > 0 ? 'bg-correct/10 border border-correct/30' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {icon}
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className={`text-sm font-bold tracking-tight truncate ${room.is_core ? 'uppercase' : ''} ${unreadCount > 0 ? 'text-correct' : 'text-white'}`}>{room.name}</span>
                                                        {renderLastMessage(room)}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        {lastMessages[room.id] && (
                                                            <span className="text-[9px] text-white/40">
                                                                {formatLastSeen(lastMessages[room.id].created_at)}
                                                            </span>
                                                        )}
                                                        {unreadCount > 0 && (
                                                            <div className="w-5 h-5 rounded-full bg-correct flex items-center justify-center text-[10px] font-black text-black shrink-0">
                                                                {unreadCount > 99 ? '99+' : unreadCount}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Sliding overlay panel for Starting DM */}
                        <AnimatePresence>
                            {isCreatingDM && (
                                <motion.div
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 50 }}
                                    className="absolute inset-0 bg-[#0b141a] z-50 p-6 flex flex-col justify-between"
                                >
                                    <div className="space-y-6 flex-1 overflow-y-auto">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-black uppercase tracking-wider text-white">Start a DM</h3>
                                            <button
                                                onClick={() => {
                                                    setIsCreatingDM(false);
                                                    setDmSearchQuery("");
                                                }}
                                                className="text-white/60 hover:text-white text-xs font-black uppercase"
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                value={dmSearchQuery}
                                                onChange={e => setDmSearchQuery(e.target.value)}
                                                placeholder="Search users by name..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 outline-none focus:border-correct transition-all"
                                            />

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Select User</label>
                                                <div className="grid grid-cols-1 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                                                    {filteredDMSearchUsers.length === 0 ? (
                                                        <div className="text-xs text-white/40 py-4 text-center">No users match your search.</div>
                                                    ) : (
                                                        filteredDMSearchUsers.map(u => (
                                                            <button
                                                                key={u.id}
                                                                onClick={async () => {
                                                                    setIsStartingDM(true);
                                                                    try {
                                                                        const id = await startDM(u.id);
                                                                        setIsCreatingDM(false);
                                                                        setDmSearchQuery("");
                                                                        if (id) {
                                                                            setActiveRoomId(id);
                                                                            setShowSidebar(false);
                                                                        }
                                                                    } finally {
                                                                        setIsStartingDM(false);
                                                                    }
                                                                }}
                                                                className="p-3 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 cursor-pointer transition-all"
                                                            >
                                                                <ProtectedAvatar
                                                                    userId={u.id}
                                                                    src={u.avatar_url}
                                                                    username={u.username}
                                                                    className="w-8 h-8 rounded-full border border-white/10"
                                                                />
                                                                <span className="text-sm font-bold text-white">{u.username}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

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
                                                                <ProtectedAvatar
                                                                    userId={u.id}
                                                                    src={u.avatar_url}
                                                                    username={u.username}
                                                                    className="w-5 h-5 rounded-full border border-white/10"
                                                                />
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
                        <div className={`shrink-0 relative transition-all ${isDynamicIslandVisible ? 'mt-7 sm:mt-9' : ''}`}>
                            {/* Back to sidebar controls */}
                            <div className="absolute top-1/2 left-3 -translate-y-1/2 z-30 flex items-center">
                                <button
                                    onClick={() => setShowSidebar(true)}
                                    className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-white cursor-pointer transition-all relative"
                                    title="Back to Chats"
                                >
                                    <ChevronLeft size={16} />
                                    {otherUnreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-gray-900 animate-pulse" />
                                    )}
                                </button>
                            </div>

                            <ChatHeader
                                typingUsers={typingUsers}
                                currentUserName={nameOfUser}
                                activeRoom={activeRoom}
                                showSearchIcon={!showConversationSearch}
                                onToggleSearch={() => { setShowConversationSearch(true); requestAnimationFrame(() => searchInputRef.current?.focus()); }}
                                onChallenge={(activeRoom?.type === "dm" || activeRoom?.type === "custom") ? () => {
                                    if (activeRoom.type === "dm" && activeRoom.dm_partner) {
                                        setPendingChallengeUserId(activeRoom.dm_partner.id);
                                    } else if (activeRoom.type === "custom" && activeRoom.members) {
                                        // Select all members except current user
                                        const otherMemberIds = activeRoom.members
                                            .filter((m: any) => m.user_id !== user.id)
                                            .map((m: any) => m.user_id)
                                            .join(',');
                                        setPendingChallengeUserId(otherMemberIds);
                                    }
                                    if (onClose) onClose();
                                    setIsChallengeOpen(true);
                                } : undefined}
                                onDeleteGroup={(activeRoom?.type === "custom" && activeRoom?.created_by === user.id) ? async () => {
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
                                } : undefined}
                            />
                        </div>

                        {/* Game Analysis lock validation */}
                        {activeRoom && activeRoom.type === "game_analysis" && !hasPlayedToday ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-950/40 backdrop-blur-xs">
                                <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mb-4 animate-pulse">
                                    <ShieldAlert size={28} />
                                </div>
                                <h4 className="text-base font-black uppercase text-white tracking-tight mb-2">Analysis Room Locked</h4>
                                <p className="text-white/60 text-xs leading-relaxed max-w-65">
                                    Complete today's daily puzzle first to unlock this discussion and view daily stats and player guess breakdowns!
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Conversation Search Icon Button */}
                                {showConversationSearch && (
                                    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-black/40 border-b border-white/5">
                                        <button
                                            onClick={() => { setShowConversationSearch(false); setConversationSearchQuery(''); }}
                                            className="text-white/40 hover:text-white transition-colors cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={conversationSearchQuery}
                                            onChange={(e) => setConversationSearchQuery(e.target.value)}
                                            placeholder="Search messages..."
                                            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
                                            autoFocus
                                        />
                                        {searchResults.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-white/40 font-mono">
                                                    {currentSearchIndex + 1}/{searchResults.length}
                                                </span>
                                                <button
                                                    onClick={() => navigateSearch('prev')}
                                                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                                                >
                                                    <ChevronUp size={12} />
                                                </button>
                                                <button
                                                    onClick={() => navigateSearch('next')}
                                                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                                                >
                                                    <ChevronDown size={12} />
                                                </button>
                                            </div>
                                        )}
                                        {searchResults.length === 0 && conversationSearchQuery.trim() && (
                                            <span className="text-[9px] text-white/30 font-mono">No results</span>
                                        )}
                                    </div>
                                )}

                                {/* Message Area */}
                                <div
                                    ref={setScrollNode}
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
                                                            id="unread-line"
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
                                                        onScrollToMessage={scrollToMessage}
                                                        onReply={(m) => {
                                                            setReplyingTo(m);
                                                            // Immediate focus for mobile swipe compatibility
                                                            const input = document.querySelector('[contenteditable="true"]') as HTMLElement;
                                                            if (input) {
                                                                input.focus();
                                                                // Move cursor to end
                                                                const range = document.createRange();
                                                                range.selectNodeContents(input);
                                                                range.collapse(false);
                                                                const sel = window.getSelection();
                                                                if (sel) {
                                                                    sel.removeAllRanges();
                                                                    sel.addRange(range);
                                                                }
                                                            }
                                                        }}
                                                        onMarkAsRead={(id) => markAsRead(id)}
                                                        users={users}
                                                        allProfiles={allProfiles}
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
                                                        onResend={resendMessage}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </AnimatePresence>
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Scroll to bottom button */}
                                <AnimatePresence>
                                    {showScrollDown && (
                                        <motion.button
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            onClick={scrollToBottom}
                                            className="absolute top-100 right-4 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#1f2c34] border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-[#2a3942] shadow-2xl transition-all cursor-pointer"
                                            title="Scroll to bottom"
                                        >
                                            <ChevronDown size={18} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>

                                {/* Input Area */}
                                <div className="z-10">
                                    <MessageInput
                                        onSend={sendMessage}
                                        onSendVoice={sendVoiceMessage}
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