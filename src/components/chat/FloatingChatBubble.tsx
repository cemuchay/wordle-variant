/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Search, MessageCircle, X, Send, ArrowLeft, ExternalLink, Edit2, Trash2, Check, CheckCheck, ShieldAlert, Mic, Image as ImageIcon, Smile, Reply, Users } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAppStore } from "../../store/useAppStore";
import { useAuth } from "../../hooks/useAuth";
import { decryptDM, encryptDM, getDMRoomKey, compressImage } from "../../hooks/useChat";
import { supabase } from "../../lib/supabaseClient";
import { editMessage, deleteMessage, reactToMessage } from "../../hooks/chatActions";
import { ConnectedAudioPlayer } from "./ChatMessage/ConnectedAudioPlayer";
import UserSuggestions from "./UserSuggestions";
import { ChatImage } from "./ChatMessage/ChatImage";
import { VoiceControlBar } from "./VoiceControlBar";
import { ProtectedAvatar } from "./ProtectedAvatar";
import { ReactionPicker } from "./ChatMessage/ReactionPicker";
import { ReactionModal } from "./ChatMessage/ReactionModal";
import { ReactionBadge } from "./ChatMessage/ReactionBadge";
import { safeLocalStorage } from "../../utils/storage";
import { ModalLayout } from "../layout/ModalLayout";

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
         const { WAVRecorder } = await import("../chat/MessageInput");
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
         setSelectedGroupId(unreadMessages[unreadMessages.length - 1].group_id);
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
         >
            {/* Header */}
            <div className="px-4 py-3 bg-gray-800/80 border-b border-gray-700/60 flex items-center justify-between shrink-0 -mx-3 -mt-3 mb-2">
               <div className="flex items-center gap-2">
                  {selectedGroupId && (
                     <button
                        onClick={() => setSelectedGroupId(null)}
                        className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                     >
                        <ArrowLeft className="w-4 h-4" />
                     </button>
                  )}
                  <span className="text-xs font-black uppercase tracking-wider text-gray-100">
                     {selectedGroupId ? selectedGroupName : "Conversations"}
                  </span>
               </div>
               <div className="flex items-center gap-1.5">
                  {selectedGroupId && (
                     <button
                        onClick={handleExpand}
                        className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                        title="Open full chat"
                     >
                        <ExternalLink className="w-3.5 h-3.5" />
                     </button>
                  )}
                  <button
                     onClick={() => {
                        setIsOverlayOpen(false);
                        setSelectedGroupId(null);
                     }}
                     className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                     <X className="w-4 h-4" />
                  </button>
               </div>
            </div>

                      {/* Content List */}
                       <div className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0 scrollbar-hide h-full" ref={scrollRef} onScroll={handleScroll}>
                          {!selectedGroupId ? (
                             /* Screen A: Conversation List */
                             <div className="space-y-1.5">
                                {/* Search input */}
                                <div className="relative mb-2">
                                   <input
                                      type="text"
                                      value={conversationSearchQuery}
                                      onChange={(e) => setConversationSearchQuery(e.target.value)}
                                      placeholder="Search conversations..."
                                      className="w-full bg-gray-800/90 border border-gray-700/60 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition-all"
                                   />
                                   <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                                {filteredConversations.length === 0 ? (
                                   <div className="flex flex-col items-center justify-center h-full py-12">
                                      <MessageCircle className="w-8 h-8 text-gray-600 mb-2" />
                                      <p className="text-xs text-gray-500">
                                         {conversationSearchQuery ? "No matching conversations" : "No conversations yet"}
                                      </p>
                                   </div>
                                ) : (
                                    filteredConversations.map(({ group, lastMessage, unreadCount }) => {
                                       const name = group?.name || CORE_GROUPS[group.id] || "Room";
                                       const isCore = CORE_GROUPS[group.id] !== undefined;
                                       const isDM = group?.type === "dm" && !!group?.dm_partner?.avatar_url;
                                       return (
                                          <button
                                             key={group.id}
                                             onClick={() => { setSelectedGroupId(group.id); }}
                                             className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800 border border-gray-800 hover:border-gray-700/60 transition-all cursor-pointer text-left"
                                          >
                                              {isDM ? (
                                                 <ProtectedAvatar
                                                    userId={group.dm_partner!.id}
                                                    src={group.dm_partner!.avatar_url}
                                                    username={name}
                                                    className="w-10 h-10 rounded-full border border-white/10 bg-slate-900 shrink-0"
                                                 />
                                              ) : isCore ? (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-correct text-black font-black shrink-0 text-sm">
                                                   #
                                                </div>
                                             ) : (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white shrink-0">
                                                   <Users size={18} />
                                                </div>
                                             )}
                                            <div className="min-w-0 flex-1">
                                               <div className="flex items-center justify-between">
                                                  <span className="text-xs font-black uppercase text-indigo-400 tracking-wide truncate">
                                                     {name}
                                                  </span>
                                                  {unreadCount > 0 && (
                                                     <span className="bg-rose-500/25 border border-rose-500/20 text-rose-300 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                                        {unreadCount} unread
                                                     </span>
                                                  )}
                                               </div>
                                               <p className="text-[11px] text-gray-400 truncate mt-1">
                                                  {lastMessage.profiles ? `${lastMessage.profiles.username}: ` : ""}
                                                  {lastMessage.voice_url ? (
                                                     <span className="text-indigo-400 font-semibold">🎤 Voice note</span>
                                                  ) : lastMessage.image_url ? (
                                                     <span className="text-indigo-400 font-semibold">📷 Image</span>
                                                  ) : (
                                                     getDecryptedContent(lastMessage)
                                                  )}
                                               </p>
                                            </div>
                                         </button>
                                      );
                                   })
                                )}
                              </div>
                           ) : selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday ? (
                           /* Locked Game Analysis placeholder */
                           <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                              <ShieldAlert className="w-10 h-10 text-red-400 mb-3" />
                              <h4 className="text-sm font-black uppercase text-white tracking-tight mb-1">Analysis Room Locked</h4>
                              <p className="text-xs text-white/50 max-w-60 leading-relaxed">
                                 Complete today's daily puzzle to unlock this discussion.
                              </p>
                           </div>
                        ) : (
                           (
                               <div className="space-y-4">
                                  <VoiceControlBar />
                                  {hasMoreMessages && (
                                     <div className="flex flex-col items-center gap-2 pb-2">
                                       <button onClick={handleExpand} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1 rounded-full transition-colors cursor-pointer">
                                          {allRoomMessages.length - 20}+ older · View full chat
                                       </button>
                                       <div className="h-px w-full bg-white/10" />
                                    </div>
                                 )}
                                 {activeRoomMessages.map((msg: any) => {
                                    const isMe = msg.user_id === user?.id;
                                    const isEditing = editingMessageId === msg.id;
                                    const content = getDecryptedContent(msg);

                                    return (
                                        <div
                                           key={msg.id}
                                           onMouseEnter={() => !isMe && !msg.is_read && handleMarkAsRead(msg.id)}
                                           onTouchStart={() => handleTouchStart(msg.id)}
                                           onTouchEnd={handleTouchEnd}
                                           onTouchMove={handleTouchMove}
                                           onTouchCancel={handleTouchEnd}
                                            className={`relative ${reactingMessageId === msg.id || reactingModalMessageId === msg.id ? 'z-50' : 'z-auto'} overflow-visible`}
                                       >
                                          {/* Unread divider */}
                                          {msg.id === visibleUnreadId && showUnreadLine && (
                                             <motion.div
                                                id="fb-unread-line"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex items-center my-4 gap-3 px-2"
                                             >
                                                <div className="h-px flex-1 bg-white/20" />
                                                <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] bg-white/10 px-3 py-1 rounded-full border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.08)]">
                                                   Unread Messages
                                                </span>
                                                <div className="h-px flex-1 bg-white/20" />
                                             </motion.div>
                                          )}
                                          {/* Reaction Picker */}
                                          <AnimatePresence>
                                             {reactingMessageId === msg.id && (
                                                <>
                                                   <motion.div
                                                      initial={{ opacity: 0 }}
                                                      animate={{ opacity: 1 }}
                                                      exit={{ opacity: 0 }}
                                                      onClick={() => setReactingMessageId(null)}
                                                      className="fixed inset-0 bg-black/20 z-40"
                                                   />
                                                    <ReactionPicker
                                                       ref={reactionsRef}
                                                       isMe={isMe}
                                                       onReact={(emoji) => handleReact(msg.id, emoji)}
                                                       currentReaction={user?.id ? msg.reactions?.[user.id] : undefined}
                                                       onCopy={() => {
                                                          copyToClipboard(content);
                                                          setReactingMessageId(null);
                                                       }}
                                                       onEdit={isMe && !msg.voice_url && !msg.image_url ? () => { setEditingMessageId(msg.id); setEditText(content); setReactingMessageId(null); } : undefined}
                                                       onDelete={isMe ? () => { handleDeleteMessage(msg.id); setReactingMessageId(null); } : undefined}
                                                    />
                                                </>
                                             )}
                                          </AnimatePresence>

                                          {/* Reaction Details */}
                                          <AnimatePresence>
                                             {showReactionDetailsId === msg.id && msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                <motion.div
                                                   ref={detailsRef}
                                                   initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                   animate={{ opacity: 1, scale: 1, y: 0 }}
                                                   exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                                   className={`absolute bottom-full mb-2 ${isMe ? 'left-0' : 'right-0'} bg-slate-900 border border-white/15 rounded-2xl p-2 shadow-2xl z-50 min-w-[140px] max-w-[200px]`}
                                                   onClick={(e) => e.stopPropagation()}
                                                >
                                                   <div className="flex flex-col gap-1.5">
                                                      {Object.entries(msg.reactions).map(([uid, emoji]) => (
                                                         <div key={uid} className="flex items-center justify-between gap-3 px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                                                             <span className="text-[10px] font-black text-white truncate">
                                                                {getUserName(uid)}
                                                            </span>
                                                            <span className="text-[12px] shrink-0">{emoji as string}</span>
                                                         </div>
                                                      ))}
                                                   </div>
                                                </motion.div>
                                             )}
                                          </AnimatePresence>

                                           <div className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                                              <ProtectedAvatar
                                                 userId={msg.user_id}
                                                 src={msg.profiles?.avatar_url}
                                                 username={msg.profiles?.username}
                                                 className="w-8 h-8 rounded-full border border-white/10 bg-slate-900 shrink-0"
                                              />
                                             <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : ""}`}>
                                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                                   <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                                                      {msg.profiles?.username || "User"}
                                                   </span>
                                                   <span className="text-[8px] text-gray-500 inline-flex items-center gap-1">
                                                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                      {isMe && !msg.is_deleted && (
                                                         msg.status === "sending" ? (
                                                            <span className="animate-spin text-white/50 text-[8px]">⌛</span>
                                                         ) : msg.status === "failed" ? (
                                                            <span className="text-red-400 text-[8px] font-black">⚠️</span>
                                                         ) : (
                                                            <CheckCheck size={10} className={msg.is_read ? "text-blue-400" : "text-white/30"} />
                                                         )
                                                      )}
                                                   </span>
                                                </div>

                                                {isEditing ? (
                                                   <div className="mt-1 flex items-center gap-1.5">
                                                      <input
                                                         type="text"
                                                         value={editText}
                                                         onChange={(e) => setEditText(e.target.value)}
                                                         onKeyDown={(e) => {
                                                            if (e.key === "Enter") handleEditSave(msg.id);
                                                            else if (e.key === "Escape") setEditingMessageId(null);
                                                         }}
                                                         className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                                                      />
                                                      <button
                                                         onClick={() => handleEditSave(msg.id)}
                                                         className="bg-indigo-600 hover:bg-indigo-500 p-1.5 rounded-lg text-white cursor-pointer"
                                                      >
                                                         <Check className="w-3.5 h-3.5" />
                                                      </button>
                                                      <button
                                                         onClick={() => setEditingMessageId(null)}
                                                         className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-gray-400 cursor-pointer"
                                                      >
                                                         <X className="w-3.5 h-3.5" />
                                                      </button>
                                                   </div>
                                                 ) : (
                                                    <div className="relative group/msg pb-2 sm:pb-4">
                                                       {/* Reply preview */}
                                                       {msg.reply_to && !msg.is_deleted && (() => {
                                                          const replyToMsg = allRoomMessages.find((m: any) => m.id === msg.reply_to);
                                                          if (!replyToMsg) return null;
                                                          return (
                                                             <div className={`flex items-center gap-2 mb-1.5 text-[10px] text-white/60 bg-white/5 border-l-2 border-correct/40 px-3 py-1.5 rounded-t-xl max-w-[85%] ${isMe ? 'flex-row-reverse ml-auto' : ''}`}>
                                                                <Reply size={10} className="text-correct shrink-0" />
                                                                <span className="truncate text-gray-400">
                                                                   {replyToMsg.profiles?.username || 'User'}: {replyToMsg.voice_url ? '🎤 Voice note' : replyToMsg.image_url ? '📷 Image' : getDecryptedContent(replyToMsg)}
                                                                </span>
                                                             </div>
                                                          );
                                                       })()}
                                                        {msg.voice_url ? (
                                                          <ConnectedAudioPlayer
                                                             url={msg.voice_url}
                                                             messageId={msg.id}
                                                             allMessageIds={activeRoomMessages.map((m: any) => m.id)}
                                                             allMessages={activeRoomMessages}
                                                             userId={user?.id || ""}
                                                          />
                                                       ) : msg.image_url ? (
                                                          <ChatImage url={msg.image_url} />
                                                       ) : (
                                                         <motion.div
                                                            drag={!msg.is_deleted && !isEditing ? "x" : false}
                                                            dragDirectionLock
                                                            dragConstraints={{ left: 0, right: 0 }}
                                                            dragSnapToOrigin
                                                            dragElastic={{ left: 0, right: 0.6 }}
                                                            onDragEnd={(_, info) => {
                                                               if (info.offset.x > 50) {
                                                                  handleSwipeToReply(msg);
                                                               }
                                                            }}
                                                         >
                                                             <p className={`text-xs text-left text-gray-200 mt-1 leading-relaxed whitespace-pre-wrap break-words px-3 py-2 rounded-2xl ${isMe ? 'bg-indigo-500/15 border-indigo-500/25' : 'bg-white/5 border border-white/5'}`}>
                                                               {getDecryptedContent(msg)}
                                                               {msg.is_edited && (
                                                                  <span className="text-[8px] text-gray-500 ml-1">(edited)</span>
                                                               )}
                                                            </p>
                                                         </motion.div>
                                                      )}

                                                      {/* Action buttons (Reply, React, Edit, Delete) */}
                                                      {!msg.is_deleted && !isEditing && (
                                                         <div className="absolute right-0 top-0 -translate-y-full hidden group-hover/msg:flex items-center gap-1 bg-slate-900 border border-white/10 px-1 py-0.5 rounded-lg shadow-lg">
                                                            <button
                                                               onClick={() => handleReply(msg)}
                                                               className="p-1 hover:text-correct text-gray-400 cursor-pointer"
                                                               title="Reply"
                                                            >
                                                               <Reply className="w-2.5 h-2.5" />
                                                            </button>
                                                            <button
                                                               onClick={() => setReactingMessageId(reactingMessageId === msg.id ? null : msg.id)}
                                                               className="p-1 hover:text-yellow-400 text-gray-400 cursor-pointer"
                                                               title="React"
                                                            >
                                                               <Smile className="w-2.5 h-2.5" />
                                                            </button>
                                                            {isMe && !msg.voice_url && !msg.image_url && (
                                                               <button
                                                                  onClick={() => {
                                                                     setEditingMessageId(msg.id);
                                                                     setEditText(getDecryptedContent(msg));
                                                                  }}
                                                                  className="p-1 hover:text-indigo-400 text-gray-400 cursor-pointer"
                                                                  title="Edit"
                                                               >
                                                                  <Edit2 className="w-2.5 h-2.5" />
                                                               </button>
                                                            )}
                                                            {isMe && (
                                                               <button
                                                                  onClick={() => handleDeleteMessage(msg.id)}
                                                                  className="p-1 hover:text-rose-400 text-gray-400 cursor-pointer"
                                                                  title="Delete"
                                                               >
                                                                  <Trash2 className="w-2.5 h-2.5" />
                                                               </button>
                                                            )}
                                                         </div>
                                                      )}

                                                      {/* Reaction badges */}
                                                      {msg.reactions && Object.keys(msg.reactions).length > 0 && !msg.is_deleted && (
                                                         <ReactionBadge
                                                            reactions={msg.reactions}
                                                            isMe={isMe}
                                                            onShowDetails={() => setShowReactionDetailsId(showReactionDetailsId === msg.id ? null : msg.id)}
                                                         />
                                                      )}
                                                   </div>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           ))}
                     </div>

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
