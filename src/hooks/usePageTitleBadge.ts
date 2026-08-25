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
        const total = chatUnread + notificationUnread + challengeUnread + wordupUnreadCount;
        document.title = total > 0
            ? `(${total > 99 ? '99+' : total}) ${BASE_TITLE}`
            : BASE_TITLE;
    }, [chatUnread, notificationUnread, challengeUnread, wordupUnreadCount]);
};
