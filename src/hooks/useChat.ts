/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
import { safeLocalStorage } from "../utils/storage";
import { useAppStore } from "../store/useAppStore";

export interface Message {
   id: string;
   content: string;
   user_id: string;
   created_at: string;
   reply_to?: string;
   mentions?: string[];
   is_read: boolean;
   profiles: { username: string; avatar_url: string; id: string };
   reactions?: Record<string, string>; // userId -> emoji
   voice_url?: string;
}

export const useChat = (userId: string) => {
   const messages = useAppStore((state) => state.globalMessages);
   const [typingUsers, setTypingUsers] = useState<string[]>([]);
   const channelRef = useRef<any>(null);
   const { setUnreadCount } = useApp();

   const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

   // Get the timestamp from the browser's local storage
   const getLastSeen = useCallback(() =>
      safeLocalStorage.getItem(`lastSeen_${userId}`) || new Date(0).toISOString(), [userId]);

   const typingTimeoutRef = useRef<number | null>(null);

   // Guard to prevent redundant track calls
   const isCurrentlyTypingLocally = useRef(false);

   useEffect(() => {
      if (!userId) return;

      // Find first unread message on mount/load
      const lastSeen = getLastSeen();
      const unreads = messages.filter(
         (m) => m.user_id !== userId && m.created_at > lastSeen
      );
      if (unreads.length > 0 && !firstUnreadId) {
         setFirstUnreadId(unreads[0].id);
      }
   }, [userId, messages, getLastSeen, firstUnreadId]);

   useEffect(() => {
      if (!userId) return;

      const channelId = "chat_global";

      // Setup Realtime Channel for Presence only (messages inserts are handled globally in AppContext)
      const existingChannel = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelId}`);

      if (existingChannel) {
         supabase.removeChannel(existingChannel);
      }

      const channel = supabase.channel(channelId, {
         config: { presence: { key: userId } },
      });

      let mounted = true;

      channel
         .on("presence", { event: "sync" }, () => {
            if (!mounted) return;
            const state = channel.presenceState();
            const typingNames = new Set<string>();

            Object.keys(state).forEach((key) => {
               const sessions = state[key] as any[];
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
         mounted = false;
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

      typingTimeoutRef.current = window.setTimeout(() => {
         isCurrentlyTypingLocally.current = false;
         channelRef.current?.track({
            isTyping: false,
            username,
            ts: Date.now(),
         });
      }, 2000);
   }, []);

   const sendMessage = async (content: string, replyToId?: string, mentions?: string[], voiceUrl?: string) => {
      if (!content.trim() && !voiceUrl) return;

      const tempId = crypto.randomUUID();
      const optimisticMessage: Message = {
         id: tempId,
         content,
         user_id: userId,
         created_at: new Date().toISOString(),
         reply_to: replyToId,
         mentions: mentions,
         is_read: false,
         voice_url: voiceUrl,
         profiles: messages.find(m => m.user_id === userId)?.profiles || { username: 'Me', avatar_url: '', id: userId }
      };

      // 1. Add optimistically
      useAppStore.getState().addGlobalMessage(optimisticMessage);

      // 2. Insert to DB
      const { error } = await supabase.from("messages").insert([
         {
            id: tempId,
            content,
            user_id: userId,
            reply_to: replyToId,
            mentions: mentions,
            is_read: false,
            voice_url: voiceUrl,
         },
      ]);

      // 3. Only handle errors. The Realtime listener handles the success state.
      if (error) {
         // Note: We don't remove optimistic messages here immediately because
         // the real-time sync will overwrite/clean up, but we could filter it out if required:
         // setMessages(prev => prev.filter(m => m.id !== tempId));
         console.error("Failed to send message:", error);
      }
   };

   const reactToMessage = async (messageId: string, emoji: string | null) => {
      if (!userId) return;
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return;

      const currentReactions = { ...(msg.reactions || {}) };
      if (emoji) {
         currentReactions[userId] = emoji;
      } else {
         delete currentReactions[userId];
      }

      // Optimistic update
      useAppStore.getState().updateGlobalMessage({ id: messageId, reactions: currentReactions });

      const { error } = await supabase
         .from("messages")
         .update({ reactions: currentReactions })
         .eq("id", messageId);

      if (error) {
         console.error("Failed to react to message:", error);
      }
   };

   const uploadVoiceNote = async (blob: Blob): Promise<string> => {
      const fileName = `${userId}/${Date.now()}.ogg`;
      const { error } = await supabase.storage
         .from("voice-notes")
         .upload(fileName, blob, {
            contentType: 'audio/ogg',
            cacheControl: '3600'
         });
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
         .from("voice-notes")
         .getPublicUrl(fileName);
      return publicUrl;
   };

   const sendVoiceMessage = async (audioBlob: Blob) => {
      try {
         const publicUrl = await uploadVoiceNote(audioBlob);
         await sendMessage("[Voice Note]", undefined, undefined, publicUrl);
      } catch (err) {
         console.error("Failed to send voice message:", err);
      }
   };

   const markAsRead = async (messageId: string) => {
      safeLocalStorage.setItem(`lastSeen_${userId}`, new Date().toISOString());
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

   return { messages, sendMessage, reactToMessage, sendVoiceMessage, typingUsers, setTyping, markAsRead, firstUnreadId, users };
};
