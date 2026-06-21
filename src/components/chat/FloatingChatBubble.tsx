import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAppStore } from "../../store/useAppStore";
import { useAuth } from "../../hooks/useAuth";
import { decryptDM, encryptDM, getDMRoomKey } from "../../hooks/useChat";
import { supabase } from "../../lib/supabaseClient";

export default function FloatingChatBubble() {
   const { unreadCount, isChatOpen } = useApp();
   const [dismissed, setDismissed] = useState(false);
   const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);
   const [isDragging, setIsDragging] = useState(false);
   const [isNearDismiss, setIsNearDismiss] = useState(false);
   const [isOverlayOpen, setIsOverlayOpen] = useState(false);
   
   const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
   const [isSending, setIsSending] = useState<Record<string, boolean>>({});

   const constraintsRef = useRef<HTMLDivElement>(null);

   const globalMessages = useAppStore((s) => s.globalMessages);
   const readReceipts = useAppStore((s) => s.readReceipts);
   const joinedGroupIds = useAppStore((s) => s.joinedGroupIds);
   const updateReadReceipt = useAppStore((s) => s.updateReadReceipt);
   const { user } = useAuth();

   // Adjust state during render when unreadCount changes
   if (unreadCount !== prevUnreadCount) {
      setPrevUnreadCount(unreadCount);
      if (unreadCount > prevUnreadCount) {
         setDismissed(false); // Reset dismissal on new messages
      }
   }

   const isVisible = unreadCount > 0 && !isChatOpen && !dismissed;

   // Filter out unread messages
   const joinedSet = new Set(joinedGroupIds);
   const unreadMessages = globalMessages.filter((m) => {
      if (!user?.id) return false;
      if (m.user_id === user.id) return false;
      if (!joinedSet.has(m.group_id)) return false;
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

   // Decrypt DM content safely
   const getDecryptedContent = (m: any) => {
      if (!user?.id) return m.content;
      if (m.content && m.content.startsWith("e2ee:")) {
         const key = getDMRoomKey(user.id, m.user_id);
         return decryptDM(m.content, key);
      }
      return m.content;
   };

   // Send reply and mark as read
   const handleSendReply = async (groupId: string, latestMsg: any) => {
      const text = replyTexts[groupId];
      if (!text || !text.trim() || !user?.id) return;

      setIsSending((prev) => ({ ...prev, [groupId]: true }));
      try {
         let finalContent = text;
         const isDM = latestMsg.content && latestMsg.content.startsWith("e2ee:");
         if (isDM) {
            const key = getDMRoomKey(user.id, latestMsg.user_id);
            finalContent = encryptDM(text, key);
         }

         const tempId = crypto.randomUUID();
         const messagePayload = {
            id: tempId,
            content: finalContent,
            user_id: user.id,
            group_id: groupId,
            reply_to: latestMsg.id,
            is_read: false,
         };

         // Insert message via Supabase
         const { error } = await supabase.from("messages").insert([messagePayload]);
         if (error) throw error;

         // Mark group as read immediately
         const timestamp = new Date().toISOString();
         updateReadReceipt(groupId, timestamp);
         await supabase.from("chat_read_receipts").upsert(
            {
               user_id: user.id,
               group_id: groupId,
               last_seen_at: timestamp,
            },
            { onConflict: "user_id,group_id" }
         );

         // Clear input & close overlay
         setReplyTexts((prev) => ({ ...prev, [groupId]: "" }));
         setIsOverlayOpen(false);
         setDismissed(true);
      } catch (err) {
         console.error("Failed to send reply:", err);
      } finally {
         setIsSending((prev) => ({ ...prev, [groupId]: false }));
      }
   };

   // Toggle overlay on bubble click
   const handleBubbleClick = () => {
      if (isDragging) return;
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
      }
      setIsNearDismiss(false);
   };

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
                     className="absolute w-14 h-14 rounded-full bg-slate-950/40 hover:bg-slate-900/60 border border-white/10 shadow-2xl flex items-center justify-center cursor-pointer pointer-events-auto backdrop-blur-md select-none touch-none"
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

         {/* Inline message and reply popover rendered as a centered modal */}
         <AnimatePresence>
            {isOverlayOpen && isVisible && (
               <>
                  {/* Backdrop */}
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     onClick={() => setIsOverlayOpen(false)}
                     className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99990] pointer-events-auto"
                  />

                  {/* Centered Modal Card */}
                  <motion.div
                     initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-40%" }}
                     animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                     exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-40%" }}
                     transition={{ type: "spring", duration: 0.3 }}
                     className="fixed top-1/2 left-1/2 w-[90%] max-w-md max-h-[85vh] bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col pointer-events-auto overflow-hidden z-[99991]"
                  >
                     <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-300">
                           Unread Messages
                        </span>
                        <button
                           onClick={() => setIsOverlayOpen(false)}
                           className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        >
                           <X className="w-4 h-4" />
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh] custom-scrollbar">
                        {Object.keys(groupedUnread).length === 0 ? (
                           <p className="text-xs text-gray-500 text-center py-4">No unread messages</p>
                        ) : (
                           Object.entries(groupedUnread).map(([groupId, msgs]) => {
                              const latestMsg = msgs[msgs.length - 1];
                              const unreadCountInGroup = msgs.length;
                              return (
                                 <div key={groupId} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                    <div className="flex items-start gap-2.5">
                                       <img
                                          src={latestMsg.profiles?.avatar_url || "/default-avatar.png"}
                                          alt={latestMsg.profiles?.username}
                                          className="w-8 h-8 rounded-full border border-white/10 bg-slate-900 object-cover shrink-0"
                                       />
                                       <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between">
                                             <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
                                                {latestMsg.profiles?.username || "User"}
                                             </span>
                                             {unreadCountInGroup > 1 && (
                                                <span className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                   {unreadCountInGroup} messages
                                                </span>
                                             )}
                                          </div>
                                          <p className="text-xs text-gray-200 mt-1 leading-relaxed break-words">
                                             {getDecryptedContent(latestMsg)}
                                          </p>
                                       </div>
                                    </div>
                                    <div className="mt-3 flex items-center gap-1.5">
                                       <input
                                          type="text"
                                          placeholder="Write a reply..."
                                          value={replyTexts[groupId] || ""}
                                          onChange={(e) =>
                                             setReplyTexts((prev) => ({
                                                ...prev,
                                                [groupId]: e.target.value,
                                             }))
                                          }
                                          onKeyDown={(e) => {
                                             if (e.key === "Enter") {
                                                handleSendReply(groupId, latestMsg);
                                             }
                                          }}
                                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                       />
                                       <button
                                          onClick={() => handleSendReply(groupId, latestMsg)}
                                          disabled={!replyTexts[groupId]?.trim() || isSending[groupId]}
                                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors cursor-pointer"
                                       >
                                          <Send className="w-3.5 h-3.5" />
                                       </button>
                                    </div>
                                 </div>
                              );
                           })
                        )}
                     </div>
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
                     className={`w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-2xl transition-colors duration-200 ${
                        isNearDismiss
                           ? "bg-rose-600/90 border-rose-400 text-white"
                           : "bg-slate-900/80 border-white/20 text-gray-400"
                     } backdrop-blur-md`}
                  >
                     <X className="w-6 h-6 animate-pulse" />
                  </div>
                  <span
                     className={`text-[9px] uppercase font-black tracking-widest ${
                        isNearDismiss ? "text-rose-400" : "text-gray-400"
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
