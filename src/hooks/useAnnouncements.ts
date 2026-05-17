import { useState, useEffect, useCallback } from 'react';
import { ANNOUNCEMENTS, type Announcement } from '../data/announcements';

const STORAGE_KEY = 'read-announcements';

export const useAnnouncements = () => {
    const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Find the latest announcement that hasn't been read
        const readIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        // Find the latest (last in array) announcement that is unread
        const latestUnread = [...ANNOUNCEMENTS].reverse().find(a => !readIds.includes(a.id));

        if (latestUnread) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCurrentAnnouncement(latestUnread);
            setIsOpen(true);
        }
    }, []);

    const markAsRead = useCallback(() => {
        if (!currentAnnouncement) return;

        const readIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!readIds.includes(currentAnnouncement.id)) {
            readIds.push(currentAnnouncement.id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(readIds));
        }
        setIsOpen(false);
    }, [currentAnnouncement]);

    return {
        currentAnnouncement,
        isOpen,
        markAsRead
    };
};
