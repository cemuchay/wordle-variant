import { motion } from 'framer-motion';
import { Clock, Users } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGlobalPresence } from '../hooks/useGlobalPresence';

export const DynamicIslandStatus = () => {
    const { user } = useAuth();
    const { onlineUsers, allProfiles } = useGlobalPresence(user?.id);
    const [isExpanded, setIsExpanded] = useState(false);

    // Filter out the current user from the online count
    const otherOnlineUsers = onlineUsers.filter(u => u.id !== user?.id);

    if (otherOnlineUsers.length === 0 && !isExpanded) return null;

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

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-100 pointer-events-none">
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
                    width: isExpanded ? '300px' : (otherOnlineUsers.length === 1 ? '160px' : '100px'),
                    height: isExpanded ? '400px' : '36px',
                }}
            >
                {!isExpanded ? (
                    <motion.div
                        layout
                        className="flex items-center gap-2 px-3 h-full w-full justify-center"
                    >
                        {otherOnlineUsers.length === 1 ? (
                            <>
                                <img
                                    src={otherOnlineUsers[0].avatar_url}
                                    alt=""
                                    className="w-5 h-5 rounded-full border border-white/20"
                                />
                                <span className="text-[10px] font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                                    {otherOnlineUsers[0].username} is online
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="flex -space-x-2">
                                    {otherOnlineUsers.slice(0, 2).map((u, i) => (
                                        <img
                                            key={u.id}
                                            src={u.avatar_url}
                                            alt=""
                                            className="w-5 h-5 rounded-full border border-black"
                                            style={{ zIndex: 2 - i }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] font-black text-emerald-400">
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
                        className="w-full h-full flex flex-col p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
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

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-4">
                                {allProfiles.map((p) => {
                                    const isOnline = onlineUsers.some(u => u.id === p.id);
                                    return (
                                        <div key={p.id} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
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
                                                    <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                        {p.username} {p.id === user?.id && <span className="text-[8px] text-gray-500 ml-1">(YOU)</span>}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-500">
                                                        {isOnline ? (
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
