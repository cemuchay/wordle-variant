/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { MessageCircle, X, Send, ArrowLeft, ExternalLink, Edit2, Trash2, Check, ShieldAlert, Mic, Image as ImageIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAppStore } from "../../store/useAppStore";
import { useAuth } from "../../hooks/useAuth";
import { decryptDM, encryptDM, getDMRoomKey } from "../../hooks/useChat";
import { supabase } from "../../lib/supabaseClient";
import { AudioPlayer } from "./ChatMessage/AudioPlayer";

const CLOSE_DELAY = 10000;

export default function FloatingChatBubble() {
   const { unreadCount, isChatOpen, date } = useApp();
   const [dismissed, setDismissed] = useState(false);
   const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);
   const [isDragging, setIsDragging] = useState(false);
   const [isNearDismiss, setIsNearDismiss] = useState(false);
   const [isOverlayOpen, setIsOverlayOpen] = useState(false);

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

    // Voice note recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<number | null>(null);
    const wavRecorderRef = useRef<any>(null);

    const closeBubbleAfterDelay = () => {
       setTimeout(() => {
          setIsOverlayOpen(false);
          setDismissed(true);
          setSelectedGroupId(null);
       }, CLOSE_DELAY);
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

    const handleSendVoice = async (blob: Blob) => {
       if (!user?.id || !selectedGroupId) return;
       setIsSending(true);
       try {
          const mimeType = blob.type || "audio/wav";
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
           closeBubbleAfterDelay();
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
          const { compressImage } = await import("../../hooks/useChat");
          const compressedBlob = await compressImage(file);
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
           closeBubbleAfterDelay();
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
   const setPreviewImage = useAppStore((s) => s.setPreviewImage);
   const { user } = useAuth();

   // Core group constant names
   const CORE_GROUPS: Record<string, string> = {
      "00000000-0000-0000-0000-000000000001": "General",
      "00000000-0000-0000-0000-000000000002": "Game Analysis",
      "00000000-0000-0000-0000-000000000003": "Bugs & Features"
   };

   // Sync groups list — fast local cache then server fetch
   useEffect(() => {
      if (!user?.id) return;

      // Read cached groups synchronously for instant display
      try {
         const cached = localStorage.getItem(`chat_groups_${user.id}`);
         if (cached) {
            setGroups(JSON.parse(cached));
         }
      } catch (e) { }

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

   // Mark all unread messages as read when the bubble overlay opens
   useEffect(() => {
      if (!isOverlayOpen || !user?.id) return;
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

   // Reset dismissal state on new unread message
   if (unreadCount !== prevUnreadCount) {
      setPrevUnreadCount(unreadCount);
      if (unreadCount > prevUnreadCount) {
         setDismissed(false);
      }
   }

   const isVisible = unreadCount > 0 && !isChatOpen && !dismissed;

   // Filter out unread messages globally
   const joinedSet = new Set(joinedGroupIds);
   const unreadMessages = globalMessages.filter((m) => {
      if (!user?.id) return false;
      if (m.user_id === user.id) return false;
      if (!joinedSet.has(m.group_id)) return false;
      // Game Analysis is locked if user hasn't played today
      if (!hasPlayedToday && m.group_id === "00000000-0000-0000-0000-000000000002") return false;
      const lastSeen = readReceipts[m.group_id] || new Date(0).toISOString();
      return new Date(m.created_at).getTime() > new Date(lastSeen).getTime();
   });

   // Group unread messages by group_id
   const groupedUnread = unreadMessages.reduce((acc: Record<string, typeof unreadMessages>, m) => {
      if (!acc[m.group_id]) {
         acc[m.group_id] = [];
      }
      acc[m.group_id].push(m);
      return acc;
   }, {});

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
         const messagePayload = {
            id: tempId,
            content: finalContent,
            user_id: user.id,
            group_id: selectedGroupId,
            is_read: false,
         };

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
           closeBubbleAfterDelay();
      } catch (err) {
         console.error("Failed to send reply:", err);
      } finally {
         setIsSending(false);
      }
   };

   // Edit Message
   const handleEditSave = async (messageId: string) => {
      if (!editText.trim() || !user?.id || !selectedGroupId) return;

      try {
         const group = groups.find(g => g.id === selectedGroupId);
         const isDM = group?.type === "dm";
         let finalContent = editText;

         if (isDM && group?.dm_partner) {
            const key = getDMRoomKey(user.id, group.dm_partner.id);
            finalContent = encryptDM(editText, key);
         }

         useAppStore.getState().updateGlobalMessage({
            id: messageId,
            content: editText,
            is_edited: true,
         });

         const { error } = await supabase
            .from("messages")
            .update({ content: finalContent, is_edited: true })
            .eq("id", messageId);
         if (error) throw error;

         setEditingMessageId(null);
         setEditText("");
      } catch (e) {
         console.error("Edit failed:", e);
      }
   };

   // Delete Message
   const handleDeleteMessage = async (messageId: string) => {
      if (!user?.id) return;

      try {
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
         if (error) throw error;
      } catch (e) {
         console.error("Delete failed:", e);
      }
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
      if (unreadMessages.length === 1) {
         setSelectedGroupId(unreadMessages[0].group_id);
      } else {
         setSelectedGroupId(null);
      }
      setIsOverlayOpen((prev) => !prev);
   };

   const handleDragStart = () => {
      setIsDragging(true);
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
   };

   // Filter messages context for the active room in popover
   const activeRoomMessages = globalMessages
      .filter(m => m.group_id === selectedGroupId)
      .slice(-10);

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
                     initial={{ scale: 0, opacity: 0, x: window.innerWidth - 80, y: 120 }}
                     animate={{
                        scale: 1,
                        opacity: 1,
                        transition: { type: "spring", stiffness: 260, damping: 20 },
                     }}
                     exit={{ scale: 0, opacity: 0 }}
                     onClick={handleBubbleClick}
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     className="absolute w-10 h-10 rounded-full bg-slate-950/40 hover:bg-slate-900/60 border border-white/10 shadow-2xl flex items-center justify-center cursor-pointer pointer-events-auto backdrop-blur-md select-none touch-none"
                     style={{
                        zIndex: 99999,
                     }}
                  >
                     <MessageCircle className="w-7 h-7 text-white" />
                     {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[11px] h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md">
                           {unreadCount}
                        </span>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </div>

         {/* Centered Modal Popover */}
         <AnimatePresence>
            {isOverlayOpen && isVisible && (
               <>
                  {/* Backdrop */}
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     onClick={() => {
                        setIsOverlayOpen(false);
                        setSelectedGroupId(null);
                     }}
                     className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99990] pointer-events-auto"
                  />

                  {/* Centered Modal Card */}
                  <motion.div
                     initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-40%" }}
                     animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                     exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-40%" }}
                     transition={{ type: "spring", duration: 0.3 }}
                     className="fixed top-1/2 left-1/2 w-[92%] max-w-md h-[80vh] max-h-[550px] bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col pointer-events-auto overflow-hidden z-[99991]"
                  >
                     {/* Header */}
                     <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                           {selectedGroupId && (
                              <button
                                 onClick={() => setSelectedGroupId(null)}
                                 className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                 <ArrowLeft className="w-4 h-4" />
                              </button>
                           )}
                           <span className="text-xs font-black uppercase tracking-wider text-gray-200">
                              {selectedGroupId ? selectedGroupName : "Conversations"}
                           </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           {selectedGroupId && (
                              <button
                                 onClick={handleExpand}
                                 className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
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
                              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                           >
                              <X className="w-4 h-4" />
                           </button>
                        </div>
                     </div>

                     {/* Content List */}
                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" ref={scrollRef}>
                        {!selectedGroupId ? (
                           /* Screen A: Conversation List */
                           Object.keys(groupedUnread).length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full py-12">
                                 <MessageCircle className="w-8 h-8 text-gray-600 mb-2" />
                                 <p className="text-xs text-gray-500">No unread messages</p>
                              </div>
                           ) : (
                              <div className="space-y-1">
                                 {Object.entries(groupedUnread).map(([groupId, msgs]) => {
                                    const groupObj = groups.find(g => g.id === groupId);
                                    const name = groupObj?.name || CORE_GROUPS[groupId] || msgs[0]?.profiles?.username || "Room";
                                    const avatar = groupObj?.dm_partner?.avatar_url || msgs[0]?.profiles?.avatar_url || "/default-avatar.png";
                                    const latestMsg = msgs[msgs.length - 1];

                                    return (
                                       <button
                                          key={groupId}
                                          onClick={() => setSelectedGroupId(groupId)}
                                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left border border-transparent hover:border-white/5"
                                       >
                                          <img
                                             src={avatar}
                                             alt={name}
                                             className="w-10 h-10 rounded-full border border-white/10 bg-slate-900 object-cover shrink-0"
                                          />
                                          <div className="min-w-0 flex-1">
                                             <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase text-indigo-400 tracking-wide truncate">
                                                   {name}
                                                </span>
                                                <span className="bg-rose-500/25 border border-rose-500/20 text-rose-300 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                                   {msgs.length} unread
                                                </span>
                                             </div>
                                             <p className="text-[11px] text-gray-400 truncate mt-1">
                                                {latestMsg.profiles ? `${latestMsg.profiles.username}: ` : ""}
                                                {latestMsg.voice_url ? (
                                                   <span className="text-indigo-400 font-semibold">🎤 Voice note</span>
                                                ) : latestMsg.image_url ? (
                                                   <span className="text-indigo-400 font-semibold">📷 Image</span>
                                                ) : (
                                                   getDecryptedContent(latestMsg)
                                                )}
                                             </p>
                                          </div>
                                       </button>
                                    );
                                 })}
                              </div>
                           )
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
                           /* Screen B: Detailed Chat view (Last 10 messages) */
                           <div className="space-y-4">
                              {activeRoomMessages.map((msg: any) => {
                                 const isMe = msg.user_id === user?.id;
                                 const isEditing = editingMessageId === msg.id;

                                 return (
                                    <div key={msg.id} className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                                       <img
                                          src={msg.profiles?.avatar_url || "/default-avatar.png"}
                                          alt={msg.profiles?.username}
                                          className="w-8 h-8 rounded-full border border-white/10 bg-slate-900 object-cover shrink-0"
                                       />
                                       <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : ""}`}>
                                          <div className="flex items-baseline gap-1.5 flex-wrap">
                                             <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                                                {msg.profiles?.username || "User"}
                                             </span>
                                             <span className="text-[8px] text-gray-500">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                             <div className="relative group/msg">
                                                {msg.voice_url ? (
                                                   <AudioPlayer url={msg.voice_url} />
                                                ) : msg.image_url ? (
                                                   <div
                                                      className="mt-1 relative overflow-hidden rounded-xl border border-white/10 group cursor-pointer max-w-full"
                                                      onClick={() => setPreviewImage(msg.image_url)}
                                                   >
                                                      <img
                                                         src={msg.image_url}
                                                         className="max-h-60 w-auto rounded-xl hover:scale-102 transition-transform duration-300"
                                                         alt="shared file"
                                                      />
                                                   </div>
                                                ) : (
                                                   <p className={`text-xs text-gray-200 mt-1 leading-relaxed break-words px-3 py-2 rounded-2xl bg-white/5 border border-white/5`}>
                                                      {getDecryptedContent(msg)}
                                                      {msg.is_edited && (
                                                         <span className="text-[8px] text-gray-500 ml-1">(edited)</span>
                                                      )}
                                                   </p>
                                                )}

                                                {/* Edit/Delete options for my messages */}
                                                {isMe && !msg.is_deleted && (
                                                   <div className="absolute right-0 top-0 -translate-y-full hidden group-hover/msg:flex items-center gap-1 bg-slate-900 border border-white/10 px-1 py-0.5 rounded-lg shadow-lg">
                                                      {!msg.voice_url && !msg.image_url && (
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
                                                      <button
                                                         onClick={() => handleDeleteMessage(msg.id)}
                                                         className="p-1 hover:text-rose-400 text-gray-400 cursor-pointer"
                                                         title="Delete"
                                                      >
                                                         <Trash2 className="w-2.5 h-2.5" />
                                                      </button>
                                                   </div>
                                                )}
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        )}
                     </div>

                     {/* Reply footer for detailed chat screen */}
                     {selectedGroupId && !(selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday) && (
                        <div className="p-3 bg-white/5 border-t border-white/10 flex flex-col gap-2 shrink-0">
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
                                 <input
                                    type="text"
                                    placeholder="Write a reply..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={(e) => {
                                       if (e.key === "Enter") handleSendReply();
                                    }}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
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
                  </motion.div>
               </>
            )}
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
