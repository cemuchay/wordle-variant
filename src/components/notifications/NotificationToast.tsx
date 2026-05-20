import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { type AppNotification } from '../../types/notifications';
import { Z_INDEX } from '../../constants/ui';
import { useApp } from '../../context/AppContext';

export const NotificationToast = memo(() => {
    const [currentNotification, setCurrentNotification] = useState<AppNotification | null>(null);
    const { setIsNotificationsOpen } = useApp();

    useEffect(() => {
        const handleNewNotification = (event: any) => {
            const notification = event.detail as AppNotification;
            setCurrentNotification(notification);

            // Auto-hide after 5 seconds
            const timer = setTimeout(() => {
                setCurrentNotification(null);
            }, 5000);

            return () => clearTimeout(timer);
        };

        window.addEventListener('new-notification', handleNewNotification);
        return () => window.removeEventListener('new-notification', handleNewNotification);
    }, []);

    return (
        <AnimatePresence>
            {currentNotification && (
                <motion.div
                    initial={{ opacity: 0, x: 100, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 100, scale: 0.9 }}
                    className="fixed top-20 right-4 w-72 bg-gray-900/90 backdrop-blur-md border border-correct/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:bg-gray-800 transition-all"
                    style={{ zIndex: Z_INDEX.TOAST }}
                    onClick={() => {
                        setIsNotificationsOpen(true);
                        setCurrentNotification(null);
                    }}
                >
                    <div className="bg-correct/20 p-2 rounded-xl shrink-0">
                        <Bell className="text-correct w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-black uppercase tracking-tight text-white truncate">
                            {currentNotification.title}
                        </h4>
                        <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                            {currentNotification.message}
                        </p>
                    </div>

                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setCurrentNotification(null);
                        }}
                        className="text-gray-500 hover:text-white shrink-0"
                    >
                        <X size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
});
