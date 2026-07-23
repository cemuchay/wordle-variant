/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PanInfo } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, MessageCircle, Mic, Reply, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { deleteMessage, editMessage, reactToMessage } from "../../../hooks/chatActions";
import { useAuth } from "../../../hooks/useAuth";
import { compressImage, decryptDM, encryptDM, getDMRoomKey } from "../../../hooks/useChat";
import { supabase } from "../../../lib/supabaseClient";
import { useAppStore } from "../../../store/useAppStore";
import { safeLocalStorage } from "../../../utils/storage";
import { ModalLayout } from "../../layout/ModalLayout";
import { ReactionModal } from "../ChatMessage/ReactionModal";
import { ProtectedAvatar } from "../ProtectedAvatar";
import UserSuggestions from "../UserSuggestions";
import FloatingContentList from "./components/FloatingContentList";
import FloatingHeader from "./components/FloatingHeader";

const CLOSE_DELAY = 10000;

// Core group constant names
const CORE_GROUPS: Record<string, string> = {
   "00000000-0000-0000-0000-000000000001": "General",
   "00000000-0000-0000-0000-000000000002": "Game Analysis",
   "00000000-0000-0000-0000-000000000003": "Bugs & Features"
};

export default function FloatingChatBubble() {
   const { unreadCount, isChatOpen, date } = useApp();
   const [dismissed, setDismissed] = useState(false);
   const [conversationSearchQuery, setConversationSearchQuery] = useState("");
   const [isDragging, setIsDragging] = useState(false);
   const [isNearDismiss, setIsNearDismiss] = useState(false);
   const [isOverlayOpen, setIsOverlayOpen] = useState(false);
   const overlayOpenedAtRef = useRef<number>(0);
   const prevOverlayOpenRef = useRef(false);

   const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);

   // Synchronize status bar theme-color meta tag with Challenge mode bg-gray-900 when floating bubble is open
   useEffect(() => {
      if (isOverlayOpen) {
         const meta = document.querySelector('meta[name="theme-color"]');
         const prevColor = meta?.getAttribute('content') || '#121213';
         if (meta) meta.setAttribute('content', '#111827');
         return () => {
            if (meta) meta.setAttribute('content', prevColor);
         };
      }
   }, [isOverlayOpen]);

   // Inactivity timer for auto-closing the overlay
   const inactivityTimerRef = useRef<number | null>(null);

   // Bubble position persistence
   const [bubblePos, setBubblePos] = useState(() => {
      try {
         const saved = safeLocalStorage.getItem('floating_bubble_pos');
         if (saved) {
            const pos = JSON.parse(saved) as { x: number; y: number };
            const maxX = window.innerWidth - 40;
            const maxY = window.innerHeight - 40;
            return {
               x: Math.max(0, Math.min(pos.x, maxX)),
               y: Math.max(0, Math.min(pos.y, maxY)),
            };
         }
         // eslint-disable-next-line no-empty
      } catch { }
      return null;
   });
   const dragStartPos = useRef({ x: 0, y: 0 });

   const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
   const [replyText, setReplyText] = useState("");
   const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
   const [editText, setEditText] = useState("");
   const [isSending, setIsSending] = useState(false);

   const [groups, setGroups] = useState<any[]>([]);
   const [hasPlayedToday, setHasPlayedToday] = useState(false);



   const constraintsRef = useRef<HTMLDivElement>(null);
   const scrollRef = useRef<HTMLDivElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const replyInputRef = useRef<HTMLTextAreaElement>(null);

   // Voice note recording states
   const [isRecording, setIsRecording] = useState(false);
   const [recordingTime, setRecordingTime] = useState(0);
   const timerRef = useRef<number | null>(null);
   const wavRecorderRef = useRef<any>(null);

   // Reaction states
   const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
   const [reactingModalMessageId, setReactingModalMessageId] = useState<string | null>(null);
   const [showReactionDetailsId, setShowReactionDetailsId] = useState<string | null>(null);

   // Reply tracking
   const [replyingToMsg, setReplyingToMsg] = useState<any>(null);

   // @ Mentions support
   const [mentionState, setMentionState] = useState<{ isVisible: boolean; filter: string; cursorPosition: number } | null>(null);
   const [profilesList, setProfilesList] = useState<{ id: string; username: string; avatar_url: string }[]>([]);

   // Unread divider state
   const [visibleUnreadId, setVisibleUnreadId] = useState<string | null>(null);
   const [showUnreadLine, setShowUnreadLine] = useState(true);

   const reactionsRef = useRef<HTMLDivElement>(null);
   const detailsRef = useRef<HTMLDivElement>(null);
   const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const hasDraggedRef = useRef(false);
   const longPressMsgIdRef = useRef<string | null>(null);

   // Cleanup long press timeout
   useEffect(() => {
      return () => {
         if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      };
   }, []);

   const handleTouchStart = (msgId: string) => {
      hasDraggedRef.current = false;
      longPressMsgIdRef.current = msgId;
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = setTimeout(() => {
         if (!hasDraggedRef.current && longPressMsgIdRef.current) {
            setReactingModalMessageId(prev => prev === longPressMsgIdRef.current ? null : longPressMsgIdRef.current);
            if (navigator.vibrate) navigator.vibrate(50);
         }
      }, 500);
   };

   const handleTouchEnd = () => {
      if (longPressTimeoutRef.current) {
         clearTimeout(longPressTimeoutRef.current);
         longPressTimeoutRef.current = null;
      }
   };

   const handleTouchMove = () => {
      hasDraggedRef.current = true;
      if (longPressTimeoutRef.current) {
         clearTimeout(longPressTimeoutRef.current);
         longPressTimeoutRef.current = null;
      }
   };

   // Inactivity timer for auto-closing the overlay (not the bubble)
   const clearInactivityTimer = () => {
      if (inactivityTimerRef.current !== null) {
         clearTimeout(inactivityTimerRef.current);
         inactivityTimerRef.current = null;
      }
   };

   const startInactivityTimer = () => {
      clearInactivityTimer();
      inactivityTimerRef.current = window.setTimeout(() => {
         setIsOverlayOpen(false);
         setSelectedGroupId(null);
      }, CLOSE_DELAY);
   };

   // Handle scroll in the messages area
   const handleScroll = () => {
      resetInactivityTimer();
      if (showUnreadLine && visibleUnreadId && scrollRef.current) {
         const el = document.getElementById("fb-unread-line");
         if (el && el.getBoundingClientRect().bottom < 0) {
            setShowUnreadLine(false);
         }
      }
   };

   const resetInactivityTimer = () => {
      if (inactivityTimerRef.current !== null) {
         startInactivityTimer();
      }
   };

   const startRecording = async () => {
      try {
         const { WAVRecorder } = await import("../MessageInput");
         const recorder = new WAVRecorder();
         await recorder.start();
         wavRecorderRef.current = recorder;

         setIsRecording(true);
         setRecordingTime(0);
         timerRef.current = window.setInterval(() => {
            setRecordingTime((prev) => prev + 1);
         }, 1000);
      } catch (err) {
         console.error("Error accessing microphone:", err);
         useAppStore.getState().triggerToast("Could not access microphone.", 4000);
      }
   };

   const stopRecording = async () => {
      if (!wavRecorderRef.current) return;
      const audioBlob = wavRecorderRef.current.stop();
      wavRecorderRef.current = null;
      setIsRecording(false);
      if (timerRef.current) {
         clearInterval(timerRef.current);
         timerRef.current = null;
      }

      if (audioBlob.size < 500) {
         useAppStore.getState().triggerToast("Audio capture failed.", 4000);
      } else {
         await handleSendVoice(audioBlob);
      }
   };

   const cancelRecording = () => {
      if (!wavRecorderRef.current) return;
      wavRecorderRef.current.stop();
      wavRecorderRef.current = null;
      setIsRecording(false);
      if (timerRef.current) {
         clearInterval(timerRef.current);
         timerRef.current = null;
      }
   };

   const formatDuration = (sec: number) => {
      const mins = Math.floor(sec / 60);
      const secs = sec % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
   };

   useEffect(() => {
      return () => {
         if (timerRef.current) {
            clearInterval(timerRef.current);
         }
      };
   }, []);

   // Outside click to close reaction menus
   useEffect(() => {
      if (!reactingMessageId && !showReactionDetailsId) return;
      const handleClickOutside = (e: MouseEvent) => {
         if (reactingMessageId && reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
            setReactingMessageId(null);
         }
         if (showReactionDetailsId && detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
            setShowReactionDetailsId(null);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [reactingMessageId, showReactionDetailsId]);

   // Clear inactivity timer on overlay close or unmount
   useEffect(() => {
      if (!isOverlayOpen) {
         clearInactivityTimer();
      }
   }, [isOverlayOpen]);

   useEffect(() => {
      return () => clearInactivityTimer();
   }, []);

   // Auto-resize textarea after sending
   useEffect(() => {
      if (replyText === "" && replyInputRef.current) {
         replyInputRef.current.style.height = "auto";
      }
   }, [replyText]);

   const handleSendVoice = async (blob: Blob) => {
      if (!user?.id || !selectedGroupId) return;
      setIsSending(true);
      try {
         const mimeType = blob.type || "audio/wav";
         // eslint-disable-next-line react-hooks/purity
         const fileName = `${user.id}/${Date.now()}.wav`;

         // 1. Upload to storage
         const { error: uploadErr } = await supabase.storage
            .from("voice-notes")
            .upload(fileName, blob, {
               contentType: mimeType,
               cacheControl: "3600",
            });

         if (uploadErr) throw uploadErr;

         const {
            data: { publicUrl },
         } = supabase.storage.from("voice-notes").getPublicUrl(fileName);

         // 2. Persist to database
         const messagePayload = {
            id: crypto.randomUUID(),
            content: "[Voice Message]",
            user_id: user.id,
            is_read: false,
            voice_url: publicUrl,
            group_id: selectedGroupId,
         };

         const { error } = await supabase.from("messages").insert([messagePayload]);
         if (error) throw error;

         // Mark group as read immediately
         const timestamp = new Date().toISOString();
         updateReadReceipt(selectedGroupId, timestamp);
         await supabase.from("chat_read_receipts").upsert(
            {
               user_id: user.id,
               group_id: selectedGroupId,
               last_seen_at: timestamp,
            },
            { onConflict: "user_id,group_id" }
         );

         setReplyText("");
         startInactivityTimer();
      } catch (err) {
         console.error("Failed to send voice note:", err);
         useAppStore.getState().triggerToast("Failed to send voice note.", 4000);
      } finally {
         setIsSending(false);
      }
   };

   const handleSendImage = async (file: File) => {
      if (!user?.id || !selectedGroupId) return;
      setIsSending(true);
      try {
         const compressedBlob = await compressImage(file);
         // eslint-disable-next-line react-hooks/purity
         const fileName = `${user.id}/${Date.now()}.jpg`;

         // 1. Upload to storage
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

         // 2. Persist to database
         const messagePayload = {
            id: crypto.randomUUID(),
            content: "[Image]",
            user_id: user.id,
            is_read: false,
            image_url: publicUrl,
            group_id: selectedGroupId,
         };

         const { error } = await supabase.from("messages").insert([messagePayload]);
         if (error) throw error;

         // Mark group as read immediately
         const timestamp = new Date().toISOString();
         updateReadReceipt(selectedGroupId, timestamp);
         await supabase.from("chat_read_receipts").upsert(
            {
               user_id: user.id,
               group_id: selectedGroupId,
               last_seen_at: timestamp,
            },
            { onConflict: "user_id,group_id" }
         );

         setReplyText("");
         startInactivityTimer();
      } catch (err) {
         console.error("Failed to send image:", err);
         useAppStore.getState().triggerToast("Failed to send image.", 4000);
      } finally {
         setIsSending(false);
      }
   };

   const globalMessages = useAppStore((s) => s.globalMessages);
   const readReceipts = useAppStore((s) => s.readReceipts);
   const joinedGroupIds = useAppStore((s) => s.joinedGroupIds);
   const updateReadReceipt = useAppStore((s) => s.updateReadReceipt);
   const { user } = useAuth();

   // Profiles cache for reactor names
   const [profilesCache, setProfilesCache] = useState<Record<string, string>>({});
   useEffect(() => {
      const map: Record<string, string> = {};
      globalMessages.forEach((m: any) => {
         if (m.profiles?.username && m.user_id) {
            map[m.user_id] = m.profiles.username;
         }
      });
      const missing = new Set<string>();
      globalMessages.forEach((m: any) => {
         if (m.reactions) {
            Object.keys(m.reactions).forEach((uid) => {
               if (!map[uid] && uid !== user?.id) missing.add(uid);
            });
         }
      });
      if (missing.size > 0) {
         supabase
            .from("profiles")
            .select("id, username")
            .in("id", Array.from(missing))
            .then(({ data }) => {
               if (data) data.forEach((p: any) => { map[p.id] = p.username; });
               setProfilesCache(map);
            });
      } else {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setProfilesCache(map);
      }
   }, [globalMessages, user?.id]);
   const getUserName = (uid: string) => {
      if (uid === user?.id) return 'You';
      return profilesCache[uid] || uid;
   };

   // Sync groups list — fast local cache then server fetch
   useEffect(() => {
      if (!user?.id) return;

      // Read cached groups synchronously for instant display
      try {
         const cached = localStorage.getItem(`chat_groups_${user.id}`);
         if (cached) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setGroups(JSON.parse(cached));
         }
         // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) { /* empty */ }

      const fetchGroupsData = async () => {
         const { data: memberData } = await supabase
            .from("chat_group_members")
            .select("group_id, status, chat_groups(*)")
            .eq("user_id", user.id)
            .eq("status", "joined");

         if (memberData) {
            const mapped = await Promise.all(memberData.map(async (m) => {
               const cg = m.chat_groups as any;
               if (!cg) return null;

               let groupName = cg.name;
               let dmPartner = undefined;

               if (cg.type === "dm") {
                  const { data: partner } = await supabase
                     .from("chat_group_members")
                     .select("user_id, profiles(username, avatar_url)")
                     .eq("group_id", cg.id)
                     .neq("user_id", user.id)
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
               return {
                  id: cg.id,
                  name: groupName,
                  type: cg.type,
                  dm_partner: dmPartner,
               };
            }));

            // Merge with core groups
            const coreGroupsMapped = Object.entries(CORE_GROUPS).map(([id, name]) => ({
               id,
               name,
               type: id === "00000000-0000-0000-0000-000000000001" ? "general" : id === "00000000-0000-0000-0000-000000000002" ? "game_analysis" : "custom"
            }));

            const allGroups = [...coreGroupsMapped, ...mapped.filter(Boolean)];

            // Deduplicate groups
            const seen = new Set<string>();
            const deduped = allGroups.filter((g) => {
               if (!g) return false;
               if (seen.has(g.id)) return false;
               seen.add(g.id);
               return true;
            });

            setGroups(deduped);
         }
      };

      fetchGroupsData();
   }, [user?.id, globalMessages]);

   // Check if user played today (unlock Game Analysis)
   useEffect(() => {
      if (!user?.id || !date) return;
      const checkGameStatus = async () => {
         const { data } = await supabase
            .from("scores")
            .select("status")
            .eq("user_id", user.id)
            .eq("game_date", date)
            .in("status", ["won", "lost"])
            .maybeSingle();
         setHasPlayedToday(!!data);
      };
      checkGameStatus();
   }, [user?.id, date]);

   // Fetch all profiles for @ mentions
   useEffect(() => {
      if (!user?.id) return;
      supabase
         .from("profiles")
         .select("id, username, avatar_url")
         .then(({ data }) => {
            if (data) setProfilesList(data);
         });
   }, [user?.id]);

   // Mark all unread messages as read when the bubble overlay closes
   useEffect(() => {
      if (isOverlayOpen || !user?.id) {
         prevOverlayOpenRef.current = isOverlayOpen;
         return;
      }
      if (!prevOverlayOpenRef.current) {
         prevOverlayOpenRef.current = false;
         return;
      }
      prevOverlayOpenRef.current = false;

      const state = useAppStore.getState();
      const receipts = state.readReceipts;
      const joined = new Set(state.joinedGroupIds);
      const timestamp = new Date().toISOString();
      const marked = new Set<string>();

      state.globalMessages.forEach((m: any) => {
         if (m.user_id === user.id) return;
         if (!joined.has(m.group_id)) return;
         if (!hasPlayedToday && m.group_id === "00000000-0000-0000-0000-000000000002") return;
         const lastSeen = receipts[m.group_id] || new Date(0).toISOString();
         if (new Date(m.created_at).getTime() > new Date(lastSeen).getTime()) {
            if (!marked.has(m.group_id)) {
               marked.add(m.group_id);
               updateReadReceipt(m.group_id, timestamp);
               supabase
                  .from("chat_read_receipts")
                  .upsert(
                     { user_id: user.id, group_id: m.group_id, last_seen_at: timestamp },
                     { onConflict: "user_id,group_id" }
                  )
                  .then(({ error }) => {
                     if (error) console.error("Failed to mark as read:", error);
                  });
            }
         }
      });
   }, [isOverlayOpen, user?.id, hasPlayedToday, updateReadReceipt]);

   // Auto-scroll detailed message view to bottom
   useEffect(() => {
      if (scrollRef.current) {
         scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
   }, [selectedGroupId, globalMessages]);

   // Re-show bubble on new unread after dismissal
   if (unreadCount !== prevUnreadCount) {
      setPrevUnreadCount(unreadCount);
      if (unreadCount > prevUnreadCount && dismissed) {
         setDismissed(false);
      }
   }

   const isVisible = !isChatOpen && !dismissed;

   // Filter out unread messages globally
   const joinedSet = new Set(joinedGroupIds);
   const unreadMessages = globalMessages.filter((m) => {
      if (!user?.id) return false;
      if (m.user_id === user.id) return false;
      if (!joinedSet.has(m.group_id)) return false;
      if (m.content?.startsWith("[reaction:")) return false;
      // Game Analysis is locked if user hasn't played today
      if (!hasPlayedToday && m.group_id === "00000000-0000-0000-0000-000000000002") return false;
      const lastSeen = readReceipts[m.group_id] || new Date(0).toISOString();
      return new Date(m.created_at).getTime() > new Date(lastSeen).getTime();
   });



   // Unified conversation list: all groups with messages, sorted by latest
   const conversations = (() => {
      const joinedSet = new Set(joinedGroupIds);
      const groupMap = new Map<string, { group: any; lastMessage: any; unreadCount: number }>();
      groups.forEach(g => groupMap.set(g.id, { group: g, lastMessage: null, unreadCount: 0 }));
      globalMessages.forEach((m: any) => {
         if (!user?.id) return;
         if (!joinedSet.has(m.group_id)) return;
         if (!hasPlayedToday && m.group_id === "00000000-0000-0000-0000-000000000002") return;
         const entry = groupMap.get(m.group_id);
         if (!entry) return;
         if (m.user_id !== user.id) {
            const lastSeen = readReceipts[m.group_id] || new Date(0).toISOString();
            if (new Date(m.created_at).getTime() > new Date(lastSeen).getTime()) {
               entry.unreadCount++;
            }
         }
         if (m.content?.startsWith("[reaction:")) return;
         if (!entry.lastMessage || new Date(m.created_at) > new Date(entry.lastMessage.created_at)) {
            entry.lastMessage = m;
         }
      });
      return Array.from(groupMap.values())
         .filter(e => e.lastMessage)
         .sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
   })();

   // Filter conversations by search query
   const filteredConversations = (() => {
      if (!conversationSearchQuery.trim()) return conversations;
      const q = conversationSearchQuery.toLowerCase();
      return conversations.filter(({ group }) => {
         const name = group?.name || CORE_GROUPS[group.id] || "";
         return name.toLowerCase().includes(q);
      });
   })();

   // Smart initials from group name (e.g. "Game Analysis" → "GA", "Bugs & Features" → "B&F")
   const getSmartInitials = (name: string) =>
      name.split(' ').map(w => w[0]?.toUpperCase() || '').join('');

   // Latest unread sender info for the bubble display
   const latestUnreadMsg = unreadMessages[unreadMessages.length - 1] as any;
   const latestUnreadGroup = latestUnreadMsg ? groups.find((g: any) => g.id === latestUnreadMsg.group_id) : null;
   const isLatestDM = latestUnreadGroup?.type === "dm";
   const latestPartner = latestUnreadGroup?.dm_partner as { id: string; username: string; avatar_url: string } | undefined;

   // Resolve DM partner and room key for a message
   const getDecryptedContent = (m: any) => {
      if (!user?.id) return m.content;
      if (m.content && m.content.startsWith("e2ee:")) {
         if (m.user_id === user.id) {
            // Own message — find DM partner from group for correct key
            const group = groups.find(g => g.id === m.group_id);
            const partnerId = group?.dm_partner?.id;
            if (!partnerId) return m.content;
            const key = getDMRoomKey(user.id, partnerId);
            return decryptDM(m.content, key);
         }
         const key = getDMRoomKey(user.id, m.user_id);
         return decryptDM(m.content, key);
      }
      return m.content;
   };

   // Send Message
   const handleSendReply = async () => {
      if (!replyText.trim() || !user?.id || !selectedGroupId) return;
      // Don't allow replies to locked Game Analysis
      if (selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday) return;

      setIsSending(true);
      try {
         const group = groups.find(g => g.id === selectedGroupId);
         const isDM = group?.type === "dm";
         let finalContent = replyText;

         if (isDM && group?.dm_partner) {
            const key = getDMRoomKey(user.id, group.dm_partner.id);
            finalContent = encryptDM(replyText, key);
         }

         const tempId = crypto.randomUUID();
         const mentions: string[] = [];
         profilesList.forEach(u => {
            if (replyText.includes(`@${u.username}`)) {
               mentions.push(u.id);
            }
         });
         const messagePayload: any = {
            id: tempId,
            content: finalContent,
            user_id: user.id,
            group_id: selectedGroupId,
            is_read: false,
         };
         if (mentions.length > 0) {
            messagePayload.mentions = mentions;
         }
         if (replyingToMsg) {
            messagePayload.reply_to = replyingToMsg.id;
         }

         // Insert reply message
         const { error } = await supabase.from("messages").insert([messagePayload]);
         if (error) throw error;

         // Mark group as read immediately
         const timestamp = new Date().toISOString();
         updateReadReceipt(selectedGroupId, timestamp);
         await supabase.from("chat_read_receipts").upsert(
            {
               user_id: user.id,
               group_id: selectedGroupId,
               last_seen_at: timestamp,
            },
            { onConflict: "user_id,group_id" }
         );

         setReplyText("");
         setReplyingToMsg(null);
         startInactivityTimer();
      } catch (err) {
         console.error("Failed to send reply:", err);
      } finally {
         setIsSending(false);
      }
   };

   // Edit Message
   const handleEditSave = async (messageId: string) => {
      if (!editText.trim() || !user?.id || !selectedGroupId) return;
      const group = groups.find(g => g.id === selectedGroupId);
      await editMessage(messageId, editText, user.id, group);
      setEditingMessageId(null);
      setEditText("");
   };

   // Delete Message
   const handleDeleteMessage = async (messageId: string) => {
      if (!user?.id) return;
      await deleteMessage(messageId, user.id);
   };

   // Copy to clipboard
   const copyToClipboard = async (text: string) => {
      try {
         if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
         } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.width = "1px";
            textArea.style.height = "1px";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
               document.execCommand('copy');
            } catch (copyErr) {
               console.error('execCommand copy failed:', copyErr);
            }
            textArea.remove();
         }
         useAppStore.getState().triggerToast("Message copied to clipboard", 2000);
      } catch (err) {
         console.error('Failed to copy:', err);
         useAppStore.getState().triggerToast("Failed to copy message", 2000);
      }
   };

   // Handle reaction
   const handleReact = (msgId: string, emoji: string | null) => {
      if (!user?.id) return;
      reactToMessage(msgId, emoji, user.id);
      setReactingMessageId(null);
   };

   // Handle @ mention user select
   const handleUserSelect = (username: string) => {
      if (!mentionState || !replyInputRef.current) return;
      const lastAt = replyText.lastIndexOf("@", mentionState.cursorPosition - 1);
      const textBeforeAt = replyText.substring(0, lastAt);
      const textAfterCursor = replyText.substring(mentionState.cursorPosition);
      const newText = textBeforeAt + "@" + username + " " + textAfterCursor;
      setReplyText(newText);
      setMentionState(null);
      const newCursorPos = (textBeforeAt + "@" + username + " ").length;
      setTimeout(() => {
         if (replyInputRef.current) {
            replyInputRef.current.focus();
            replyInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
         }
      }, 0);
   };

   // Handle reply
   const handleReply = (msg: any) => {
      setReplyingToMsg(msg);
      // Focus the input
      if (replyInputRef.current) replyInputRef.current.focus();
   };

   // Handle swipe to reply
   const handleSwipeToReply = (msg: any) => {
      handleReply(msg);
   };

   // Open full chat and close popover
   const handleExpand = () => {
      if (!selectedGroupId) return;
      const group = groups.find(g => g.id === selectedGroupId);

      const appState = useAppStore.getState();
      appState.setChatOpen(true);
      if (group?.type === "dm" && group?.dm_partner) {
         appState.setPendingDMUserId(group.dm_partner.id);
      } else {
         appState.setPendingChatGroupId(selectedGroupId);
      }
      setIsOverlayOpen(false);
      setSelectedGroupId(null);
   };

   const handleBubbleClick = () => {
      if (isDragging) return;
      if (unreadMessages.length > 0) {
         const uniqueUnreadGroupIds = Array.from(new Set(unreadMessages.map((m) => m.group_id)));
         if (uniqueUnreadGroupIds.length === 1) {
            setSelectedGroupId(uniqueUnreadGroupIds[0]);
         } else {
            setSelectedGroupId(null);
         }
      } else {
         setSelectedGroupId(null);
      }
      setIsOverlayOpen((prev) => {
         if (!prev) {
            overlayOpenedAtRef.current = Date.now();
            clearInactivityTimer();
         }
         return !prev;
      });
   };

   const handleDragStart = () => {
      setIsDragging(true);
      dragStartPos.current = {
         x: bubblePos?.x ?? window.innerWidth - 80,
         y: bubblePos?.y ?? 120,
      };
   };

   const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const dismissX = window.innerWidth / 2;
      const dismissY = window.innerHeight - 100;
      const distance = Math.sqrt(
         Math.pow(info.point.x - dismissX, 2) + Math.pow(info.point.y - dismissY, 2)
      );
      setIsNearDismiss(distance < 90);
   };

   const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);
      const dismissX = window.innerWidth / 2;
      const dismissY = window.innerHeight - 100;
      const distance = Math.sqrt(
         Math.pow(info.point.x - dismissX, 2) + Math.pow(info.point.y - dismissY, 2)
      );

      if (distance < 90) {
         setDismissed(true);
         setIsOverlayOpen(false);
         setSelectedGroupId(null);
      }
      setIsNearDismiss(false);

      // Persist bubble position
      const finalX = Math.max(0, Math.min(
         dragStartPos.current.x + info.offset.x,
         window.innerWidth - 40,
      ));
      const finalY = Math.max(0, Math.min(
         dragStartPos.current.y + info.offset.y,
         window.innerHeight - 40,
      ));
      const newPos = { x: finalX, y: finalY };
      setBubblePos(newPos);
      safeLocalStorage.setItem('floating_bubble_pos', JSON.stringify(newPos));
   };

   // Filter messages context for the active room in popover
   const allRoomMessages = selectedGroupId
      ? globalMessages.filter(m => m.group_id === selectedGroupId && !m.content?.startsWith("[reaction:"))
      : [];
   const activeRoomMessages = allRoomMessages.slice(-20);
   const hasMoreMessages = allRoomMessages.length > 20;

   // Find first unread message ID for the unread divider
   const lastSeen = selectedGroupId ? readReceipts[selectedGroupId] : null;
   const effectiveLastSeen = lastSeen || new Date(0).toISOString();
   const firstUnreadMsg = activeRoomMessages.find(
      (m: any) => m.user_id !== user?.id && new Date(m.created_at).getTime() > new Date(effectiveLastSeen).getTime(),
   );
   const firstUnreadId = firstUnreadMsg?.id || null;

   // Mark a message as read (hover-based)
   const handleMarkAsRead = (messageId: string) => {
      if (!user?.id || !selectedGroupId) return;
      const timestamp = new Date().toISOString();
      updateReadReceipt(selectedGroupId, timestamp);
      supabase
         .from("chat_read_receipts")
         .upsert(
            { user_id: user.id, group_id: selectedGroupId, last_seen_at: timestamp },
            { onConflict: "user_id,group_id" },
         )
         .then(({ error }) => {
            if (error) console.error("Failed to mark as read:", error);
         });
      supabase
         .from("messages")
         .update({ is_read: true })
         .eq("id", messageId)
         .then(({ error }) => {
            if (error) console.error("Failed to update message read status:", error);
         });
   };

   const hasCapturedDividerRef = useRef(false);

   // Snapshot firstUnreadId for the unread divider
   useEffect(() => {
      if (firstUnreadId && selectedGroupId && !hasCapturedDividerRef.current) {
         hasCapturedDividerRef.current = true;
         setVisibleUnreadId(firstUnreadId);
         setShowUnreadLine(true);
      }
   }, [firstUnreadId, selectedGroupId]);

   // Reset snapshot on room change
   useEffect(() => {
      hasCapturedDividerRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleUnreadId(null);
      setShowUnreadLine(true);
      setMentionState(null);
   }, [selectedGroupId]);

   // Divider visibility: auto-hide after 6s if in view, persist if scrolled below
   useEffect(() => {
      if (!visibleUnreadId || !scrollRef.current) return;

      const raf = requestAnimationFrame(() => {
         const el = document.getElementById("fb-unread-line");
         if (!el || !scrollRef.current) return;

         const rect = el.getBoundingClientRect();
         const containerRect = scrollRef.current.getBoundingClientRect();

         if (rect.top >= containerRect.top && rect.bottom <= containerRect.bottom) {
            // Fully in view — auto-hide after short delay
            const timer = setTimeout(() => setShowUnreadLine(false), 6000);
            cleanupTimers.push(timer);
         }
      });

      const cleanupTimers: number[] = [];
      return () => {
         cancelAnimationFrame(raf);
         cleanupTimers.forEach(clearTimeout);
      };
   }, [visibleUnreadId]);

   const selectedGroupObject = groups.find(g => g.id === selectedGroupId);
   const selectedGroupName = selectedGroupObject?.name || "Conversation";

   return (
      <>
         {/* Drag constraint boundary covering the screen */}
         <div
            ref={constraintsRef}
            className="fixed inset-0 pointer-events-none z-9999 overflow-hidden"
         >
            <AnimatePresence>
               {isVisible && (
                  <motion.div
                     drag
                     dragConstraints={constraintsRef}
                     dragElastic={0.05}
                     dragMomentum={false}
                     onDragStart={handleDragStart}
                     onDrag={handleDrag}
                     onDragEnd={handleDragEnd}
                     initial={{ scale: 0, opacity: 0, x: bubblePos?.x ?? window.innerWidth - 80, y: bubblePos?.y ?? 120 }}
                     animate={{
                        scale: 1,
                        opacity: 1,
                        transition: { type: "spring", stiffness: 260, damping: 20 },
                     }}
                     exit={{ scale: 0, opacity: 0 }}
                     onClick={handleBubbleClick}
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     className="absolute w-10 h-10 rounded-full bg-transparent border-none shadow-lg flex items-center justify-center cursor-pointer pointer-events-auto select-none touch-none"
                     style={{
                        zIndex: 99999,
                     }}
                  >
                     {unreadCount > 0 && latestUnreadMsg ? (
                        isLatestDM && latestPartner ? (
                           <ProtectedAvatar
                              userId={latestPartner.id}
                              src={latestPartner.avatar_url}
                              username={latestPartner.username}
                              className="w-full h-full rounded-full"
                           />
                        ) : (
                           <div className="w-full h-full rounded-full flex items-center justify-center bg-slate-950/40">
                              <span className="text-white font-black text-[11px] uppercase leading-none select-none tracking-tight">
                                 {getSmartInitials(latestUnreadGroup?.name || '') || '?'}
                              </span>
                           </div>
                        )
                     ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center bg-slate-950/40">
                           <MessageCircle className="w-7 h-7 text-white" />
                        </div>
                     )}
                     {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[11px] h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md">
                           {unreadCount}
                        </span>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </div>

         {/* Centered Modal Popover using ModalLayout */}
         <ModalLayout
            isOpen={isOverlayOpen && isVisible}
            onClose={() => {
               setIsOverlayOpen(false);
               setSelectedGroupId(null);
            }}
            maxWidth="md"
            showCloseButton={false}
            zIndex="z-[99991]"
            className="!bg-transparent !h-auto !min-h-0 justify-end"
            containerClassName="!h-[70vh] !max-h-[70vh] !flex-none !my-0 !rounded-t-3xl bg-gray-900/95 border-t border-x border-gray-700/80 shadow-2xl backdrop-blur-xl"
         >
            {/* Header */}
            <FloatingHeader
               selectedGroupId={selectedGroupId} setSelectedGroupId={setSelectedGroupId} selectedGroupName={selectedGroupName} handleExpand={handleExpand} setIsOverlayOpen={setIsOverlayOpen} />

            {/* Content List */}
            <FloatingContentList selectedGroupId={selectedGroupId} conversationSearchQuery={conversationSearchQuery} scrollRef={scrollRef} handleScroll={handleScroll} setConversationSearchQuery={setConversationSearchQuery} filteredConversations={filteredConversations} setSelectedGroupId={setSelectedGroupId} getDecryptedContent={getDecryptedContent} hasPlayedToday={hasPlayedToday} hasMoreMessages={hasMoreMessages} handleExpand={handleExpand} allRoomMessages={allRoomMessages}
               activeRoomMessages={activeRoomMessages} user={user} editingMessageId={editingMessageId} handleMarkAsRead={handleMarkAsRead} handleTouchStart={handleTouchStart} handleTouchEnd={handleTouchEnd} handleTouchMove={handleTouchMove} reactingModalMessageId={reactingModalMessageId}
               reactingMessageId={reactingMessageId} visibleUnreadId={visibleUnreadId} showUnreadLine={showUnreadLine} setReactingMessageId={setReactingMessageId} handleReact={handleReact} reactionsRef={reactionsRef} copyToClipboard={copyToClipboard}
               setEditingMessageId={setEditingMessageId} setEditText={setEditText} handleDeleteMessage={handleDeleteMessage}
               showReactionDetailsId={showReactionDetailsId} detailsRef={detailsRef} getUserName={getUserName} editText={editText} handleEditSave={handleEditSave} handleSwipeToReply={handleSwipeToReply} handleReply={handleReply} setShowReactionDetailsId={setShowReactionDetailsId} />


            {/* Reply footer for detailed chat screen */}
            {selectedGroupId && !(selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday) && (
               <div className="p-3 bg-white/5 border-t border-white/10 flex flex-col gap-2 shrink-0 relative">
                  {selectedGroupObject?.type !== "dm" && (
                     <UserSuggestions
                        users={profilesList}
                        filter={mentionState?.filter || ""}
                        isVisible={!!mentionState?.isVisible}
                        onSelect={handleUserSelect}
                        currentInput={replyText}
                     />
                  )}
                  <input
                     ref={fileInputRef}
                     type="file"
                     accept="image/*"
                     className="hidden"
                     onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                           handleSendImage(file);
                           if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                     }}
                  />

                  {/* Reply preview */}
                  {replyingToMsg && (
                     <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5">
                        <Reply className="w-3 h-3 text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                           <span className="text-[9px] font-black uppercase text-indigo-400">
                              Replying to {replyingToMsg.profiles?.username || "User"}
                           </span>
                           <p className="text-[10px] text-gray-400 truncate">
                              {replyingToMsg.voice_url ? "🎤 Voice note" : replyingToMsg.image_url ? "📷 Image" : getDecryptedContent(replyingToMsg)}
                           </p>
                        </div>
                        <button
                           onClick={() => setReplyingToMsg(null)}
                           className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer shrink-0"
                        >
                           <X className="w-3 h-3" />
                        </button>
                     </div>
                  )}

                  <div className="flex items-center gap-1.5 w-full">
                     {!isRecording && (
                        <button
                           onClick={() => fileInputRef.current?.click()}
                           className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white cursor-pointer transition-colors"
                           title="Send image"
                        >
                           <ImageIcon className="w-4 h-4" />
                        </button>
                     )}

                     {isRecording ? (
                        <div className="flex-1 flex items-center justify-between bg-red-600/10 border border-red-500/20 rounded-xl px-3 py-1.5 text-white">
                           <div className="flex items-center gap-2">
                              <div className="relative w-2 h-2">
                                 <div className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute inset-0" />
                                 <div className="w-2 h-2 bg-red-500 rounded-full absolute inset-0" />
                              </div>
                              <span className="text-[10px] font-black uppercase text-red-400">Rec</span>
                              <span className="text-xs font-black tabular-nums">{formatDuration(recordingTime)}</span>
                           </div>
                           <button
                              onClick={cancelRecording}
                              className="text-white/60 hover:text-red-400 p-1 rounded-full cursor-pointer"
                           >
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                     ) : (
                        <textarea
                           ref={replyInputRef}
                           rows={1}
                           placeholder={replyingToMsg ? "Write a reply..." : "Write a message..."}
                           value={replyText}
                           onChange={(e) => {
                              const value = e.target.value;
                              setReplyText(value);
                              resetInactivityTimer();
                              if (selectedGroupObject?.type !== "dm") {
                                 const cursorPos = e.target.selectionStart;
                                 const textBeforeCursor = value.substring(0, cursorPos);
                                 const lastAtPos = textBeforeCursor.lastIndexOf("@");
                                 if (lastAtPos !== -1) {
                                    const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);
                                    if (!textAfterAt.includes("\n") && !textAfterAt.includes(" ")) {
                                       setMentionState({ isVisible: true, filter: textAfterAt, cursorPosition: cursorPos });
                                    } else {
                                       setMentionState(null);
                                    }
                                 } else {
                                    setMentionState(null);
                                 }
                              } else {
                                 setMentionState(null);
                              }
                           }}
                           onInput={(e) => {
                              e.currentTarget.style.height = 'auto';
                              e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                           }}
                           onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                                 e.preventDefault();
                                 handleSendReply();
                              }
                              if (e.key === 'Escape') {
                                 setMentionState(null);
                              }
                           }}
                           className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none overflow-hidden"
                        />
                     )}

                     {replyText.trim() === "" ? (
                        isRecording ? (
                           <button
                              onClick={stopRecording}
                              className="bg-red-600 text-white p-2.5 rounded-xl cursor-pointer relative"
                              title="Stop and send"
                           >
                              <Send className="w-4 h-4" />
                              <div className="absolute inset-0 bg-red-500 rounded-xl animate-ping opacity-25" />
                           </button>
                        ) : (
                           <button
                              onClick={startRecording}
                              className="bg-correct text-black p-2.5 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all"
                              title="Record voice note"
                           >
                              <Mic className="w-4 h-4" />
                           </button>
                        )
                     ) : (
                        <button
                           onClick={handleSendReply}
                           disabled={!replyText.trim() || isSending}
                           className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-xl transition-colors cursor-pointer"
                        >
                           <Send className="w-4 h-4" />
                        </button>
                     )}
                  </div>
               </div>
            )}
         </ModalLayout>

         {/* Reaction Modal (mobile long-press) */}
         <AnimatePresence>
            {reactingModalMessageId && (() => {
               const modalMsg = activeRoomMessages.find((m: any) => m.id === reactingModalMessageId);
               if (!modalMsg) return null;
               const isMe = modalMsg.user_id === user?.id;
               const content = getDecryptedContent(modalMsg);
               return (
                  <ReactionModal
                     isMe={isMe}
                     onReact={(emoji) => { handleReact(modalMsg.id, emoji); setReactingModalMessageId(null); }}
                     currentReaction={user?.id ? modalMsg.reactions?.[user.id] : undefined}
                     onCopy={() => { copyToClipboard(content); setReactingModalMessageId(null); }}
                     onEdit={isMe && !modalMsg.voice_url && !modalMsg.image_url ? () => { setEditingMessageId(modalMsg.id); setEditText(content); setReactingModalMessageId(null); } : undefined}
                     onDelete={isMe ? () => { handleDeleteMessage(modalMsg.id); setReactingModalMessageId(null); } : undefined}
                     onClose={() => setReactingModalMessageId(null)}
                  />
               );
            })()}
         </AnimatePresence>

         {/* Dismiss Zone overlay at the bottom center */}
         <AnimatePresence>
            {isDragging && isVisible && (
               <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.8 }}
                  animate={{
                     opacity: 1,
                     y: 0,
                     scale: isNearDismiss ? 1.15 : 1,
                     transition: { duration: 0.2 },
                  }}
                  exit={{ opacity: 0, y: 50, scale: 0.8 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 z-9998 flex flex-col items-center gap-1.5 pointer-events-none"
               >
                  <div
                     className={`w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-2xl transition-colors duration-200 ${isNearDismiss
                        ? "bg-rose-600/90 border-rose-400 text-white"
                        : "bg-slate-900/80 border-white/20 text-gray-400"
                        } backdrop-blur-md`}
                  >
                     <X className="w-6 h-6 animate-pulse" />
                  </div>
                  <span
                     className={`text-[9px] uppercase font-black tracking-widest ${isNearDismiss ? "text-rose-400" : "text-gray-400"
                        } bg-slate-950/80 px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-sm`}
                  >
                     Drag here to dismiss
                  </span>
               </motion.div>
            )}
         </AnimatePresence>
      </>
   );
}
