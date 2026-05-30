import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { X, Bell, Trash2, BellOff, Mail, MailOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../../hooks/useNotifications';
import { useApp } from '../../context/AppContext';
import { Z_INDEX, ANIMATION_DURATION } from '../../constants/ui';
import { type AppNotification } from '../../types/notifications';

const NotificationItem = memo(({ 
    notification, 
    onMarkRead, 
    onMarkUnread,
    onDelete,
    onClick,
    isSessionNew
}: { 
    notification: AppNotification, 
    onMarkRead: (id: string) => void, 
    onMarkUnread: (id: string) => void, 
    onDelete: (id: string) => void,
    onClick?: (n: AppNotification) => void,
    isSessionNew: boolean
}) => {
    const isUnread = !notification.is_read;
    const isNew = isSessionNew;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onClick ? () => onClick(notification) : undefined}
            className={`p-4 rounded-2xl border transition-all ${
                onClick ? 'cursor-pointer hover:bg-white/10 hover:border-white/20 active:scale-[0.98]' : ''
            } ${
                isNew
                    ? 'bg-white/[0.08] border-l-4 border-l-correct border-y-white/10 border-r-white/10 shadow-lg shadow-black/30'
                    : isUnread
                    ? 'bg-white/[0.06] border-l-4 border-l-blue-500 border-y-white/10 border-r-white/10 shadow-md shadow-black/20'
                    : 'bg-white/[0.03] border-white/5 opacity-90'
            }`}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        {isNew ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-correct text-black rounded-md uppercase tracking-wider">New</span>
                        ) : isUnread ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-blue-500 text-white rounded-md uppercase tracking-wider">Reminder</span>
                        ) : null}
                        <h4 className="text-sm font-extrabold uppercase tracking-tight text-white">{notification.title}</h4>
                    </div>
                    <p className="text-xs text-white leading-relaxed pt-0.5">{notification.message}</p>
                    <span className="text-[10px] font-semibold text-white/50 block pt-1.5">
                        {new Date(notification.created_at).toLocaleString()}
                    </span>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                    {isUnread ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                            className="p-2 hover:bg-correct/10 text-correct hover:text-white rounded-xl transition-all"
                            title="Mark as read"
                        >
                            <MailOpen size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMarkUnread(notification.id); }}
                            className="p-2 hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 rounded-xl transition-all"
                            title="Mark as unread (Reminder)"
                        >
                            <Mail size={16} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                        className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-xl transition-all"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
});

export const NotificationModal = memo(() => {
    const { profile, isNotificationsOpen, setIsNotificationsOpen, setIsChallengeOpen } = useApp();
    const { notifications, unreadCount, markAsRead, markAsUnread, markAllAsRead, deleteNotification, isLoading } = useNotifications(profile?.id, { enableRealtime: false });

    const [sessionNewIds, setSessionNewIds] = useState<Set<string>>(new Set());
    const [hasAutoMarked, setHasAutoMarked] = useState(false);

    // Reset session tracking when modal opens/closes
    useEffect(() => {
        if (!isNotificationsOpen) {
            setSessionNewIds(new Set());
            setHasAutoMarked(false);
        }
    }, [isNotificationsOpen]);

    // Automatically mark all as read once notifications load when the modal is open
    useEffect(() => {
        if (isNotificationsOpen && !isLoading && notifications.length > 0 && !hasAutoMarked) {
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length > 0) {
                setSessionNewIds(new Set(unreadIds));
                markAllAsRead();
            }
            setHasAutoMarked(true);
        }
    }, [isNotificationsOpen, isLoading, notifications, hasAutoMarked, markAllAsRead]);

    const handleNotificationClick = useCallback((n: AppNotification) => {
        if (!n.is_read) {
            markAsRead(n.id);
        }

        if (n.type === 'CHALLENGE_INVITE' || n.type === 'CHALLENGE_COMPLETED' || n.type === 'MARATHON_GAME_COMPLETED') {
            const challengeId = n.data?.challenge_id;
            if (challengeId) {
                const url = new URL(window.location.href);
                url.searchParams.set('challenge', challengeId);
                window.history.pushState({}, '', url.pathname + url.search);
                setIsChallengeOpen(true);
                setIsNotificationsOpen(false);
            }
        } else if (n.type === 'LEADERBOARD_OVERTAKEN') {
            window.dispatchEvent(new CustomEvent('open-stats-modal', { detail: { tab: 'leaderboard' } }));
            setIsNotificationsOpen(false);
        }
    }, [markAsRead, setIsChallengeOpen, setIsNotificationsOpen]);

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [notifications]);

    if (!isNotificationsOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" 
            style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
            onClick={() => setIsNotificationsOpen(false)}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: ANIMATION_DURATION.FAST / 1000 }}
                className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-correct/20 p-2 rounded-xl">
                            <Bell className="text-correct w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tighter text-white">
                                Notifications
                            </h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {unreadCount} Unread
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsRead()}
                                className="text-[9px] font-black uppercase tracking-widest text-correct hover:text-white transition-colors px-3 py-1.5 bg-correct/10 rounded-lg"
                            >
                                Mark all as read
                            </button>
                        )}
                        <button 
                            onClick={() => setIsNotificationsOpen(false)}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-4 text-gray-500">
                            <div className="w-8 h-8 border-2 border-correct border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Loading alerts...</p>
                        </div>
                    ) : sortedNotifications.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="bg-white/5 p-6 rounded-full">
                                <BellOff className="w-8 h-8 text-gray-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase text-gray-400">All clear!</p>
                                <p className="text-[10px] text-gray-600 uppercase font-bold max-w-[180px]">
                                    You'll see alerts here when people invite you to challenges.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {sortedNotifications.map(n => {
                                const isInteractive = n.type === 'CHALLENGE_INVITE' || 
                                                     n.type === 'CHALLENGE_COMPLETED' || 
                                                     n.type === 'MARATHON_GAME_COMPLETED' || 
                                                     n.type === 'LEADERBOARD_OVERTAKEN';
                                const isSessionNew = sessionNewIds.has(n.id);
                                return (
                                    <NotificationItem 
                                        key={n.id} 
                                        notification={n} 
                                        isSessionNew={isSessionNew}
                                        onMarkRead={markAsRead} 
                                        onMarkUnread={markAsUnread}
                                        onDelete={deleteNotification} 
                                        onClick={isInteractive ? handleNotificationClick : undefined}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-white/2">
                    <button
                        onClick={() => setIsNotificationsOpen(false)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
});

