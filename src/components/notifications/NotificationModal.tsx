import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import {
    X,
    Bell,
    Trash2,
    BellOff,
    Mail,
    MailOpen,
    CheckCheck,
    Swords,
    Trophy,
    MessageCircle,
    UserPlus,
    Flame,
    Bot,
    Radio,
    Sparkles,
    Grid3X3,
    Gamepad2,
    AtSign
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useApp } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { ModalLayout } from '../layout/ModalLayout';
import { type AppNotification } from '../../types/notifications';

interface NotificationTheme {
    border: string;
    borderLeft: string;
    bgUnread: string;
    bgRead: string;
    badgeBg: string;
    badgeText: string;
    accentText: string;
    iconBg: string;
    iconColor: string;
    IconComponent: any;
    typeName: string;
}

const getNotificationTheme = (type: string, data?: Record<string, any>): NotificationTheme => {
    // WordGrid Notifications (Indigo / Cyan / Violet)
    if (data?.mode === 'wordgrid' || type?.startsWith('WORDGRID')) {
        return {
            border: 'border-indigo-500/25',
            borderLeft: 'border-l-indigo-400',
            bgUnread: 'bg-linear-to-r from-indigo-950/60 via-slate-900/90 to-indigo-950/30',
            bgRead: 'bg-linear-to-r from-indigo-950/20 via-slate-900/60 to-slate-900/40',
            badgeBg: 'bg-indigo-500/25 border-indigo-500/40',
            badgeText: 'text-indigo-200',
            accentText: 'text-indigo-400',
            iconBg: 'bg-indigo-500/20 border-indigo-500/30',
            iconColor: 'text-indigo-300',
            IconComponent: Grid3X3,
            typeName: 'WordGrid',
        };
    }

    switch (type) {
        // 🔴 RED / ROSE: High-stakes Alerts & Broadcasts
        case 'BOT_MARATHON_FINALE':
        case 'ADMIN_BROADCAST':
            return {
                border: 'border-rose-500/25',
                borderLeft: 'border-l-rose-500',
                bgUnread: 'bg-linear-to-r from-rose-950/60 via-slate-900/90 to-rose-950/30',
                bgRead: 'bg-linear-to-r from-rose-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-rose-500/25 border-rose-500/40',
                badgeText: 'text-rose-200',
                accentText: 'text-rose-400',
                iconBg: 'bg-rose-500/20 border-rose-500/30',
                iconColor: 'text-rose-300',
                IconComponent: Radio,
                typeName: 'Announcement',
            };

        // 🟠 ORANGE: Direct PvP Challenges & Invites
        case 'CHALLENGE_INVITE':
        case 'CHALLENGE_STARTED':
            return {
                border: 'border-orange-500/25',
                borderLeft: 'border-l-orange-500',
                bgUnread: 'bg-linear-to-r from-orange-950/60 via-slate-900/90 to-orange-950/30',
                bgRead: 'bg-linear-to-r from-orange-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-orange-500/25 border-orange-500/40',
                badgeText: 'text-orange-200',
                accentText: 'text-orange-400',
                iconBg: 'bg-orange-500/20 border-orange-500/30',
                iconColor: 'text-orange-300',
                IconComponent: Swords,
                typeName: 'PvP Challenge',
            };

        // 🟡 AMBER / YELLOW: Competitive Overtakes & Leaderboard Changes
        case 'LEADERBOARD_OVERTAKEN':
        case 'BOT_MARATHON_OVERTAKEN':
            return {
                border: 'border-amber-500/25',
                borderLeft: 'border-l-amber-400',
                bgUnread: 'bg-linear-to-r from-amber-950/60 via-slate-900/90 to-amber-950/30',
                bgRead: 'bg-linear-to-r from-amber-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-amber-500/25 border-amber-500/40',
                badgeText: 'text-amber-200',
                accentText: 'text-amber-400',
                iconBg: 'bg-amber-500/20 border-amber-500/30',
                iconColor: 'text-amber-300',
                IconComponent: Trophy,
                typeName: 'Overtaken',
            };

        // 🟢 EMERALD / GREEN: Completed Games & Victories
        case 'CHALLENGE_COMPLETED':
        case 'MARATHON_GAME_COMPLETED':
            return {
                border: 'border-emerald-500/25',
                borderLeft: 'border-l-emerald-500',
                bgUnread: 'bg-linear-to-r from-emerald-950/60 via-slate-900/90 to-emerald-950/30',
                bgRead: 'bg-linear-to-r from-emerald-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-emerald-500/25 border-emerald-500/40',
                badgeText: 'text-emerald-200',
                accentText: 'text-emerald-400',
                iconBg: 'bg-emerald-500/20 border-emerald-500/30',
                iconColor: 'text-emerald-300',
                IconComponent: Sparkles,
                typeName: 'Completed',
            };

        // 🩵 CYAN / TEAL: Social Follows & Friends
        case 'NEW_FOLLOWER':
        case 'FOLLOWEE_STARTED_PLAYING':
        case 'FOLLOWEE_FINISHED_PLAYING':
            return {
                border: 'border-cyan-500/25',
                borderLeft: 'border-l-cyan-400',
                bgUnread: 'bg-linear-to-r from-cyan-950/60 via-slate-900/90 to-cyan-950/30',
                bgRead: 'bg-linear-to-r from-cyan-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-cyan-500/25 border-cyan-500/40',
                badgeText: 'text-cyan-200',
                accentText: 'text-cyan-400',
                iconBg: 'bg-cyan-500/20 border-cyan-500/30',
                iconColor: 'text-cyan-300',
                IconComponent: UserPlus,
                typeName: 'Friend Alert',
            };

        // 🔵 BLUE: Direct Messages & Reminders
        case 'DM_MESSAGE':
        case 'DM_REMINDER':
            return {
                border: 'border-blue-500/25',
                borderLeft: 'border-l-blue-500',
                bgUnread: 'bg-linear-to-r from-blue-950/60 via-slate-900/90 to-blue-950/30',
                bgRead: 'bg-linear-to-r from-blue-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-blue-500/25 border-blue-500/40',
                badgeText: 'text-blue-200',
                accentText: 'text-blue-400',
                iconBg: 'bg-blue-500/20 border-blue-500/30',
                iconColor: 'text-blue-300',
                IconComponent: MessageCircle,
                typeName: 'Direct Message',
            };

        case 'CHAT_MENTION':
            return {
                border: 'border-sky-500/25',
                borderLeft: 'border-l-sky-400',
                bgUnread: 'bg-linear-to-r from-sky-950/60 via-slate-900/90 to-sky-950/30',
                bgRead: 'bg-linear-to-r from-sky-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-sky-500/25 border-sky-500/40',
                badgeText: 'text-sky-200',
                accentText: 'text-sky-400',
                iconBg: 'bg-sky-500/20 border-sky-500/30',
                iconColor: 'text-sky-300',
                IconComponent: AtSign,
                typeName: 'Chat Mention',
            };

        // 🟣 PURPLE / VIOLET: Bot Events & Daily Marathon Runs
        case 'BOT_MARATHON_NEW':
            return {
                border: 'border-purple-500/25',
                borderLeft: 'border-l-purple-500',
                bgUnread: 'bg-linear-to-r from-purple-950/60 via-slate-900/90 to-purple-950/30',
                bgRead: 'bg-linear-to-r from-purple-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-purple-500/25 border-purple-500/40',
                badgeText: 'text-purple-200',
                accentText: 'text-purple-400',
                iconBg: 'bg-purple-500/20 border-purple-500/30',
                iconColor: 'text-purple-300',
                IconComponent: Bot,
                typeName: 'Bot Marathon',
            };

        // 🌸 PINK / FUCHSIA: Comments & Social Reactions
        case 'NEW_COMMENT':
            return {
                border: 'border-pink-500/25',
                borderLeft: 'border-l-pink-500',
                bgUnread: 'bg-linear-to-r from-pink-950/60 via-slate-900/90 to-pink-950/30',
                bgRead: 'bg-linear-to-r from-pink-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-pink-500/25 border-pink-500/40',
                badgeText: 'text-pink-200',
                accentText: 'text-pink-400',
                iconBg: 'bg-pink-500/20 border-pink-500/30',
                iconColor: 'text-pink-300',
                IconComponent: Flame,
                typeName: 'Comment',
            };

        // ⚪ DEFAULT / SYSTEM
        case 'SYSTEM':
        case 'GENERAL':
        default:
            return {
                border: 'border-indigo-500/20',
                borderLeft: 'border-l-indigo-400',
                bgUnread: 'bg-linear-to-r from-indigo-950/50 via-slate-900/90 to-indigo-950/20',
                bgRead: 'bg-linear-to-r from-indigo-950/20 via-slate-900/60 to-slate-900/40',
                badgeBg: 'bg-indigo-500/25 border-indigo-500/40',
                badgeText: 'text-indigo-200',
                accentText: 'text-indigo-400',
                iconBg: 'bg-indigo-500/20 border-indigo-500/30',
                iconColor: 'text-indigo-300',
                IconComponent: Gamepad2,
                typeName: 'System',
            };
    }
};

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
    const theme = getNotificationTheme(notification.type, notification.data);
    const Icon = theme.IconComponent;

    return (
        <div
            onClick={onClick ? () => onClick(notification) : undefined}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden backdrop-blur-xs ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-[0.98]' : ''
                } ${isNew
                    ? `${theme.bgUnread} ${theme.border} border-l-4 ${theme.borderLeft} shadow-lg shadow-black/40`
                    : isUnread
                        ? `${theme.bgUnread} ${theme.border} border-l-4 ${theme.borderLeft} shadow-md shadow-black/30`
                        : `${theme.bgRead} border-white/5 opacity-85 hover:opacity-100`
                }`}
        >
            <div className="flex justify-between items-start gap-3">
                {/* Left Type Icon Badge */}
                <div className={`p-2 rounded-xl shrink-0 ${theme.iconBg} ${theme.iconColor} border border-white/5 mt-0.5`}>
                    <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Type Rainbow Pill */}
                        <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border border-white/10 ${theme.badgeBg} ${theme.badgeText}`}>
                            {theme.typeName}
                        </span>

                        {isNew ? (
                            <span className="px-1.5 py-0.5 text-[8px] font-black bg-correct text-black rounded-md uppercase tracking-wider shadow-xs">
                                New
                            </span>
                        ) : isUnread ? (
                            <span className="px-1.5 py-0.5 text-[8px] font-black bg-blue-500 text-white rounded-md uppercase tracking-wider shadow-xs">
                                Unread
                            </span>
                        ) : null}

                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white truncate">
                            {notification.title}
                        </h4>
                    </div>

                    <p className="text-xs text-gray-200 leading-relaxed pt-0.5 break-words">
                        {notification.message}
                    </p>

                    <span className="text-[10px] font-semibold text-white/40 block pt-1">
                        {new Date(notification.created_at).toLocaleString()}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {isUnread ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                            className="p-1.5 sm:p-2 hover:bg-correct/15 text-correct hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Mark as read"
                        >
                            <MailOpen size={15} />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMarkUnread(notification.id); }}
                            className="p-1.5 sm:p-2 hover:bg-blue-500/15 text-gray-400 hover:text-blue-400 rounded-xl transition-all cursor-pointer"
                            title="Mark as unread (Reminder)"
                        >
                            <Mail size={15} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                        className="p-1.5 sm:p-2 hover:bg-red-500/15 text-gray-400 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                        title="Delete"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
});

