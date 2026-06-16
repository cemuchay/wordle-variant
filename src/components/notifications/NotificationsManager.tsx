import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../hooks/useNotifications';
import { syncPushSubscriptionIfNeeded } from '../../lib/pushService';

/**
 * Headless component to manage notification lifecycle:
 * 1. Real-time subscription (via useNotifications)
 * 2. Background push subscription synchronization
 */
export const NotificationsManager = () => {
    const { profile, } = useApp();
    const hasReminded = useRef(false);

    // Ensure real-time subscription is active
    useNotifications(profile?.id, { enableRealtime: true });

    // Sync push subscription in the background if notifications are enabled
    useEffect(() => {
        if (profile?.id) {
            syncPushSubscriptionIfNeeded();
        }
    }, [profile?.id]);

    // Reset reminder state if user logs out
    useEffect(() => {
        if (!profile?.id) {
            hasReminded.current = false;
        }
    }, [profile?.id]);

    return null;
};
