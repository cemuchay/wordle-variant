import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { NotificationToast } from './NotificationToast';

/**
 * Headless component to manage notification lifecycle:
 * 1. Real-time subscription (via useNotifications)
 */
export const NotificationsManager = () => {
    const { profile, } = useApp();
    const hasReminded = useRef(false);

    // Reset reminder state if user logs out
    useEffect(() => {
        if (!profile?.id) {
            hasReminded.current = false;
        }
    }, [profile?.id]);

    return <NotificationToast />;
};
