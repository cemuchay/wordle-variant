/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useMemo } from 'react';
import { X, Bell, CheckCircle2, Trash2, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../../hooks/useNotifications';
import { useApp } from '../../context/AppContext';
import { Z_INDEX, ANIMATION_DURATION } from '../../constants/ui';
import { type AppNotification } from '../../types/notifications';

const NotificationItem = memo(({ 
    notification, 
    onMarkRead, 
    onDelete 
}: { 
    notification: AppNotification, 
    onMarkRead: (id: string) => void, 
    onDelete: (id: string) => void 
}) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`p-4 rounded-2xl border transition-all ${notification.is_read ? 'bg-white/2 border-white/5 opacity-60' : 'bg-white/5 border-white/10 shadow-lg shadow-black/20'}`}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        {!notification.is_read && <span className="w-1.5 h-1.5 rounded-full bg-correct animate-pulse" />}
                        <h4 className="text-xs font-black uppercase tracking-tight text-white">{notification.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{notification.message}</p>
                    <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest block pt-1">
                        {new Date(notification.created_at).toLocaleString()}
                    </span>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                    {!notification.is_read && (
                        <button
                            onClick={() => onMarkRead(notification.id)}
                            className="p-2 hover:bg-correct/10 text-gray-500 hover:text-correct rounded-xl transition-all"
                            title="Mark as read"
                        >
                            <CheckCircle2 size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(notification.id)}
                        className="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-xl transition-all"
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
});

export const NotificationModal = memo(() => {
    const { profile, isNotificationsOpen, setIsNotificationsOpen } = useApp();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, isLoading } = useNotifications(profile?.id, { enableRealtime: false });

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
                            {sortedNotifications.map(n => (
                                <NotificationItem 
                                    key={n.id} 
                                    notification={n} 
                                    onMarkRead={markAsRead} 
                                    onDelete={deleteNotification} 
                                />
                            ))}
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
