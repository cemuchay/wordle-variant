import { useState, useEffect, useCallback } from 'react';
import { ANNOUNCEMENTS, type Announcement } from '../data/announcements';
import { safeLocalStorage } from '../utils/storage';

const STORAGE_KEY = 'read-announcements';

export const useAnnouncements = () => {
    const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Find the latest announcement that hasn't been read
        let readIds: string[] = [];
        try {
            const raw = safeLocalStorage.getItem(STORAGE_KEY);
            if (raw) {
                readIds = JSON.parse(raw);
            }
        } catch (e) {
            console.error('Failed to parse read announcements', e);
        }

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

        let readIds: string[] = [];
        try {
            const raw = safeLocalStorage.getItem(STORAGE_KEY);
            if (raw) {
                readIds = JSON.parse(raw);
            }
        } catch (e) {
            console.error('Failed to parse read announcements for markAsRead', e);
        }

        if (!readIds.includes(currentAnnouncement.id)) {
            readIds.push(currentAnnouncement.id);
            try {
                safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(readIds));
            } catch (e) {
                console.error('Failed to save read announcements', e);
            }
        }
        setIsOpen(false);
    }, [currentAnnouncement]);

    return {
        currentAnnouncement,
        isOpen,
        markAsRead
    };
};
