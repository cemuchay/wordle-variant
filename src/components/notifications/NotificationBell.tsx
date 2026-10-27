import { memo, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useApp } from '../../context/AppContext';

// Preload the NotificationModal component bundle
const preloadNotificationModal = () => {
    import('./NotificationModal');
};

export const NotificationBell = memo(() => {
    const { profile, setIsNotificationsOpen } = useApp();
    const { unreadCount } = useNotifications(profile?.id, { enableRealtime: false });

    // Preload when idle so opening is instant
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if ('requestIdleCallback' in window) {
                const handle = (window as any).requestIdleCallback(preloadNotificationModal, { timeout: 3000 });
                return () => (window as any).cancelIdleCallback?.(handle);
            } else {
                const timer = setTimeout(preloadNotificationModal, 1500);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    return (
        <button
            onClick={() => setIsNotificationsOpen(true)}
            onMouseEnter={preloadNotificationModal}
            onTouchStart={preloadNotificationModal}
            onFocus={preloadNotificationModal}
            className="relative p-2 hover:bg-white/5 rounded-xl transition-all group"
            aria-label="Notifications"
        >
            <Bell size={20} className="text-white group-hover:text-white transition-colors" />

            {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-background animate-in zoom-in duration-300">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
});
