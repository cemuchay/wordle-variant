import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationToast } from './NotificationToast';

/**
 * Headless component to manage notification lifecycle:
 * 1. Real-time subscription (via useNotifications)
 * 2. On-login unread reminder
 */
export const NotificationsManager = () => {
    const { profile, triggerToast } = useApp();
    const { unreadCount, isLoading } = useNotifications(profile?.id, { enableRealtime: true });
    const hasReminded = useRef(false);

    useEffect(() => {
        // Reminder on login if there are unread notifications
        if (profile?.id && !isLoading && unreadCount > 0 && !hasReminded.current) {
            setTimeout(() => {
                triggerToast(`You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.`, 5000);
                hasReminded.current = true;
            }, 2000); // Small delay after login
        }
    }, [profile?.id, isLoading, unreadCount, triggerToast]);

    // Reset reminder state if user logs out
    useEffect(() => {
        if (!profile?.id) {
            hasReminded.current = false;
        }
    }, [profile?.id]);

    return <NotificationToast />;
};
