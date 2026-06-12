/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../context/AppContext";
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
   voice_url?: string | null;
   image_url?: string | null;
   is_edited?: boolean;
   is_deleted?: boolean;
   group_id: string;
   status?: "sending" | "sent" | "failed";
}

export interface ChatGroup {
   id: string;
   name: string;
   type: "general" | "game_analysis" | "bugs_features" | "dm" | "custom";
   created_by?: string;
   created_at: string;
   is_core: boolean;
   dm_partner?: { id: string; username: string; avatar_url: string };
   dm_key?: string | null;
}

// --- Encryption Helpers for DMs (Client-Side E2EE) ---
// Using RC4 for simple E2EE obfuscation.
// NOTE: For true high-security applications, AES-GCM via WebCrypto is preferred.
const rc4EncryptDecrypt = (key: string, data: Uint8Array): Uint8Array => {
   const s: number[] = [];
   for (let i = 0; i < 256; i++) s[i] = i;
   let j = 0;
   for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      const temp = s[i];
      s[i] = s[j];
      s[j] = temp;
   }
   let i = 0;
   j = 0;
   const res = new Uint8Array(data.length);
   for (let y = 0; y < data.length; y++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const temp = s[i];
      s[i] = s[j];
      s[j] = temp;
      const k = s[(s[i] + s[j]) % 256];
      res[y] = data[y] ^ k;
   }
   return res;
};

export const getDMRoomKey = (user1Id: string, user2Id: string): string => {
   const sorted = [user1Id, user2Id].sort().join("-");
   const salt = "wordle-variant-e2ee-secret";
   return `${sorted}-${salt}`;
};

/**
 * Encrypts DM text using RC4 and hex encoding.
 * Now supports UTF-8 (emojis/special chars) via TextEncoder.
 */
export const encryptDM = (text: string, key: string): string => {
   try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const encryptedData = rc4EncryptDecrypt(key, data);

      // Convert to hex for storage
      let hex = "";
      for (let i = 0; i < encryptedData.length; i++) {
         hex += encryptedData[i].toString(16).padStart(2, "0");
      }
      return `e2ee:${hex}`;
   } catch (e) {
      console.error("Encryption failed:", e);
      return text; // Fallback to plain text if encryption fails
   }
};

/**
 * Decrypts DM text.
 * Safely handles UTF-8 reconstruction via TextDecoder.
 */
export const decryptDM = (ciphertext: string, key: string): string => {
   if (!ciphertext.startsWith("e2ee:")) return ciphertext;
   try {
      const hex = ciphertext.slice(5);
      const encryptedData = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
         encryptedData[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }

      const decryptedData = rc4EncryptDecrypt(key, encryptedData);
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
   } catch (e) {
      console.error("Decryption failed:", e);
      return "[Decryption Error]";
   }
};

// --- Image Compression Helper ---
export const compressImage = (
   file: File,
   maxWidth = 800,
   maxHeight = 800,
   quality = 0.75,
): Promise<Blob> => {
   return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
         const img = new Image();
         img.src = event.target?.result as string;
         img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            if (width > height) {
               if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
               }
            } else {
               if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
               }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
               (blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error("Canvas compression failed"));
               },
               "image/jpeg",
               quality,
            );
         };
         img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
   });
};

const defaultCores: ChatGroup[] = [
   {
      id: "00000000-0000-0000-0000-000000000001",
      name: "General",
      type: "general",
      is_core: true,
      created_at: new Date(0).toISOString(),
   },
   {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Game Analysis",
      type: "game_analysis",
      is_core: true,
      created_at: new Date(0).toISOString(),
   },
   {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Bugs & Features",
      type: "bugs_features",
      is_core: true,
      created_at: new Date(0).toISOString(),
   },
];

