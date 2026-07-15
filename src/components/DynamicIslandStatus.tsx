import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Phone, Users, Check, X, PhoneOff, MessageCircle, BellRing, Trophy } from 'lucide-react';
import { ProtectedAvatar } from './chat/ProtectedAvatar';
import { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { AudioChatControls } from './challenge/AudioChatControls';
import formatLastSeen from '../utils/formatLastSeen';
import { ReigningBadge } from './common/ReigningBadge';

import { useAppStore } from '../store/useAppStore';
import { WordUpMascot } from '../wordup/shared/WordUpMascot';
import type { MascotExpression } from '../wordup/shared/WordUpMascot';
import formatUsername from '../utils/formatUsername';

export const DynamicIslandStatus = () => {
    const { user } = useAuth();
    const setPendingDMUserId = useAppStore(s => s.setPendingDMUserId);
    const setPendingChallengeUserId = useAppStore(s => s.setPendingChallengeUserId);
    const {
        activeCall,
        setIsChallengeOpen,
        setIsChatOpen,
        setIsNotificationsOpen,
        triggerToast,
        toast,
        setToast,
        onlineUsers,
        allProfiles,
        refreshProfiles,
        audioChat,
        activeVoiceRooms,
        acceptCall,
        rejectCall,
        hangUpCall,
        initiatePrivateCall
    } = useApp();

    const [isExpanded, setIsExpanded] = useState(false);
    const [mascot, setMascot] = useState<{ expression: MascotExpression; label: string } | null>(null);
    const [showOnlineNotification, setShowOnlineNotification] = useState(false);
    const [showRainbowBorder, setShowRainbowBorder] = useState(false);
    const toastTimerRef = useRef<number>(null);
    const prevMascotKeyRef = useRef<string>('');
    const mascotRainbowTimerRef = useRef<number>(null);
    const isFirstRender = useRef(true);

    // Filter out the current user from the online count, cross-referencing with
    // freshly fetched profile last_seen_at to catch stale presence entries
    const [otherOnlineUsers, setOtherOnlineUsers] = useState<Array<{ id: string; username: string; avatar_url: string; activeVoiceRoomId?: string | null }>>([]);
    const [lastOnlineCount, setLastOnlineCount] = useState(0);

    useEffect(() => {
        const filtered = onlineUsers.filter(u => {
            if (u.id === user?.id) return false;
            const profile = allProfiles.find(p => p.id === u.id);
            if (!profile?.last_seen_at) return true;
            return Date.now() - new Date(profile.last_seen_at).getTime() < 120_000;
        });
        Promise.resolve().then(() => {
            setOtherOnlineUsers(filtered);
        });
    }, [onlineUsers, allProfiles, user?.id]);

    // Default persistent state
    const [localTime, setLocalTime] = useState("");
    const [resumeKey, setResumeKey] = useState(0);
    const lastFetchRef = useRef(0);
    const REFRESH_INTERVAL_MS = 60_000;

    useEffect(() => {
        lastFetchRef.current = Date.now();
    }, []);

    // Force re-render on resume to fix PWA layout bugs + background refresh
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setResumeKey(prev => prev + 1);
                if (Date.now() - lastFetchRef.current > REFRESH_INTERVAL_MS) {
                    lastFetchRef.current = Date.now();
                    refreshProfiles();
                }
            }
        };
        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);
        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [refreshProfiles]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setLocalTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (audioChat.error) {
            triggerToast(audioChat.error, 5000);
        }
    }, [audioChat.error, triggerToast]);

    // Listen for new notifications to flash in the Dynamic Island
    useEffect(() => {
        const handleNewNotification = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail && detail.message) {
                // Briefly flash in Dynamic Island using triggerToast
                triggerToast(detail.message, 5000);
            }
        };
        window.addEventListener('new-notification', handleNewNotification);
        return () => window.removeEventListener('new-notification', handleNewNotification);
    }, [triggerToast]);

    // Toast logic: auto-hide after duration
    useEffect(() => {
        if (toast.show) {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => {
                setToast({ ...toast, show: false });
            }, toast.duration || 3000);
            return () => {
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            };
        }
    }, [setToast, toast]);

    // Force expand on incoming call so user immediately sees Accept/Reject buttons
    useEffect(() => {
        if (activeCall?.status === 'ringing') {
            const timer = setTimeout(() => {
                setIsExpanded(true);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [activeCall?.status]);

    // Listen to mascot changes from Grid gameplay + trigger rainbow border
    useEffect(() => {
        const handleMascot = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            if (detail) {
                const key = `${detail.expression}_${detail.label}`;
                if (key !== prevMascotKeyRef.current) {
                    prevMascotKeyRef.current = key;
                    setShowRainbowBorder(true);
                    if (mascotRainbowTimerRef.current) clearTimeout(mascotRainbowTimerRef.current);
                    mascotRainbowTimerRef.current = setTimeout(() => {
                        setShowRainbowBorder(false);
                    }, 4000);
                }
                setMascot(detail);
            } else {
                setMascot(null);
            }
        };
        window.addEventListener('mascot-changed', handleMascot);
        return () => window.removeEventListener('mascot-changed', handleMascot);
    }, []);

    // Clean up rainbow timer on unmount
    useEffect(() => {
        return () => {
            if (mascotRainbowTimerRef.current) clearTimeout(mascotRainbowTimerRef.current);
        };
    }, []);

    // Clear mascot after 90 seconds (1.5 minutes) of inactivity
    useEffect(() => {
        if (mascot) {
            const timer = setTimeout(() => {
                setMascot(null);
            }, 90000);
            return () => clearTimeout(timer);
        }
    }, [mascot]);

    // Trigger brief online notification when user count increases
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setLastOnlineCount(otherOnlineUsers.length);
            return;
        }
        if (otherOnlineUsers.length > lastOnlineCount) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowOnlineNotification(true);
            const timer = setTimeout(() => {
                setShowOnlineNotification(false);
            }, 8000); // 8 seconds
            return () => clearTimeout(timer);
        }
        setLastOnlineCount(otherOnlineUsers.length);
    }, [otherOnlineUsers.length, lastOnlineCount]);

    // Get the first active voice room to show in the island
    const currentVoiceSession = activeVoiceRooms[0];

    const handleGoToLobby = (e: React.MouseEvent, challengeId: string) => {
        e.stopPropagation();
        if (challengeId === 'global') {
            setIsChatOpen(true);
            setIsExpanded(false);
            return;
        }
        // Navigate to challenge
        const url = new URL(window.location.href);
        url.searchParams.set('challenge', challengeId);
        window.history.pushState({}, '', url);
        setIsChallengeOpen(true);
        setIsExpanded(false);
    };

    const sortedProfiles = [...allProfiles].sort((a, b) => {
        const aOnline = onlineUsers.some(u => u.id === a.id);
        const bOnline = onlineUsers.some(u => u.id === b.id);

        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;

        const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;

        return bTime - aTime;
    });

    const isConnected = audioChat.isConnected;

    // Dynamically calculate pill width based on current call status
    const getPillWidth = () => {
        if (isExpanded) return 'min(95vw, 340px)';
        if (toast.show) {
            const len = toast.message?.length || 0;
            // Expand dynamically if text is long
            const dynamicWidth = Math.max(280, Math.min(420, 160 + len * 5.5));
            return `min(95vw, ${dynamicWidth}px)`;
        }
        if (user && activeCall) {
            if (activeCall.status === 'ringing') return '240px';
            if (activeCall.status === 'calling') return '180px';
            return '140px'; // connecting / connected
        }
        if (user && currentVoiceSession) return '180px';
        if (mascot && (!showOnlineNotification || !user || otherOnlineUsers.length === 0)) {
            return '195px';
        }
        if (user && otherOnlineUsers.length === 1) return '160px';
        if (user && otherOnlineUsers.length > 1) return '145px';

        // Persistent default state (Smiley + Time)
        return '160px';
    };

    return (
        <div key={resumeKey} className="fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-100 pointer-events-none">
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    y: isExpanded ? 8 : 0,
                }}
                style={{
                    borderRadius: isExpanded ? '32px' : '20px',
                    width: getPillWidth(),
                    height: isExpanded ? 'min(75vh, 480px)' : toast.show && toast.isLarge ? 'auto' : '32px',
                    minHeight: toast.show && toast.isLarge ? '48px' : '32px',
                    padding: toast.show && toast.isLarge ? '8px 12px' : '0'
                }}
                transition={{
                    layout: {
                        type: 'spring',
                        stiffness: 380,
                        damping: 35
                    },
                    opacity: { duration: 0.15 },
                    scale: { duration: 0.15 },
                    y: { type: 'spring', stiffness: 380, damping: 35 },
                }}
                onClick={() => {
                    if (toast.show) {
                        setIsNotificationsOpen(true);
                        setToast({ ...toast, show: false });
                    } else {
                        setIsExpanded(!isExpanded);
                    }
                }}
                className={`
                    pointer-events-auto cursor-pointer overflow-visible
                    bg-black/20 backdrop-blur-md border border-white/10
                    shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                    flex flex-col items-center justify-center
                `}
            >
                {showRainbowBorder && (
                    <div className="absolute inset-[-1.5px] pointer-events-none z-0">
                        {/* Glow overlay - masked to bleed only outwards */}
                        <motion.div
                            className="absolute inset-[-4px]"
                            style={{
                                borderRadius: isExpanded ? '37px' : '25px',
                                padding: '5.5px',
                                background: 'linear-gradient(90deg, #ff3366, #ff9933, #33cc66, #3399ff, #9933ff, #ff3366)',
                                filter: 'blur(3px)',
                                opacity: 0.75,
                                mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                                maskComposite: 'exclude',
                                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                                WebkitMaskComposite: 'xor',
                            }}
                            animate={{
                                filter: ['blur(3px) hue-rotate(0deg)', 'blur(3px) hue-rotate(360deg)']
                            }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                        />
                        {/* Sharp border overlay */}
                        <motion.div
                            className="absolute inset-0"
                            style={{
                                borderRadius: isExpanded ? '33px' : '21px',
                                padding: '1.5px',
                                background: 'linear-gradient(90deg, #ff3366, #ff9933, #33cc66, #3399ff, #9933ff, #ff3366)',
                                mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                                maskComposite: 'exclude',
                                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                                WebkitMaskComposite: 'xor',
                            }}
                            animate={{
                                filter: ['hue-rotate(0deg)', 'hue-rotate(360deg)']
                            }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                        />
                    </div>
                )}
                <div className="relative z-1 w-full h-full">
                    {!isExpanded ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-1.5 px-3 h-full w-full justify-center"
                        >
                            <AnimatePresence mode="wait">
                                {toast.show ? (
                                    <motion.div
                                        key="toast"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`flex items-center gap-2 w-full px-1 ${toast.isLarge ? 'flex-col sm:flex-row text-center sm:text-left' : ''}`}
                                    >
                                        <BellRing size={toast.isLarge ? 12 : 10} className="text-emerald-400 shrink-0 animate-bounce" />
                                        <span className={`text-[8.5px] font-bold text-white flex-1 leading-relaxed ${toast.isLarge ? 'leading-tight' : 'truncate'}`}>
                                            {toast.message}
                                        </span>
                                    </motion.div>
                                ) : activeCall ? (
                                    activeCall.status === 'ringing' ? (
                                        <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <ProtectedAvatar
                                                    userId={activeCall.targetUser?.id}
                                                    src={activeCall.targetUser?.avatar_url}
                                                    username={activeCall.targetUser?.username || ''}
                                                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                                />
                                                <span className="text-[8px] font-bold text-white truncate max-w-[80px]">
                                                    {activeCall.targetUser?.username} calls
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={acceptCall}
                                                    className="p-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded-full transition-transform active:scale-95"
                                                >
                                                    <Check size={10} strokeWidth={3} />
                                                </button>
                                                <button
                                                    onClick={rejectCall}
                                                    className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-transform active:scale-95 cursor-pointer"
                                                >
                                                    <X size={10} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : activeCall.status === 'calling' ? (
                                        <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                                <span className="text-[8px] font-bold text-zinc-400 truncate max-w-[90px]">
                                                    Calling {activeCall.targetUser?.username}...
                                                </span>
                                            </div>
                                            <button
                                                onClick={hangUpCall}
                                                className="p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all"
                                            >
                                                <PhoneOff size={10} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-yellow-500'} animate-pulse`} />
                                            <Phone size={10} className={`${isConnected ? 'text-emerald-500' : 'text-yellow-500'} animate-bounce`} />
                                            <span className="text-[8.5px] font-black text-white uppercase tracking-tighter">
                                                {isConnected ? 'On Call' : 'Connecting...'}
                                            </span>
                                        </div>
                                    )
                                ) : currentVoiceSession ? (
                                    <div className="flex items-center gap-1.5">
                                        <ProtectedAvatar
                                            userId={currentVoiceSession.user.id}
                                            src={currentVoiceSession.user.avatar_url}
                                            username={currentVoiceSession.user.username}
                                            className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                        />
                                        <span className="text-[8.5px] font-black text-white uppercase tracking-tighter">
                                            {currentVoiceSession.user.username} in Voice
                                        </span>
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    </div>
                                ) : (user && otherOnlineUsers.length > 0 && (showOnlineNotification || !mascot)) ? (
                                    otherOnlineUsers.length === 1 ? (
                                        <>
                                            <ProtectedAvatar
                                                userId={otherOnlineUsers[0].id}
                                                src={otherOnlineUsers[0].avatar_url}
                                                username={otherOnlineUsers[0].username}
                                                className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                            />
                                            <span className="text-[8px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-wider">
                                                {otherOnlineUsers[0].username} online
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex -space-x-1 shrink-0">
                                                {otherOnlineUsers.slice(0, 2).map((u) => (
                                                    <ProtectedAvatar
                                                        key={u.id}
                                                        userId={u.id}
                                                        src={u.avatar_url}
                                                        username={u.username}
                                                        className="w-4 h-4 rounded-full border border-black shrink-0"
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider whitespace-nowrap">
                                                {otherOnlineUsers.length} ONLINE
                                            </span>
                                        </>
                                    )
                                ) : mascot ? (
                                    <div className="flex items-center gap-1.5 px-2.5 h-full w-full justify-center">
                                        <WordUpMascot expression={mascot.expression} size={18} />
                                        <span className="text-[8px] uppercase font-black tracking-[0.08em] text-white/90 truncate max-w-[110px] select-none">{mascot.label}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 h-full w-full justify-center">
                                        <WordUpMascot expression="idle" size={15} />
                                        <span className="text-[8.5px] font-black tracking-[0.08em] text-white/85 tabular-nums select-none">{localTime}</span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                            className="w-full h-full flex flex-col p-6 overflow-hidden"
                        >
                            {/* Call Handling / Setup Sections */}
                            {activeCall && (
                                <div className="mb-6 pb-6 border-b border-white/10 flex flex-col items-center justify-center text-center">
                                    {activeCall.status === 'ringing' ? (
                                        <div className="w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="relative">
                                                <ProtectedAvatar
                                                    userId={activeCall.targetUser?.id}
                                                    src={activeCall.targetUser?.avatar_url}
                                                    username={activeCall.targetUser?.username || ''}
                                                    className="w-16 h-16 rounded-full border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full border border-black text-black">
                                                    <Phone size={12} className="animate-bounce" />
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-black text-sm uppercase">{activeCall.targetUser?.username}</h3>
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Incoming Voice Call</p>
                                            </div>
                                            <div className="flex items-center gap-4 w-full px-4 mt-2">
                                                <button
                                                    onClick={rejectCall}
                                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-lg flex items-center justify-center gap-1.5"
                                                >
                                                    <PhoneOff size={14} />
                                                    Decline
                                                </button>
                                                <button
                                                    onClick={acceptCall}
                                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-lg flex items-center justify-center gap-1.5"
                                                >
                                                    <Check size={14} strokeWidth={2.5} />
                                                    Accept
                                                </button>
                                            </div>
                                        </div>
                                    ) : activeCall.status === 'calling' ? (
                                        <div className="w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="relative">
                                                <ProtectedAvatar
                                                    userId={activeCall.targetUser?.id}
                                                    src={activeCall.targetUser?.avatar_url}
                                                    username={activeCall.targetUser?.username || ''}
                                                    className="w-16 h-16 rounded-full border-2 border-zinc-500 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-zinc-800 p-1.5 rounded-full border border-black text-zinc-400">
                                                    <Phone size={12} className="animate-pulse" />
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-black text-sm uppercase">{activeCall.targetUser?.username}</h3>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Dialing...</p>
                                            </div>
                                            <div className="w-full px-4 mt-2">
                                                <button
                                                    onClick={hangUpCall}
                                                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-lg flex items-center justify-center gap-1.5"
                                                >
                                                    <PhoneOff size={14} />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 ${isConnected ? 'bg-emerald-500' : 'bg-yellow-500'} rounded-full animate-pulse`} />
                                                    <span className={`text-[10px] font-black ${isConnected ? 'text-emerald-400' : 'text-yellow-500'} uppercase tracking-widest`}>
                                                        {isConnected ? 'Active Call' : 'Connecting...'}
                                                    </span>
                                                </div>
                                                <Phone size={14} className={isConnected ? 'text-emerald-500' : 'text-yellow-500'} />
                                            </div>
                                            <div className="bg-white/5 p-4 rounded-2xl flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                <AudioChatControls
                                                    challengeId={activeCall.channelId}
                                                    userId={user?.id || ''}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Active Voice Sessions in Rooms I'm part of (Only if not in private call) */}
                            {!activeCall && currentVoiceSession && (
                                <div className="mb-6 pb-6 border-b border-white/10">
                                    <div className="flex flex-col items-center text-center gap-4">
                                        <div className="relative">
                                            <ProtectedAvatar
                                                userId={currentVoiceSession.user.id}
                                                src={currentVoiceSession.user.avatar_url}
                                                username={currentVoiceSession.user.username}
                                                className="w-16 h-16 rounded-full border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                            />
                                            <div className="absolute -bottom-1 -right-1 bg-black p-1 rounded-full border border-emerald-500">
                                                <Phone size={12} className="text-emerald-500" />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-black text-sm uppercase">{currentVoiceSession.user.username}</h3>
                                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Active in Voice Chat</p>
                                        </div>
                                        <div className="w-full">
                                            <button
                                                onClick={(e) => handleGoToLobby(e, currentVoiceSession.challengeId)}
                                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                            >
                                                <span>Join Room</span>
                                                {onlineUsers.filter(u => u.activeVoiceRoomId === currentVoiceSession.challengeId).length > 0 && (
                                                    <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[8px]">
                                                        {onlineUsers.filter(u => u.activeVoiceRoomId === currentVoiceSession.challengeId).length}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between mb-4 shrink-0">
                                <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                    <Users size={16} className="text-emerald-400" />
                                    Community
                                </h2>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                    className="text-gray-500 hover:text-white transition-colors"
                                >
                                    <span className="text-[10px] font-black">CLOSE</span>
                                </button>
                            </div>

                            {!user ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-3">
                                    <Users size={32} className="text-zinc-500 animate-pulse" />
                                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider leading-relaxed">
                                        Sign in to see online users & join voice chats
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                                    <div className="space-y-4">
                                        {sortedProfiles.map((p) => {
                                            const isOnline = onlineUsers.some(u => u.id === p.id);
                                            const inVoiceRoom = onlineUsers.find(u => u.id === p.id)?.activeVoiceRoomId;

                                            return (
                                                <div key={p.id} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="relative cursor-pointer hover:scale-105 transition-transform"
                                                            onClick={(e) => {
                                                                if (p.id) {
                                                                    e.stopPropagation();
                                                                    window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: p.id } }));
                                                                }
                                                            }}
                                                        >
                                                            <ProtectedAvatar
                                                                userId={p.id}
                                                                src={p.avatar_url}
                                                                username={p.username}
                                                                className={`w-10 h-10 rounded-full border transition-all ${isOnline ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-white/10'}`}
                                                            />
                                                            {isOnline && (
                                                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span
                                                                className="text-left text-xs font-bold text-white group-hover:text-emerald-400 cursor-pointer hover:underline transition-colors"
                                                                onClick={(e) => {
                                                                    if (p.id) {
                                                                        e.stopPropagation();
                                                                        window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: p.id } }));
                                                                    }
                                                                }}
                                                            >
                                                                {formatUsername(p.username)} {p.id === user?.id && <span className="text-[8px] text-gray-500 ml-1">(YOU)</span>}
                                                                <ReigningBadge userId={p.id} type="weekly" />
                                                                <ReigningBadge userId={p.id} type="bot_marathon" />
                                                            </span>
                                                            <div className="flex items-center gap-1 text-[9px] text-gray-500">
                                                                {inVoiceRoom ? (
                                                                    <span className="text-emerald-500 font-bold uppercase tracking-tighter">In Voice Chat</span>
                                                                ) : isOnline ? (
                                                                    <span className="text-emerald-500 font-bold uppercase tracking-tighter">Active Now</span>
                                                                ) : (
                                                                    <>
                                                                        <Clock size={8} />
                                                                        <span className="text-white">Seen {formatLastSeen(p.last_seen_at)}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                        {p.id !== user?.id && (
                                                            <button
                                                                onClick={() => {
                                                                    setPendingChallengeUserId(p.id);
                                                                    setIsChallengeOpen(true);
                                                                    setIsExpanded(false);
                                                                }}
                                                                className="p-1.5 bg-correct/10 hover:bg-correct text-correct hover:text-black rounded-lg transition-all"
                                                                title={`Challenge ${p.username}`}
                                                            >
                                                                <Trophy size={10} />
                                                            </button>
                                                        )}

                                                        {p.id !== user?.id && (
                                                            <button
                                                                onClick={() => {
                                                                    setPendingDMUserId(p.id);
                                                                    setIsChatOpen(true);
                                                                    setIsExpanded(false);
                                                                }}
                                                                className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                                                                title={`Message ${p.username}`}
                                                            >
                                                                <MessageCircle size={10} />
                                                            </button>
                                                        )}

                                                        {isOnline && p.id !== user?.id && (
                                                            <button
                                                                onClick={() => {
                                                                    if (activeCall) {
                                                                        triggerToast("You are already in a call.", 4000);
                                                                        return;
                                                                    }
                                                                    initiatePrivateCall({
                                                                        id: p.id,
                                                                        username: p.username,
                                                                        avatar_url: p.avatar_url
                                                                    });
                                                                    setIsExpanded(false);
                                                                }}
                                                                className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-500 hover:text-black rounded-lg transition-all"
                                                                title={`Call ${p.username}`}
                                                            >
                                                                <Phone size={10} />
                                                            </button>
                                                        )}

                                                        {inVoiceRoom && inVoiceRoom !== activeCall?.channelId && (
                                                            <button
                                                                onClick={(e) => handleGoToLobby(e, inVoiceRoom)}
                                                                className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all"
                                                            >
                                                                Join
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
