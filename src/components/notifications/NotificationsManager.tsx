import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../hooks/useNotifications';

/**
 * Headless component to manage notification lifecycle:
 * 1. Real-time subscription (via useNotifications)
 */
export const NotificationsManager = () => {
    const { profile, } = useApp();
    const hasReminded = useRef(false);

    // Ensure real-time subscription is active
    useNotifications(profile?.id, { enableRealtime: true });

    // Reset reminder state if user logs out
    useEffect(() => {
        if (!profile?.id) {
            hasReminded.current = false;
        }
    }, [profile?.id]);

    return null;
};
