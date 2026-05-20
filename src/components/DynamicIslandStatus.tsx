import { motion } from 'framer-motion';
import { Clock, Phone, Users, Check, X, PhoneOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { AudioChatControls } from './challenge/AudioChatControls';

export const DynamicIslandStatus = () => {
    const { user } = useAuth();
    const {
        activeCall,
        setIsChallengeOpen,
        setIsChatOpen,
        triggerToast,
        onlineUsers,
        allProfiles,
        audioChat,
        activeVoiceRooms,
        acceptCall,
        rejectCall,
        hangUpCall
    } = useApp();

    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (audioChat.error) {
            triggerToast(audioChat.error, 5000);
        }
    }, [audioChat.error, triggerToast]);

    // Force expand on incoming call so user immediately sees Accept/Reject buttons
    useEffect(() => {
        if (activeCall?.status === 'ringing') {
            const timer = setTimeout(() => {
                setIsExpanded(true);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [activeCall?.status]);

    // Filter out the current user from the online count
    const otherOnlineUsers = onlineUsers.filter(u => u.id !== user?.id);

    // Get the first active voice room to show in the island
    const currentVoiceSession = activeVoiceRooms[0];

    // Show island if: expanded OR online users > 0 OR active call OR someone is in a voice room I'm part of
    if (!isExpanded && otherOnlineUsers.length === 0 && !activeCall && !currentVoiceSession) return null;

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

    const formatLastSeen = (dateString?: string) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return date.toLocaleDateString();
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
        if (activeCall) {
            if (activeCall.status === 'ringing') return '240px';
            if (activeCall.status === 'calling') return '180px';
            return '140px'; // connecting / connected
        }
        if (currentVoiceSession) return '180px';
        if (otherOnlineUsers.length === 1) return '150px';
        return '135px';
    };

    return (
        <div className={`fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-100 pointer-events-none transition-transform duration-500 ${isExpanded ? 'translate-y-2' : ''}`}>
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                    pointer-events-auto cursor-pointer overflow-hidden
                    bg-black/90 backdrop-blur-xl border border-white/10
                    shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                    flex flex-col items-center justify-center
                    transition-all duration-500 ease-in-out
                `}
                style={{
                    borderRadius: isExpanded ? '32px' : '20px',
                    width: getPillWidth(),
                    height: isExpanded ? 'min(75vh, 480px)' : '32px',
                }}
            >
                {!isExpanded ? (
                    <motion.div
                        layout
                        className="flex items-center gap-1.5 px-3 h-full w-full justify-center"
                    >
                        {activeCall ? (
                            activeCall.status === 'ringing' ? (
                                <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <img
                                            src={activeCall.targetUser?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.targetUser?.username || '')}`}
                                            alt=""
                                            className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                        />
                                        <span className="text-[9px] font-bold text-white truncate max-w-[80px]">
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
                                            className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-transform active:scale-95"
                                        >
                                            <X size={10} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            ) : activeCall.status === 'calling' ? (
                                <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                        <span className="text-[9px] font-bold text-zinc-400 truncate max-w-[90px]">
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
                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-yellow-500'} animate-pulse`} />
                                    <Phone size={12} className={`${isConnected ? 'text-emerald-500' : 'text-yellow-500'} animate-bounce`} />
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                                        {isConnected ? 'On Call' : 'Connecting...'}
                                    </span>
                                </div>
                            )
                        ) : currentVoiceSession ? (
                            <div className="flex items-center gap-1.5">
                                <img
                                    src={currentVoiceSession.user.avatar_url}
                                    alt=""
                                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                />
                                <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                                    {currentVoiceSession.user.username} in Voice
                                </span>
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            </div>
                        ) : otherOnlineUsers.length === 1 ? (
                            <>
                                <img
                                    src={otherOnlineUsers[0].avatar_url}
                                    alt=""
                                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                />
                                <span className="text-[9px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-wider">
                                    {otherOnlineUsers[0].username} online
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="flex -space-x-1 shrink-0">
                                    {otherOnlineUsers.slice(0, 2).map((u, i) => (
                                        <img
                                            key={u.id}
                                            src={u.avatar_url}
                                            alt=""
                                            className="w-4 h-4 rounded-full border border-black shrink-0"
                                            style={{ zIndex: 2 - i }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider whitespace-nowrap">
                                    {otherOnlineUsers.length} ONLINE
                                </span>
                            </>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-full h-full flex flex-col p-6 overflow-hidden"
                    >
                        {/* Call Handling / Setup Sections */}
                        {activeCall && (
                            <div className="mb-6 pb-6 border-b border-white/10 flex flex-col items-center justify-center text-center">
                                {activeCall.status === 'ringing' ? (
                                    <div className="w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative">
                                            <img
                                                src={activeCall.targetUser?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.targetUser?.username || '')}`}
                                                alt=""
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
                                            <img
                                                src={activeCall.targetUser?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.targetUser?.username || '')}`}
                                                alt=""
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
                                        <img
                                            src={currentVoiceSession.user.avatar_url}
                                            alt=""
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
                                                    <img
                                                        src={p.avatar_url}
                                                        alt=""
                                                        className={`w-10 h-10 rounded-full border transition-all ${isOnline ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-white/10'}`}
                                                    />
                                                    {isOnline && (
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span 
                                                        className="text-xs font-bold text-white group-hover:text-emerald-400 cursor-pointer hover:underline transition-colors"
                                                        onClick={(e) => {
                                                            if (p.id) {
                                                                e.stopPropagation();
                                                                window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: p.id } }));
                                                            }
                                                        }}
                                                    >
                                                        {p.username} {p.id === user?.id && <span className="text-[8px] text-gray-500 ml-1">(YOU)</span>}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-500">
                                                        {inVoiceRoom ? (
                                                            <span className="text-emerald-500 font-bold uppercase tracking-tighter">In Voice Chat</span>
                                                        ) : isOnline ? (
                                                            <span className="text-emerald-500 font-bold uppercase tracking-tighter">Active Now</span>
                                                        ) : (
                                                            <>
                                                                <Clock size={8} />
                                                                <span>Seen {formatLastSeen(p.last_seen_at)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {inVoiceRoom && inVoiceRoom !== activeCall?.channelId && (
                                                <button
                                                    onClick={(e) => handleGoToLobby(e, inVoiceRoom)}
                                                    className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all"
                                                >
                                                    Join
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};
