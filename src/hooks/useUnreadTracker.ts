import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

export const useUnreadTracker = (userId: string | undefined, isChatOpen: boolean, isAtBottom: boolean) => {
   const { setUnreadCount } = useApp();
   const isChatOpenRef = useRef(isChatOpen);
   const isAtBottomRef = useRef(isAtBottom);

   useEffect(() => {
      isChatOpenRef.current = isChatOpen;
      if (isChatOpen && userId) {
         setUnreadCount(0);
         localStorage.setItem(`lastSeen_${userId}`, new Date().toISOString());
      }
   }, [isChatOpen, userId, setUnreadCount]);

   useEffect(() => {
      isAtBottomRef.current = isAtBottom;
      // If we are at the bottom while chat is open, we should mark messages as seen
      if (isChatOpen && isAtBottom && userId) {
         localStorage.setItem(`lastSeen_${userId}`, new Date().toISOString());
         setUnreadCount(0);
      }
   }, [isAtBottom, isChatOpen, userId, setUnreadCount]);

   const fetchUnreadCount = useCallback(async () => {
      if (!userId) return;
      const lastSeen = localStorage.getItem(`lastSeen_${userId}`) || new Date(0).toISOString();
      
      const { count, error } = await supabase
         .from("messages")
         .select("*", { count: "exact", head: true })
         .neq("user_id", userId)
         .gt("created_at", lastSeen);

      if (!error && count !== null) {
         setUnreadCount(count);
      }
   }, [userId, setUnreadCount]);

   useEffect(() => {
      if (!userId) return;

      // 1. Initial fetch
      fetchUnreadCount();

      // 2. Realtime listener
      const channel = supabase
         .channel("global-unread-tracker")
         .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            (payload) => {
               const newMessage = payload.new;
               if (newMessage.user_id !== userId) {
                  if (!isChatOpenRef.current || !isAtBottomRef.current) {
                     setUnreadCount((prev) => prev + 1);
                  } else {
                     // Chat is open and at bottom, update lastSeen
                     localStorage.setItem(`lastSeen_${userId}`, new Date().toISOString());
                  }
               }
            }
         )
         .subscribe();

      return () => {
         supabase.removeChannel(channel);
      };
   }, [userId, fetchUnreadCount, setUnreadCount]);
};
