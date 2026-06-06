import { useState, useEffect, useCallback } from "react";
import { ANNOUNCEMENTS } from "../data/announcements";
import { safeLocalStorage } from "../utils/storage";

const STORAGE_KEY = "read-announcements";

export const useAnnouncements = (isAuthenticated: boolean) => {
   const [readIds, setReadIds] = useState<string[]>([]);

   useEffect(() => {
      if (!isAuthenticated) return;
      try {
         const raw = safeLocalStorage.getItem(STORAGE_KEY);
         if (raw) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setReadIds(JSON.parse(raw));
         }
      } catch (e) {
         console.error("Failed to parse read announcements", e);
      }
   }, [isAuthenticated]);

   // Filter valid unread announcements that are within their lifespan (in chronological order)
   const validUnread = isAuthenticated
      ? ANNOUNCEMENTS.filter((a) => {
           if (readIds.includes(a.id)) return false;

           const annDate = new Date(a.date);
           annDate.setHours(0, 0, 0, 0);
           const today = new Date();
           const todayMidnight = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
           );
           const diffTime = todayMidnight.getTime() - annDate.getTime();
           const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
           const lifespan = a.lifespanDays ?? 3;
           return diffDays <= lifespan;
        })
      : [];

   const currentAnnouncement = validUnread[0] || null;
   const isOpen = validUnread.length > 0;

   const markAsRead = useCallback(() => {
      if (!currentAnnouncement) return;

      const newReadIds = [...readIds, currentAnnouncement.id];
      setReadIds(newReadIds);

      try {
         safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(newReadIds));
      } catch (e) {
         console.error("Failed to save read announcements", e);
      }
   }, [currentAnnouncement, readIds]);

   return {
      currentAnnouncement,
      isOpen,
      markAsRead,
   };
};
