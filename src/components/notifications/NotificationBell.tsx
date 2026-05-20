import { memo } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useApp } from '../../context/AppContext';

export const NotificationBell = memo(() => {
    const { profile, setIsNotificationsOpen } = useApp();
    const { unreadCount } = useNotifications(profile?.id, { enableRealtime: false });

    return (
        <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-2 hover:bg-white/5 rounded-xl transition-all group"
            aria-label="Notifications"
        >
            <Bell size={20} className="text-gray-400 group-hover:text-white transition-colors" />
            
            {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-background animate-in zoom-in duration-300">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
});