// --- Core Custom Hook ---
export const useChat = (userId: string) => {
   const globalMessages = useAppStore((state) => state.globalMessages);
   const readReceipts = useAppStore((state) => state.readReceipts);
   const updateReadReceipt = useAppStore((state) => state.updateReadReceipt);
   const failedMessageIds = useAppStore((state) => state.failedMessageIds);
   const addFailedMessageId = useAppStore((state) => state.addFailedMessageId);
   const removeFailedMessageId = useAppStore(
      (state) => state.removeFailedMessageId,
   );
   const pendingReadReceipts = useAppStore(
      (state) => state.pendingReadReceipts,
   );
   const updatePendingReadReceipt = useAppStore(
      (state) => state.updatePendingReadReceipt,
   );
   const removePendingReadReceipt = useAppStore(
      (state) => state.removePendingReadReceipt,
   );
   const [groups, setGroups] = useState<ChatGroup[]>(() => {
      if (!userId) return defaultCores;
      try {
         const cached = localStorage.getItem(`chat_groups_${userId}`);
         return cached ? JSON.parse(cached) : defaultCores;
      } catch {
         return defaultCores;
      }
   });
   const [invites, setInvites] = useState<any[]>([]);
   const [activeRoomId, setActiveRoomId] = useState<string>(
      "00000000-0000-0000-0000-000000000001",
   );
   const [users, setUsers] = useState<
      { username: string; avatar_url: string; id: string }[]
   >([]);
   const [hasPlayedToday, setHasPlayedToday] = useState(false);
   const [dailyGuesses, setDailyGuesses] = useState<any[]>([]);

   const [typingUsers, setTypingUsers] = useState<string[]>([]);
   const channelRef = useRef<any>(null);
   const { date } = useApp();
   const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
   const typingTimeoutRef = useRef<number | null>(null);
   const isCurrentlyTypingLocally = useRef(false);

   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstUnreadId(null);
   }, [activeRoomId]);

   const activeRoom = groups.find((g) => g.id === activeRoomId) || null;

   // Check if user played today (unlock Game Analysis)
   useEffect(() => {
      if (!userId || !date) return;
      const checkGameStatus = async () => {
         const { data } = await supabase
            .from("scores")
            .select("status")
            .eq("user_id", userId)
            .eq("game_date", date)
            .in("status", ["won", "lost"])
            .maybeSingle();
         setHasPlayedToday(!!data);
      };
      checkGameStatus();
   }, [userId, date]);

   // Fetch guesses of users for today (for mention/tag autocomplete)
   useEffect(() => {
      if (!userId || !date) return;
      let cancelled = false;
      const fetchGuesses = async () => {
         const { data } = await supabase
            .from("scores")
            .select(
               "user_id, guesses, status, profiles(username), hint_record, hints_used, skill_score",
            )
            .eq("game_date", date);
         if (!cancelled && data) {
            setDailyGuesses(data);
         }
      };
      fetchGuesses();
      return () => {
         cancelled = true;
      };
   }, [userId, date]);

   // Fetch groups & invites on load
   const fetchGroups = useCallback(async () => {
      if (!userId) return;

      // 1. Fetch core groups
      const { data: coreData } = await supabase
         .from("chat_groups")
         .select("*")
         .eq("is_core", true);

      // 2. Fetch custom/dm memberships
      const { data: memberData } = await supabase
         .from("chat_group_members")
         .select(
            "group_id, status, chat_groups(*, creator:profiles!created_by(username))",
         )
         .eq("user_id", userId);

      const activeGroups: ChatGroup[] =
         coreData && coreData.length > 0
            ? coreData.map((cg) => ({
                 id: cg.id,
                 name: cg.name,
                 type: cg.type,
                 created_by: cg.created_by,
                 created_at: cg.created_at,
                 is_core: true,
              }))
            : defaultCores;

      const incomingInvites: any[] = [];

      if (memberData) {
         for (const m of memberData) {
            const cg = m.chat_groups as any;
            if (!cg) continue;

            if (m.status === "invited") {
               incomingInvites.push({
                  id: cg.id,
                  name: cg.name,
                  creator: cg.creator?.username || "Someone",
               });
            } else if (m.status === "joined") {
               // If type is DM, resolve the dm partner's profile
               let dmPartner = undefined;
               let groupName = cg.name;

               if (cg.type === "dm") {
                  const { data: partner } = await supabase
                     .from("chat_group_members")
                     .select("user_id, profiles(username, avatar_url)")
                     .eq("group_id", cg.id)
                     .neq("user_id", userId)
                     .maybeSingle();

                  if (partner && partner.profiles) {
                     const p = partner.profiles as any;
                     dmPartner = {
                        id: partner.user_id,
                        username: p.username,
                        avatar_url: p.avatar_url,
                     };
                     groupName = p.username;
                  }
               }

               activeGroups.push({
                  id: cg.id,
                  name: groupName,
                  type: cg.type,
                  created_by: cg.created_by,
                  created_at: cg.created_at,
                  is_core: false,
                  dm_partner: dmPartner,
               });
            }
         }
      }

      setGroups(activeGroups);
      setInvites(incomingInvites);
      useAppStore.getState().setJoinedGroupIds(activeGroups.map((g) => g.id));
      try {
         localStorage.setItem(
            `chat_groups_${userId}`,
            JSON.stringify(activeGroups),
         );
      } catch (error) {
         console.log(error);
      }
   }, [userId]);

   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchGroups();
   }, [fetchGroups]);

   // Realtime Group / Membership Subscriptions
   useEffect(() => {
      if (!userId) return;

      const groupChannel = supabase
         .channel("realtime_chat_structures")
         .on(
            "postgres_changes",
            {
               event: "*",
               schema: "public",
               table: "chat_group_members",
               filter: `user_id=eq.${userId}`,
            },
            () => {
               fetchGroups();
            },
         )
         .subscribe();

      return () => {
         supabase.removeChannel(groupChannel);
      };
   }, [userId, fetchGroups]);

   // Filter messages by active group room and decrypt DMs
   const activeMessages = useMemo(() => {
      const filtered = globalMessages.filter(
         (m) => m.group_id === activeRoomId,
      );

      if (activeRoom && activeRoom.type === "dm" && activeRoom.dm_partner) {
         const key = getDMRoomKey(userId, activeRoom.dm_partner.id);
         return filtered.map((m) => {
            if (m.content && m.content.startsWith("e2ee:")) {
               return { ...m, content: decryptDM(m.content, key) };
            }
            return m;
         });
      }
      return filtered;
   }, [globalMessages, activeRoomId, activeRoom, userId]);

   // Find the first unread message ID when activeRoomId changes
   useEffect(() => {
      if (!userId || !activeRoomId) return;
      const lastSeen = readReceipts[activeRoomId] || new Date(0).toISOString();
      const unreads = activeMessages.filter(
         (m: any) =>
            m.user_id !== userId &&
            new Date(m.created_at).getTime() > new Date(lastSeen).getTime(),
      );
      if (unreads.length > 0) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setFirstUnreadId(unreads[0].id);
      } else {
         setFirstUnreadId(null);
      }
   }, [userId, activeRoomId, readReceipts, activeMessages]);

   // Mark active room as read and update global unreads
   useEffect(() => {
      if (!userId || !activeRoomId) return;

      const lastSeen = readReceipts[activeRoomId] || new Date(0).toISOString();
      const hasUnread = activeMessages.some(
         (m: any) =>
            m.user_id !== userId &&
            new Date(m.created_at).getTime() > new Date(lastSeen).getTime(),
      );
      if (!hasUnread) return;

      const newLastSeen = new Date().toISOString();

      // Optimistically update store
      updateReadReceipt(activeRoomId, newLastSeen);

      // Perform background database update
      supabase
         .from("chat_read_receipts")
         .upsert(
            {
               user_id: userId,
               group_id: activeRoomId,
               last_seen_at: newLastSeen,
            },
            { onConflict: "user_id,group_id" },
         )
         .then(({ error }) => {
            if (error) {
               updatePendingReadReceipt(activeRoomId, newLastSeen);
            } else {
               removePendingReadReceipt(activeRoomId);
            }
         });
   }, [userId, activeRoomId, activeMessages, readReceipts]);

   // Flush pending read receipts on load or network restore
   useEffect(() => {
      if (!userId || Object.keys(pendingReadReceipts).length === 0) return;

      const flushReceipts = async () => {
         const keys = Object.keys(pendingReadReceipts);
         for (const groupId of keys) {
            const timestamp = pendingReadReceipts[groupId];
            const { error } = await supabase.from("chat_read_receipts").upsert(
               {
                  user_id: userId,
                  group_id: groupId,
                  last_seen_at: timestamp,
               },
               { onConflict: "user_id,group_id" },
            );

            if (!error) {
               removePendingReadReceipt(groupId);
            }
         }
      };

      flushReceipts();

      window.addEventListener("online", flushReceipts);
      return () => window.removeEventListener("online", flushReceipts);
   }, [userId, pendingReadReceipts]);

   // Presence & typing updates
   useEffect(() => {
      if (!userId || !activeRoomId) return;

      const channelId = `chat_room_${activeRoomId}`;
      const existingChannel = supabase
         .getChannels()
         .find((c) => (c as any).topic === `realtime:${channelId}`);

      if (existingChannel) {
         supabase.removeChannel(existingChannel);
      }

      const channel = supabase.channel(channelId, {
         config: { presence: { key: userId } },
      });

      channel
         .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            const typingNames = new Set<string>();

            Object.keys(state).forEach((key) => {
               const sessions = state[key] as any[];
               const latest = sessions.sort(
                  (a, b) => (b.ts || 0) - (a.ts || 0),
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
         supabase.removeChannel(channel);
         if (typingTimeoutRef.current)
            window.clearTimeout(typingTimeoutRef.current);
      };
   }, [userId, activeRoomId]);

   const setTyping = useCallback((isTyping: boolean, username: string) => {
      if (!channelRef.current) return;

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

      if (!isCurrentlyTypingLocally.current) {
         isCurrentlyTypingLocally.current = true;
         channelRef.current.track({ isTyping: true, username, ts: Date.now() });
      }

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

   const retryOperation = async (
      operation: () => Promise<any>,
      retries = 3,
      delay = 1000,
   ): Promise<any> => {
      for (let i = 0; i < retries; i++) {
         try {
            const result = await operation();
            return result;
         } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(
               `Operation failed, retrying (${i + 1}/${retries})...`,
               err,
            );
            await new Promise((resolve) =>
               setTimeout(resolve, delay * Math.pow(2, i)),
            );
         }
      }
   };

   const sendWithRetry = async (
      messageId: string,
      messagePayload: any,
      retries = 3,
      delay = 1000,
   ): Promise<boolean> => {
      try {
         await retryOperation(
            async () => {
               const { error } = await supabase
                  .from("messages")
                  .insert([messagePayload]);
               if (error) throw error;
            },
            retries,
            delay,
         );
         return true;
      } catch (err) {
         console.error(`Max retries reached for message ${messageId}:`, err);
         return false;
      }
   };

   // Send Message
   const sendMessage = async (
      content: string,
      replyToId?: string,
      mentions?: string[],
      voiceUrl?: string,
      imageUrl?: string,
   ) => {
      if (!content.trim() && !voiceUrl && !imageUrl) return;

      let finalContent = content;
      if (activeRoom && activeRoom.type === "dm" && activeRoom.dm_partner) {
         const key = getDMRoomKey(userId, activeRoom.dm_partner.id);
         finalContent = encryptDM(content, key);
      }

      const tempId = crypto.randomUUID();
      const optimisticMessage: Message = {
         id: tempId,
         content, // optimistic stores decrypted content
         user_id: userId,
         created_at: new Date().toISOString(),
         reply_to: replyToId,
         mentions: mentions,
         is_read: false,
         voice_url: voiceUrl,
         image_url: imageUrl,
         group_id: activeRoomId,
         status: "sending",
         profiles: globalMessages.find((m) => m.user_id === userId)
            ?.profiles || { username: "Me", avatar_url: "", id: userId },
      };

      useAppStore.getState().addGlobalMessage(optimisticMessage);

      const messagePayload = {
         id: tempId,
         content: finalContent,
         user_id: userId,
         reply_to: replyToId,
         mentions: mentions,
         is_read: false,
         voice_url: voiceUrl,
         image_url: imageUrl,
         group_id: activeRoomId,
      };

      const success = await sendWithRetry(tempId, messagePayload);

      if (success) {
         useAppStore
            .getState()
            .updateGlobalMessage({ id: tempId, status: "sent" });
      } else {
         useAppStore
            .getState()
            .updateGlobalMessage({ id: tempId, status: "failed" });
         addFailedMessageId(tempId);
         useAppStore
            .getState()
            .triggerToast("Failed to send message. Tap to retry.", 4000);
      }
   };

   // Resend Message
   const resendMessage = async (messageId: string) => {
      const msg = globalMessages.find((m) => m.id === messageId);
      if (!msg) return;

      // Prevent sending local blob URLs to the database
      if (
         msg.voice_url?.startsWith("blob:") ||
         msg.image_url?.startsWith("blob:")
      ) {
         useAppStore
            .getState()
            .triggerToast("Cannot resend media. Please upload again.", 4000);
         return;
      }

      useAppStore
         .getState()
         .updateGlobalMessage({ id: messageId, status: "sending" });
      removeFailedMessageId(messageId);

      let finalContent = msg.content;
      if (activeRoom && activeRoom.type === "dm" && activeRoom.dm_partner) {
         const key = getDMRoomKey(userId, activeRoom.dm_partner.id);
         finalContent = encryptDM(msg.content, key);
      }

      const messagePayload = {
         id: messageId,
         content: finalContent,
         user_id: userId,
         reply_to: msg.reply_to,
         mentions: msg.mentions,
         is_read: false,
         voice_url: msg.voice_url,
         image_url: msg.image_url,
         group_id: msg.group_id,
      };

      const success = await sendWithRetry(messageId, messagePayload);

      if (success) {
         useAppStore
            .getState()
            .updateGlobalMessage({ id: messageId, status: "sent" });
      } else {
         useAppStore
            .getState()
            .updateGlobalMessage({ id: messageId, status: "failed" });
         addFailedMessageId(messageId);
         useAppStore.getState().triggerToast("Resend failed.", 4000);
      }
   };

   // Upload & send voice note
   const sendVoiceMessage = async (blob: Blob) => {
      const tempId = crypto.randomUUID();
      const tempUrl = URL.createObjectURL(blob); // Temporary local URL for optimistic UI

      const optimisticMessage: Message = {
         id: tempId,
         content: "[Voice Message]",
         user_id: userId,
         created_at: new Date().toISOString(),
         voice_url: tempUrl,
         group_id: activeRoomId,
         status: "sending",
         is_read: false,
         profiles: globalMessages.find((m) => m.user_id === userId)
            ?.profiles || { username: "Me", avatar_url: "", id: userId },
      };

      useAppStore.getState().addGlobalMessage(optimisticMessage);

      try {
         const fileName = `${userId}/${Date.now()}.ogg`;

         // 1. Upload to storage with retry
         await retryOperation(async () => {
            const { error: uploadErr } = await supabase.storage
               .from("voice-notes")
               .upload(fileName, blob, {
                  contentType: "audio/ogg; codecs=opus",
                  cacheControl: "3600",
               });
            if (uploadErr) throw uploadErr;
         });

         const {
            data: { publicUrl },
         } = supabase.storage.from("voice-notes").getPublicUrl(fileName);

         // 2. Persist to database with retry
         const messagePayload = {
            id: tempId,
            content: "[Voice Message]",
            user_id: userId,
            is_read: false,
            voice_url: publicUrl,
            group_id: activeRoomId,
         };

         const success = await sendWithRetry(tempId, messagePayload);

         if (success) {
            useAppStore.getState().updateGlobalMessage({
               id: tempId,
               status: "sent",
               voice_url: publicUrl,
            });
         } else {
            throw new Error(
               "Failed to persist voice message record after retries",
            );
         }
      } catch (err) {
         console.error("Failed to upload/send voice message:", err);
         useAppStore
            .getState()
            .updateGlobalMessage({ id: tempId, status: "failed" });
         addFailedMessageId(tempId);
         useAppStore
            .getState()
            .triggerToast("Failed to send voice note.", 4000);
      }
   };

   // Upload & send image
   const sendImageMessage = async (file: File) => {
      try {
         // 1. Compress Image
         const compressedBlob = await compressImage(file);
         const fileName = `${userId}/${Date.now()}.jpg`;

         // 2. Upload to storage
         const { error: uploadErr } = await supabase.storage
            .from("chat-images")
            .upload(fileName, compressedBlob, {
               contentType: "image/jpeg",
               cacheControl: "3600",
            });

         if (uploadErr) throw uploadErr;

         const {
            data: { publicUrl },
         } = supabase.storage.from("chat-images").getPublicUrl(fileName);

         // 3. Send message
         await sendMessage(
            "[Image]",
            undefined,
            undefined,
            undefined,
            publicUrl,
         );
      } catch (err) {
         console.error("Failed to upload/send image:", err);
      }
   };

   // Reaction
   const reactToMessage = async (messageId: string, emoji: string | null) => {
      if (!userId) return;
      
      // Optimistic UI: update global store immediately
      const msg = globalMessages.find((m) => m.id === messageId);
      if (!msg) return;

      const currentReactions = { ...(msg.reactions || {}) };
      if (emoji) {
         currentReactions[userId] = emoji;
      } else {
         delete currentReactions[userId];
      }

      useAppStore
         .getState()
         .updateGlobalMessage({ id: messageId, reactions: currentReactions });

      // Resilience: Use RPC call for atomic DB update
      const { error } = await supabase.rpc("toggle_message_reaction", {
         p_message_id: messageId,
         p_user_id: userId,
         p_emoji: emoji
      });

      if (error) {
         console.error("Failed to react resiliently:", error);
         // Optionally rollback optimistic UI if it's a persistent failure
      }
   };

   // Edit message
   const editMessage = async (messageId: string, newContent: string) => {
      if (!userId || !newContent.trim()) return;

      let finalContent = newContent;
      if (activeRoom && activeRoom.type === "dm" && activeRoom.dm_partner) {
         const key = getDMRoomKey(userId, activeRoom.dm_partner.id);
         finalContent = encryptDM(newContent, key);
      }

      useAppStore.getState().updateGlobalMessage({
         id: messageId,
         content: newContent,
         is_edited: true,
      });

      const { error } = await supabase
         .from("messages")
         .update({ content: finalContent, is_edited: true })
         .eq("id", messageId);

      if (error) {
         console.error("Failed to edit:", error);
      }
   };

   // Delete message
   const deleteMessage = async (messageId: string) => {
      if (!userId) return;

      useAppStore.getState().updateGlobalMessage({
         id: messageId,
         content: "🚫 This message was deleted",
         is_deleted: true,
         voice_url: null,
         image_url: null,
         reactions: {},
      });

      const { error } = await supabase
         .from("messages")
         .update({
            content: "🚫 This message was deleted",
            is_deleted: true,
            voice_url: null,
            image_url: null,
            reactions: {},
         })
         .eq("id", messageId);

      if (error) {
         console.error("Failed to delete message:", error);
      }
   };

   // Mark room as read
   const markAsRead = async (messageId: string) => {
      const newLastSeen = new Date().toISOString();

      // Optimistically update store
      updateReadReceipt(activeRoomId, newLastSeen);

      // Perform background database update
      supabase
         .from("chat_read_receipts")
         .upsert(
            {
               user_id: userId,
               group_id: activeRoomId,
               last_seen_at: newLastSeen,
            },
            { onConflict: "user_id,group_id" },
         )
         .then(({ error }) => {
            if (error) {
               // Fail silently
            }
         });

      setFirstUnreadId(null);
      await supabase
         .from("messages")
         .update({ is_read: true })
         .eq("id", messageId);
   };

   // Custom group creation
   const createCustomGroup = async (
      name: string,
      inviteeIds: string[],
   ): Promise<boolean> => {
      if (inviteeIds.length < 2) {
         alert(
            "Groups must have at least 3 people (including you). Select at least 2 users.",
         );
         return false;
      }

      // Create Group
      const { data: newGroup, error: groupErr } = await supabase
         .from("chat_groups")
         .insert([{ name, type: "custom", created_by: userId }])
         .select()
         .single();

      if (groupErr) {
         alert(groupErr.message);
         return false;
      }

      // Add self as joined member
      await supabase
         .from("chat_group_members")
         .insert([
            { group_id: newGroup.id, user_id: userId, status: "joined" },
         ]);

      // Add other invited users
      const memberInserts = inviteeIds.map((id) => ({
         group_id: newGroup.id,
         user_id: id,
         status: "invited",
      }));

      await supabase.from("chat_group_members").insert(memberInserts);
      fetchGroups();
      return true;
   };

   // Accept invitation
   const acceptInvite = async (groupId: string) => {
      const { error } = await supabase
         .from("chat_group_members")
         .update({ status: "joined" })
         .eq("group_id", groupId)
         .eq("user_id", userId);
      if (!error) fetchGroups();
   };

   // Decline invitation
   const declineInvite = async (groupId: string) => {
      const { error } = await supabase
         .from("chat_group_members")
         .update({ status: "declined" })
         .eq("group_id", groupId)
         .eq("user_id", userId);
      if (!error) fetchGroups();
   };

   // Delete custom group
   const deleteGroup = async (groupId: string) => {
      const { error } = await supabase
         .from("chat_groups")
         .delete()
         .eq("id", groupId)
         .eq("created_by", userId);
      if (!error) {
         setActiveRoomId("00000000-0000-0000-0000-000000000001");
         fetchGroups();
      }
   };

   // Start DM room
   const startDM = async (partnerId: string): Promise<string | null> => {
      if (partnerId === userId) return null;
      const dmKey = [userId, partnerId].sort().join(":");

      // 1. Check if DM room already exists using the dm_key
      const { data: existingGroup } = await supabase
         .from("chat_groups")
         .select("id")
         .eq("dm_key", dmKey)
         .maybeSingle();

      if (existingGroup) {
         setActiveRoomId(existingGroup.id);
         return existingGroup.id;
      }

      // 2. Otherwise create a new DM group
      const { data: newGroup, error: groupErr } = await supabase
         .from("chat_groups")
         .insert([{ name: "Direct Message", type: "dm", created_by: userId }])
         .select()
         .single();

      if (groupErr) return null;

      // Add memberships
      // Note: The SQL trigger will automatically populate the dm_key on the 2nd membership insert
      await supabase.from("chat_group_members").insert([
         { group_id: newGroup.id, user_id: userId, status: "joined" },
         { group_id: newGroup.id, user_id: partnerId, status: "joined" },
      ]);

      await fetchGroups();
      setActiveRoomId(newGroup.id);
      return newGroup.id;
   };

   // Get all profiles for user selector
   useEffect(() => {
      let cancelled = false;
      const fetchUsers = async () => {
         const { data } = await supabase
            .from("profiles")
            .select("username, avatar_url, id");
         if (!cancelled && data) setUsers(data.filter((u) => u.id !== userId));
      };
      fetchUsers();
      return () => {
         cancelled = true;
      };
   }, [userId]);

   return {
      groups,
      invites,
      activeRoom,
      activeRoomId,
      setActiveRoomId,
      messages: activeMessages,
      sendMessage,
      resendMessage,
      failedMessageIds,
      sendImageMessage,
      sendVoiceMessage,
      reactToMessage,
      editMessage,
      deleteMessage,
      typingUsers,
      setTyping,
      markAsRead,
      firstUnreadId,
      createCustomGroup,
      acceptInvite,
      declineInvite,
      deleteGroup,
      startDM,
      users,
      hasPlayedToday,
      dailyGuesses,
   };
};
