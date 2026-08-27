import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useApp } from '../context/AppContext';
import { useNotifications } from './useNotifications';

const BASE_TITLE = document.title;

export const usePageTitleBadge = (wordupUnreadCount: number) => {
    const { profile } = useApp();
    const { unreadCount: notificationUnread } = useNotifications(profile?.id, { enableRealtime: false });
    const chatUnread = useAppStore(s => s.unreadCount);
    const challengeUnread = useAppStore(s => s.challengeUnreadCount);

    useEffect(() => {
        const otherUnread = notificationUnread + challengeUnread + wordupUnreadCount;
        const parts: string[] = [];

        if (chatUnread > 0) {
            parts.push(`💬 ${chatUnread > 99 ? '99+' : chatUnread}`);
        }

        if (otherUnread > 0) {
            parts.push(`🔔 ${otherUnread > 99 ? '99+' : otherUnread}`);
        }

        if (parts.length > 0) {
            document.title = `(${parts.join(' | ')}) ${BASE_TITLE}`;
        } else {
            document.title = BASE_TITLE;
        }
    }, [chatUnread, notificationUnread, challengeUnread, wordupUnreadCount]);
};
