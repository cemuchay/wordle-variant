/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";

export interface Message {
   id: string;
   content: string;
   user_id: string;
   created_at: string;
   reply_to?: string;
   mentions?: string[];
   is_read: boolean;
   profiles: { username: string; avatar_url: string };
}

export const useChat = (userId: string) => {
   const [messages, setMessages] = useState<Message[]>([]);
   const [typingUsers, setTypingUsers] = useState<string[]>([]);
   const channelRef = useRef<any>(null);
   const { setUnreadCount } = useApp();

   const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

   // Get the timestamp from the browser's local storage
   const getLastSeen = () =>
      localStorage.getItem(`lastSeen_${userId}`) || new Date(0).toISOString();

   const typingTimeoutRef = useRef<number | null>(null);

   // Guard to prevent redundant track calls
   const isCurrentlyTypingLocally = useRef(false);

   useEffect(() => {
      if (!userId) return;
      // 1. Fetch messages with timezone conversion via JS Date
      const fetchMessages = async () => {
         const { data } = await supabase
            .from("messages")
            .select("*, profiles(username, avatar_url)")
            .order("created_at", { ascending: true });

         if (data) {
            setMessages(data);
            const lastSeen = getLastSeen();
            // Find messages that are NOT yours and are NEWER than your last visit
            const unreads = data.filter(
               (m) => m.user_id !== userId && m.created_at > lastSeen
            );

            setUnreadCount(unreads.length);
            if (unreads.length > 0) {
               setFirstUnreadId(unreads[0].id);
            }
         }
      };

      fetchMessages();

      const channelId = `chat_${userId.substring(0, 8)}`;

      // 2. Setup Realtime Channel for Messages and Presence
      const channel = supabase.channel(channelId, {
         config: { presence: { key: userId } },
      });

      channel.on(
         "postgres_changes",
         { event: "*", schema: "public", table: "messages" },
         async (payload) => {
            if (payload.eventType === "INSERT") {
               const newMessage = payload.new as Message;

               const { data: profile } = await supabase
                  .from("profiles")
                  .select("username, avatar_url")
                  .eq("id", newMessage.user_id)
                  .single();

               const messageWithProfile = { ...newMessage, profiles: profile };

               setMessages((prev) => {
                  const exists = prev.some((m) => m.id === newMessage.id);

                  if (exists) {
                     // Update the optimistic message with real DB data/profile
                     return prev.map((m) => (m.id === newMessage.id ? messageWithProfile : m));
                  }

                  // Append new message from other users
                  return [...prev, messageWithProfile];
               });
            }
            // Update local state for read receipts
            if (payload.eventType === "UPDATE") {
               setMessages((prev) =>
                  prev.map((m) =>
                     m.id === payload.new.id
                        ? { ...m, is_read: payload.new.is_read }
                        : m
                  )
               );
            }
         }
      );
      channel
         .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            const typingNames = new Set<string>();

            Object.keys(state).forEach((key) => {
               const sessions = state[key] as any[];
               // Sort by timestamp to get the absolute latest intent
               const latest = sessions.sort(
                  (a, b) => (b.ts || 0) - (a.ts || 0)
               )[0];

               if (latest?.isTyping && latest?.username) {
                  typingNames.add(latest.username);
               }
            });

            setTypingUsers(Array.from(typingNames));
         })
         .subscribe();

      channelRef.current = channel;

      return () => {
         channel.unsubscribe();
         supabase.removeChannel(channel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [userId]);

   const setTyping = useCallback((isTyping: boolean, username: string) => {
      if (!channelRef.current) return;

      // 1. If we are stopping (input cleared or message sent)
      if (!isTyping) {
         if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
         isCurrentlyTypingLocally.current = false;
         channelRef.current.track({
            isTyping: false,
            username,
            ts: Date.now(),
         });
         return;
      }

      // 2. If we are starting (First keystroke after being idle)
      if (!isCurrentlyTypingLocally.current) {
         isCurrentlyTypingLocally.current = true;
         channelRef.current.track({ isTyping: true, username, ts: Date.now() });
      }

      // 3. Refresh the 5-second timer regardless
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
         isCurrentlyTypingLocally.current = false;
         channelRef.current?.track({
            isTyping: false,
            username,
            ts: Date.now(),
         });
      }, 2000);
   }, []);

   const sendMessage = async (content: string, replyToId?: string, mentions?: string[]) => {
      if (!content.trim()) return;

      const tempId = crypto.randomUUID();
      const optimisticMessage: Message = {
         id: tempId,
         content,
         user_id: userId,
         created_at: new Date().toISOString(),
         reply_to: replyToId,
         mentions: mentions,
         is_read: false,
         profiles: messages.find(m => m.user_id === userId)?.profiles || { username: 'Me', avatar_url: '' }
      };

      // 1. Add optimistically
      setMessages((prev) => [...prev, optimisticMessage]);

      // 2. Insert to DB
      const { error } = await supabase.from("messages").insert([
         {
            id: tempId,
            content,
            user_id: userId,
            reply_to: replyToId,
            mentions: mentions,
            is_read: false,
         },
      ]);

      // 3. Only handle errors. The Realtime listener handles the success state.
      if (error) {
         setMessages((prev) => prev.filter((m) => m.id !== tempId));
         console.error("Failed to send message:", error);
      }
   };

   const markAsRead = async (messageId: string) => {
      localStorage.setItem(`lastSeen_${userId}`, new Date().toISOString());
      setUnreadCount(0);
      setFirstUnreadId(null);
      await supabase
         .from("messages")
         .update({ is_read: true })
         .eq("id", messageId);
   };

   const [users, setUsers] = useState<{ username: string, avatar_url: string, id: string }[]>([]);

   useEffect(() => {
      const fetchUsers = async () => {
         const { data } = await supabase
            .from("profiles")
            .select("username, avatar_url,id");
         if (data) setUsers(data);
      };
      fetchUsers();
   }, []);

   return { messages, sendMessage, typingUsers, setTyping, markAsRead, firstUnreadId, users };
};
