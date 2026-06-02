/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
   voice_url?: string | null;
   image_url?: string | null;
   is_edited?: boolean;
   is_deleted?: boolean;
   group_id: string;
}

export interface ChatGroup {
   id: string;
   name: string;
   type: 'general' | 'game_analysis' | 'bugs_features' | 'dm' | 'custom';
   created_by?: string;
   created_at: string;
   is_core: boolean;
   dm_partner?: { id: string; username: string; avatar_url: string };
}

// --- Encryption Helpers for DMs (Client-Side E2EE) ---
const rc4EncryptDecrypt = (key: string, str: string): string => {
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
   let res = "";
   for (let y = 0; y < str.length; y++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const temp = s[i];
      s[i] = s[j];
      s[j] = temp;
      const k = s[(s[i] + s[j]) % 256];
      res += String.fromCharCode(str.charCodeAt(y) ^ k);
   }
   return res;
};

const getDMRoomKey = (user1Id: string, user2Id: string): string => {
   const sorted = [user1Id, user2Id].sort().join("-");
   const salt = "wordle-variant-e2ee-secret";
   return `${sorted}-${salt}`;
};

export const encryptDM = (text: string, key: string): string => {
   const enc = rc4EncryptDecrypt(key, text);
   let hex = "";
   for (let i = 0; i < enc.length; i++) {
      hex += enc.charCodeAt(i).toString(16).padStart(2, "0");
   }
   return `e2ee:${hex}`;
};

export const decryptDM = (ciphertext: string, key: string): string => {
   if (!ciphertext.startsWith("e2ee:")) return ciphertext;
   const hex = ciphertext.slice(5);
   let enc = "";
   for (let i = 0; i < hex.length; i += 2) {
      enc += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
   }
   return rc4EncryptDecrypt(key, enc);
};

// --- Image Compression Helper ---
export const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.75): Promise<Blob> => {
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
               quality
            );
         };
         img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
   });
};

