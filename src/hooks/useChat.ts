/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export interface Message {
   id: string;
   content: string;
   user_id: string;
   created_at: string;
   reply_to?: string;
   mentions?: string[];
   is_read: boolean;
   profiles: { username: string; avatar_url: string; id: string };
}

export const useChat = (userId?: string, isChatOpen: boolean = false) => {
   const [messages, setMessages] = useState<Message[]>([]);
   const [typingUsers, setTypingUsers] = useState<string[]>([]);
   const [isAtBottom, setIsAtBottom] = useState(true);
   const channelRef = useRef<any>(null);

   const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

   const typingTimeoutRef = useRef<number | null>(null);
   const isCurrentlyTypingLocally = useRef(false);

   // 1. Fetch messages only when chat is open
   useEffect(() => {
      if (!userId || !isChatOpen) {
         if (!isChatOpen) setMessages([]); // Clear messages when closed to save memory
         return;
      }

      const fetchMessages = async () => {
         const { data } = await supabase
            .from("messages")
            .select("*, profiles(username, avatar_url)")
            .order("created_at", { ascending: true });

         if (data) {
            setMessages(data);
            
            // Identify first unread for the UI divider
            const lastSeen = localStorage.getItem(`lastSeen_${userId}`) || new Date(0).toISOString();
            const firstUnread = data.find(m => m.user_id !== userId && m.created_at > lastSeen);
            if (firstUnread) setFirstUnreadId(firstUnread.id);
         }
      };

      fetchMessages();
   }, [userId, isChatOpen]);

   // 2. Realtime Channel for Presence (always active for logged in users)
   // and Messages (only updates state when open)
   useEffect(() => {
      if (!userId) return;

      const channelId = `chat_global`; // Use a consistent channel for everyone
      const channel = supabase.channel(channelId, {
         config: { presence: { key: userId } },
      });

      channel.on(
         "postgres_changes",
         { event: "*", schema: "public", table: "messages" },
         async (payload) => {
            if (payload.eventType === "INSERT") {
               const newMessage = payload.new as Message;

               // Only process full message update if chat is open
               if (isChatOpen) {
                  const { data: profile } = await supabase
                     .from("profiles")
                     .select("username, avatar_url")
                     .eq("id", newMessage.user_id)
                     .single();

                  const messageWithProfile = { ...newMessage, profiles: profile };

                  setMessages((prev: any[]) => {
                     const exists = prev.some((m) => m.id === newMessage.id);
                     if (exists) {
                        return prev.map((m: any) => (m.id === newMessage.id ? messageWithProfile : m));
                     }
                     return [...prev, messageWithProfile];
                  });
               }
            }
            
            if (payload.eventType === "UPDATE" && isChatOpen) {
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
               const latest = sessions.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];

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
   }, [userId, isChatOpen]);

   const setTyping = useCallback((isTyping: boolean, username: string) => {
      if (!channelRef.current) return;

      if (!isTyping) {
         if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
         isCurrentlyTypingLocally.current = false;
         channelRef.current.track({ isTyping: false, username, ts: Date.now() });
         return;
      }

      if (!isCurrentlyTypingLocally.current) {
         isCurrentlyTypingLocally.current = true;
         channelRef.current.track({ isTyping: true, username, ts: Date.now() });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
         isCurrentlyTypingLocally.current = false;
         channelRef.current?.track({ isTyping: false, username, ts: Date.now() });
      }, 2000);
   }, []);

   const sendMessage = async (content: string, replyToId?: string, mentions?: string[]) => {
      if (!content.trim() || !userId) return;

      const tempId = crypto.randomUUID();
      const optimisticMessage: Message = {
         id: tempId,
         content,
         user_id: userId,
         created_at: new Date().toISOString(),
         reply_to: replyToId,
         mentions: mentions,
         is_read: false,
         profiles: messages.find(m => m.user_id === userId)?.profiles || { username: 'Me', avatar_url: '', id: userId }
      };

      setMessages((prev) => [...prev, optimisticMessage]);

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

      if (error) {
         setMessages((prev) => prev.filter((m) => m.id !== tempId));
         console.error("Failed to send message:", error);
      }
   };

   const markAsRead = async (messageId: string) => {
      await supabase
         .from("messages")
         .update({ is_read: true })
         .eq("id", messageId);
   };

   const [users, setUsers] = useState<{ username: string, avatar_url: string, id: string }[]>([]);

   useEffect(() => {
      const fetchUsers = async () => {
         const { data } = await supabase.from("profiles").select("username, avatar_url, id");
         if (data) setUsers(data);
      };
      fetchUsers();
   }, []);

   return { 
      messages, 
      sendMessage, 
      typingUsers, 
      setTyping, 
      markAsRead, 
      firstUnreadId, 
      users, 
      isAtBottom, 
      setIsAtBottom 
   };
};