export const NotificationModal = memo(() => {
    const { profile, isNotificationsOpen, setIsNotificationsOpen, setIsChallengeOpen, setIsChatOpen } = useApp();
    const { notifications, unreadCount, markAsRead, markAsUnread, markAllAsRead, deleteNotification, isLoading } = useNotifications(profile?.id, { enableRealtime: false });

    // Track which notification IDs were unread when the modal opened
    const [sessionNewIds, setSessionNewIds] = useState<Set<string>>(() => {
        const unread = notifications.filter(n => !n.is_read).map(n => n.id);
        return new Set(unread);
    });
    const [hasAutoMarked, setHasAutoMarked] = useState(false);

    // Synchronize session unread tracking when modal opens
    useEffect(() => {
        if (isNotificationsOpen) {
            const unread = notifications.filter(n => !n.is_read).map(n => n.id);
            if (unread.length > 0) {
                setSessionNewIds(new Set(unread));
                markAllAsRead();
            }
            setHasAutoMarked(true);
        } else {
            setSessionNewIds(new Set());
            setHasAutoMarked(false);
        }
    }, [isNotificationsOpen]); // Only run on modal open / close

    // Fallback if notifications finished loading after modal was already open
    useEffect(() => {
        if (isNotificationsOpen && !isLoading && notifications.length > 0 && !hasAutoMarked) {
            const unread = notifications.filter(n => !n.is_read).map(n => n.id);
            if (unread.length > 0) {
                setSessionNewIds(new Set(unread));
                markAllAsRead();
            }
            setHasAutoMarked(true);
        }
    }, [isNotificationsOpen, isLoading, notifications, hasAutoMarked, markAllAsRead]);

    const handleNotificationClick = useCallback((n: AppNotification) => {
        if (!n.is_read) {
            markAsRead(n.id);
        }

        // WordGrid notifications carry their routing payload as
        // data: { mode: 'wordgrid', matchId } — the server-side type string
        // is not part of this repo, so detect by payload (and defensive type prefix).
        if (n.data?.mode === 'wordgrid' || n.type?.startsWith('WORDGRID')) {
            const matchId = n.data?.matchId;
            if (matchId) {
                window.dispatchEvent(new CustomEvent('open-wordgrid-match', { detail: { matchId } }));
                setIsNotificationsOpen(false);
            }
        } else if (['CHALLENGE_INVITE', 'CHALLENGE_COMPLETED', 'MARATHON_GAME_COMPLETED', 'BOT_MARATHON_NEW', 'BOT_MARATHON_OVERTAKEN', 'BOT_MARATHON_FINALE'].includes(n.type)) {
            if (n.data?.mode === 'wordup_async') {
                const matchId = n.data?.matchId;
                if (matchId) {
                    const { setWordupMode, setWordUpOpen, setPendingAsyncMatchId } = useAppStore.getState();
                    setWordupMode('async');
                    setWordUpOpen(true);
                    setPendingAsyncMatchId(matchId);
                    setIsNotificationsOpen(false);
                }
            } else {
                const challengeId = n.data?.challenge_id;
                if (challengeId) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('challenge', challengeId);
                    window.history.pushState({}, '', url.pathname + url.search);
                    setIsChallengeOpen(true);
                    setIsNotificationsOpen(false);
                }
            }
        } else if (n.type === 'ADMIN_BROADCAST') {
            const targetUrl = n.data?.url || n.data?.action_url;
            if (targetUrl) {
                if (targetUrl.startsWith('http')) {
                    window.open(targetUrl, '_blank');
                } else {
                    window.history.pushState({}, '', targetUrl);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }
            }
            setIsNotificationsOpen(false);
        } else if (n.type === 'LEADERBOARD_OVERTAKEN') {
            window.dispatchEvent(new CustomEvent('open-stats-modal', { detail: { tab: 'leaderboard' } }));
            setIsNotificationsOpen(false);
        } else if (n.type === 'NEW_FOLLOWER') {
            const followerId = n.data?.follower_id;
            if (followerId) {
                window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: followerId } }));
                setIsNotificationsOpen(false);
            }
        } else if (n.type === 'NEW_COMMENT' || n.type === 'FOLLOWEE_STARTED_PLAYING' || n.type === 'FOLLOWEE_FINISHED_PLAYING') {
            window.dispatchEvent(new CustomEvent('open-stats-modal', { detail: { tab: 'leaderboard' } }));
            setIsNotificationsOpen(false);
        } else if (n.type === 'DM_MESSAGE' || n.type === 'DM_REMINDER' || n.type === 'CHAT_MENTION') {
            const groupId = n.data?.group_id;
            const groupType = n.data?.group_type;
            const senderId = n.data?.sender_id || n.data?.senderId;

            const { setPendingChatGroupId, setPendingDMUserId } = useAppStore.getState();

            if ((n.type === 'DM_MESSAGE' || n.type === 'DM_REMINDER' || groupType === 'dm') && senderId) {
                setPendingDMUserId(senderId);
            } else if (groupId) {
                setPendingChatGroupId(groupId);
            }

            setIsChatOpen(true);
            setIsNotificationsOpen(false);
        }

    }, [markAsRead, setIsChallengeOpen, setIsNotificationsOpen, setIsChatOpen]);

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [notifications]);

    if (!isNotificationsOpen) return null;

    return (
        <ModalLayout
            isOpen
            onClose={() => setIsNotificationsOpen(false)}
            maxWidth="full"
            showCloseButton={false}
            containerClassName="p-0!"
        >
            <div className="flex flex-col h-full min-h-0 w-full max-w-md mx-auto">
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
                                <CheckCheck size={20} />
                            </button>
                        )}
                        <button
                            onClick={() => setIsNotificationsOpen(false)}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
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
                        <div className="space-y-3">
                            {sortedNotifications.map(n => {
                                const isInteractive = n.type === 'CHALLENGE_INVITE' ||
                                    n.type === 'CHALLENGE_COMPLETED' ||
                                    n.type === 'MARATHON_GAME_COMPLETED' ||
                                    n.type === 'BOT_MARATHON_NEW' ||
                                    n.type === 'BOT_MARATHON_OVERTAKEN' ||
                                    n.type === 'BOT_MARATHON_FINALE' ||
                                    n.data?.mode === 'wordgrid' ||
                                    n.type?.startsWith('WORDGRID') ||
                                    n.type === 'ADMIN_BROADCAST' ||
                                    n.type === 'LEADERBOARD_OVERTAKEN' ||
                                    n.type === 'DM_MESSAGE' ||
                                    n.type === 'DM_REMINDER' ||
                                    n.type === 'CHAT_MENTION' ||
                                    n.type === 'NEW_FOLLOWER' ||
                                    n.type === 'NEW_COMMENT' ||
                                    n.type === 'FOLLOWEE_STARTED_PLAYING' ||
                                    n.type === 'FOLLOWEE_FINISHED_PLAYING';

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
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-white/2 shrink-0">
                    <button
                        onClick={() => setIsNotificationsOpen(false)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </ModalLayout>
    );
});