// --- Core Custom Hook ---
export const useChat = (userId: string) => {
   const globalMessages = useAppStore((state) => state.globalMessages);
   const [groups, setGroups] = useState<ChatGroup[]>([]);
   const [invites, setInvites] = useState<any[]>([]);
   const [activeRoomId, setActiveRoomId] = useState<string>("00000000-0000-0000-0000-000000000001");
   const [users, setUsers] = useState<{ username: string; avatar_url: string; id: string }[]>([]);
   const [hasPlayedToday, setHasPlayedToday] = useState(false);
   const [dailyGuesses, setDailyGuesses] = useState<any[]>([]);
   
   const [typingUsers, setTypingUsers] = useState<string[]>([]);
   const channelRef = useRef<any>(null);
   const { setUnreadCount, date } = useApp();
   const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
   const typingTimeoutRef = useRef<number | null>(null);
   const isCurrentlyTypingLocally = useRef(false);

   const activeRoom = groups.find(g => g.id === activeRoomId) || null;

   const getLastSeen = useCallback(() =>
      safeLocalStorage.getItem(`lastSeen_${userId}_${activeRoomId}`) || new Date(0).toISOString(), 
      [userId, activeRoomId]
   );

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
      const fetchGuesses = async () => {
         const { data } = await supabase
            .from("scores")
            .select("user_id, guesses, status, profiles(username)")
            .eq("game_date", date);
         if (data) {
            setDailyGuesses(data);
         }
      };
      fetchGuesses();
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
         .select("group_id, status, chat_groups(*, creator:profiles!created_by(username))")
         .eq("user_id", userId);

      const activeGroups: ChatGroup[] = (coreData || []).map(cg => ({
         id: cg.id,
         name: cg.name,
         type: cg.type,
         created_by: cg.created_by,
         created_at: cg.created_at,
         is_core: true
      }));

      const incomingInvites: any[] = [];

      if (memberData) {
         for (const m of memberData) {
            const cg = m.chat_groups as any;
            if (!cg) continue;

            if (m.status === "invited") {
               incomingInvites.push({
                  id: cg.id,
                  name: cg.name,
                  creator: cg.creator?.username || "Someone"
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
                     dmPartner = { id: partner.user_id, username: p.username, avatar_url: p.avatar_url };
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
                  dm_partner: dmPartner
               });
            }
         }
      }

      setGroups(activeGroups);
      setInvites(incomingInvites);
   }, [userId]);

   useEffect(() => {
      fetchGroups();
   }, [fetchGroups]);

   // Realtime Group / Membership Subscriptions
   useEffect(() => {
      if (!userId) return;

      const groupChannel = supabase
         .channel("realtime_chat_structures")
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "chat_group_members", filter: `user_id=eq.${userId}` },
            () => {
               fetchGroups();
            }
         )
         .subscribe();

      return () => {
         groupChannel.unsubscribe();
      };
   }, [userId, fetchGroups]);

   // Filter messages by active group room and decrypt DMs
   const activeMessages = useMemo(() => {
      const filtered = globalMessages.filter((m) => m.group_id === activeRoomId);

      if (activeRoom && activeRoom.type === "dm" && activeRoom.dm_partner) {
         const key = getDMRoomKey(userId, activeRoom.dm_partner.id);
         return filtered.map(m => {
            if (m.content && m.content.startsWith("e2ee:")) {
               return { ...m, content: decryptDM(m.content, key) };
            }
            return m;
         });
      }
      return filtered;
   }, [globalMessages, activeRoomId, activeRoom, userId]);

   // Auto-mark first unread inside the active room
   useEffect(() => {
      if (!userId) return;
      const lastSeen = getLastSeen();
      const unreads = activeMessages.filter(
         (m: any) => m.user_id !== userId && m.created_at > lastSeen
      );
      if (unreads.length > 0 && !firstUnreadId) {
         setFirstUnreadId(unreads[0].id);
      }
   }, [userId, activeMessages, getLastSeen, firstUnreadId]);

   // Presence & typing updates
   useEffect(() => {
      if (!userId || !activeRoomId) return;

      const channelId = `chat_room_${activeRoomId}`;
      const existingChannel = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelId}`);

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
   }, [userId, activeRoomId]);

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

      typingTimeoutRef.current = window.setTimeout(() => {
         isCurrentlyTypingLocally.current = false;
         channelRef.current?.track({ isTyping: false, username, ts: Date.now() });
      }, 2000);
   }, []);

   // Send Message
   const sendMessage = async (content: string, replyToId?: string, mentions?: string[], voiceUrl?: string, imageUrl?: string) => {
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
         profiles: globalMessages.find(m => m.user_id === userId)?.profiles || { username: 'Me', avatar_url: '', id: userId }
      };

      useAppStore.getState().addGlobalMessage(optimisticMessage);

      const { error } = await supabase.from("messages").insert([
         {
            id: tempId,
            content: finalContent,
            user_id: userId,
            reply_to: replyToId,
            mentions: mentions,
            is_read: false,
            voice_url: voiceUrl,
            image_url: imageUrl,
            group_id: activeRoomId
         },
      ]);

      if (error) {
         console.error("Failed to send message:", error);
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
               contentType: 'image/jpeg',
               cacheControl: '3600'
            });

         if (uploadErr) throw uploadErr;

         const { data: { publicUrl } } = supabase.storage
            .from("chat-images")
            .getPublicUrl(fileName);

         // 3. Send message
         await sendMessage("[Image]", undefined, undefined, undefined, publicUrl);
      } catch (err) {
         console.error("Failed to upload/send image:", err);
      }
   };

   // Reaction
   const reactToMessage = async (messageId: string, emoji: string | null) => {
      if (!userId) return;
      const msg = globalMessages.find(m => m.id === messageId);
      if (!msg) return;

      const currentReactions = { ...(msg.reactions || {}) };
      if (emoji) {
         currentReactions[userId] = emoji;
      } else {
         delete currentReactions[userId];
      }

      useAppStore.getState().updateGlobalMessage({ id: messageId, reactions: currentReactions });

      const { error } = await supabase
         .from("messages")
         .update({ reactions: currentReactions })
         .eq("id", messageId);

      if (error) {
         console.error("Failed to react:", error);
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

      useAppStore.getState().updateGlobalMessage({ id: messageId, content: newContent, is_edited: true });

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
         reactions: {} 
      });

      const { error } = await supabase
         .from("messages")
         .update({ 
            content: "🚫 This message was deleted", 
            is_deleted: true, 
            voice_url: null, 
            image_url: null, 
            reactions: {} 
         })
         .eq("id", messageId);

      if (error) {
         console.error("Failed to delete message:", error);
      }
   };

   // Mark room as read
   const markAsRead = async (messageId: string) => {
      safeLocalStorage.setItem(`lastSeen_${userId}_${activeRoomId}`, new Date().toISOString());
      setUnreadCount(0);
      setFirstUnreadId(null);
      await supabase
         .from("messages")
         .update({ is_read: true })
         .eq("id", messageId);
   };

   // Custom group creation
   const createCustomGroup = async (name: string, inviteeIds: string[]): Promise<boolean> => {
      if (inviteeIds.length < 2) {
         alert("Groups must have at least 3 people (including you). Select at least 2 users.");
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
      await supabase.from("chat_group_members").insert([
         { group_id: newGroup.id, user_id: userId, status: "joined" }
      ]);

      // Add other invited users
      const memberInserts = inviteeIds.map(id => ({
         group_id: newGroup.id,
         user_id: id,
         status: "invited"
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

      // 1. Check if DM room already exists between these 2 users
      const { data: matches } = await supabase
         .from("chat_group_members")
         .select("group_id, chat_groups!inner(type)")
         .eq("user_id", userId)
         .eq("chat_groups.type", "dm");

      if (matches && matches.length > 0) {
         const groupIds = matches.map((m: any) => m.group_id);
         const { data: partnerMatch } = await supabase
            .from("chat_group_members")
            .select("group_id")
            .in("group_id", groupIds)
            .eq("user_id", partnerId)
            .maybeSingle();

         if (partnerMatch) {
            setActiveRoomId(partnerMatch.group_id);
            return partnerMatch.group_id;
         }
      }

      // 2. Otherwise create a new DM group
      const { data: newGroup, error: groupErr } = await supabase
         .from("chat_groups")
         .insert([{ name: "Direct Message", type: "dm", created_by: userId }])
         .select()
         .single();

      if (groupErr) return null;

      // Add memberships
      await supabase.from("chat_group_members").insert([
         { group_id: newGroup.id, user_id: userId, status: "joined" },
         { group_id: newGroup.id, user_id: partnerId, status: "joined" }
      ]);

      await fetchGroups();
      setActiveRoomId(newGroup.id);
      return newGroup.id;
   };

   // Get all profiles for user selector
   useEffect(() => {
      const fetchUsers = async () => {
         const { data } = await supabase
            .from("profiles")
            .select("username, avatar_url, id");
         if (data) setUsers(data.filter(u => u.id !== userId));
      };
      fetchUsers();
   }, [userId]);

   return {
      groups,
      invites,
      activeRoom,
      activeRoomId,
      setActiveRoomId,
      messages: activeMessages,
      sendMessage,
      sendImageMessage,
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
      dailyGuesses
   };
};
