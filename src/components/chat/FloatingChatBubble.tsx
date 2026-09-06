/* eslint-disable react-hooks/refs */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Search, MessageCircle, X, Send, ArrowLeft, ExternalLink, Edit2, Trash2, Check, CheckCheck, ShieldAlert, Mic, Image as ImageIcon, Smile, Reply, Users, Phone, ChevronDown, Plus } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAppStore } from "../../store/useAppStore";
import { TOAST_DURATION } from "../../constants/ui";
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
import { ReactionSplash } from "./ChatMessage/ReactionSplash";
import { safeLocalStorage } from "../../utils/storage";
import { requestNotificationPermission } from "../../utils/notifications";
import { Z_INDEX } from "../../constants/ui";
import { putOutbox, removeOutbox, type OutboxEntry } from "../../utils/outbox";
import { renderEmojiNode } from "../../utils/twemoji";
import { uploadVoiceAsset, uploadImageAsset, insertMessageWithRetry } from "../../utils/messageDelivery";
import { VoiceRecorder } from "../../utils/voiceRecorder";
import { isReactionRow, markGroupsRead, resolveTickState } from "../../utils/readReceipts";
import { sendDirectMessagePushNotification } from "../../lib/clientPush";
import formatLastSeen from "../../utils/formatLastSeen";
import TypingBubble from "./TypingBubble";
import { useTypingPresence } from "../../hooks/useTypingPresence";
import { usePeerReceipts } from "../../hooks/usePeerReceipts";
import MessageInfoModal from "./ChatMessage/MessageInfoModal";

const CLOSE_DELAY = 60000; // 1 full minute
// Desktop docked panel width (anchored beside the bubble)
const PANEL_WIDTH = 380;

// --- Bubble drag boundary configuration ---
// Vertical no-go zones: status bar / dynamic island row at the top,
// app bottom navigation bar + home indicator area at the bottom.
const BUBBLE_SIZE = 40;
const EDGE_MARGIN_X = 8;
const TOP_CLEARANCE = 60;       // px below safe-area-inset-top (dynamic island / header row)
const BOTTOM_NAV_CLEARANCE = 76; // px above viewport bottom edge (AppNavigation + home indicator)

// Reads env(safe-area-inset-*) by measuring an offscreen probe element.
const readSafeAreaInset = (edge: "top" | "bottom"): number => {
   try {
      const probe = document.createElement("div");
      probe.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:${edge === "top" ? "env(safe-area-inset-top, 0px)" : "env(safe-area-inset-bottom, 0px)"};`;
      document.body.appendChild(probe);
      const value = probe.offsetHeight || 0;
      probe.remove();
      return value;
   } catch {
      return 0;
   }
};

// The draggable region for the bubble. The bubble can never rest above minY
// (under the dynamic island / menu row) or below maxY (behind the navbar).
const getBubbleBounds = () => {
   if (typeof window === "undefined") {
      return { minX: 8, maxX: 320, minY: 68, maxY: 600 };
   }
   const insetTop = readSafeAreaInset("top");
   const insetBottom = readSafeAreaInset("bottom");
   const minX = EDGE_MARGIN_X;
   const maxX = Math.max(minX, window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN_X);
   const minY = Math.round(insetTop + TOP_CLEARANCE);
   const maxY = Math.max(
      minY,
      Math.round(window.innerHeight - insetBottom - BOTTOM_NAV_CLEARANCE - BUBBLE_SIZE),
   );
   return { minX, maxX, minY, maxY };
};

// Clamps any position back into the allowed region (out-of-bounds recovery).
const clampToBounds = (pos: { x: number; y: number }) => {
   const b = getBubbleBounds();
   return {
      x: Math.min(Math.max(pos.x, b.minX), b.maxX),
      y: Math.min(Math.max(pos.y, b.minY), b.maxY),
   };
};

// const formatDuration = (seconds: number) => {
//    const mins = Math.floor(seconds / 60);
//    const secs = seconds % 60;
//    return `${mins}:${secs.toString().padStart(2, '0')}`;
// };

// Deterministic distinct color palette for user names & chat bubble highlights in group chats
const USER_COLOR_PALETTE = [
   { name: "text-indigo-400", border: "border-indigo-500/30", bg: "bg-indigo-500/10" },
   { name: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
   { name: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" },
   { name: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10" },
   { name: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/10" },
   { name: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
   { name: "text-pink-400", border: "border-pink-500/30", bg: "bg-pink-500/10" },
   { name: "text-teal-400", border: "border-teal-500/30", bg: "bg-teal-500/10" },
   { name: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
   { name: "text-lime-400", border: "border-lime-500/30", bg: "bg-lime-500/10" },
   { name: "text-fuchsia-400", border: "border-fuchsia-500/30", bg: "bg-fuchsia-500/10" },
   { name: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10" },
];

const getUserChatColor = (userId?: string) => {
   if (!userId) return USER_COLOR_PALETTE[0];
   let hash = 0;
   for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
   }
   const index = Math.abs(hash) % USER_COLOR_PALETTE.length;
   return USER_COLOR_PALETTE[index];
};

// High-performance mention and cross-platform emoji parsing
const MENTION_REGEX = /(@[a-zA-Z0-9_.-]+)/g;

const renderFormattedMessageText = (text: string, currentUsername?: string, isMe?: boolean) => {
   if (!text) return null;
   if (!text.includes("@")) return renderEmojiNode(text);

   const parts = text.split(MENTION_REGEX);
   return parts.map((part, i) => {
      if (part.startsWith("@") && part.length > 1) {
         const mentionName = part.slice(1).toLowerCase();
         const isSelfMention = currentUsername && mentionName === currentUsername.toLowerCase();
         return (
            <span
               key={i}
               className={`font-extrabold px-1 py-0.5 rounded-md ${isSelfMention
                  ? "bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/50 shadow-sm"
                  : isMe
                     ? "bg-white/20 text-white underline underline-offset-2"
                     : "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                  }`}
            >
               {part}
            </span>
         );
      }
      return renderEmojiNode(part, `p-${i}`);
   });
};

interface FloatingChatBubbleProps {
   mode?: "bubble" | "full" | "auto";
   onCloseFull?: () => void;
}

export default function FloatingChatBubble({ mode: propMode, onCloseFull }: FloatingChatBubbleProps = {}) {
   const { unreadCount, isChatOpen, date, profile, onlineUsers, allProfiles, initiatePrivateCall, activeCall, triggerToast } = useApp();
   const isFullMode = propMode === "full" || (propMode !== "bubble" && isChatOpen);

   if (propMode === "bubble" && isChatOpen) {
      return null;
   }

   const [dismissed, setDismissed] = useState(false);
   const [conversationSearchQuery, setConversationSearchQuery] = useState("");
   const [isDragging, setIsDragging] = useState(false);
   const [isNearDismiss, setIsNearDismiss] = useState(false);
   const [isOverlayOpen, setIsOverlayOpen] = useState(false);
   const overlayOpenedAtRef = useRef<number>(0);
   const prevOverlayOpenRef = useRef(false);

   // New Conversation Modals
   const [isCreatingDM, setIsCreatingDM] = useState(false);
   const [isCreatingGroup, setIsCreatingGroup] = useState(false);
   const [dmSearchQuery, setDmSearchQuery] = useState("");
   const [newGroupName, setNewGroupName] = useState("");
   const [selectedGroupUsers, setSelectedGroupUsers] = useState<string[]>([]);
   const [isSubmittingNewConv, setIsSubmittingNewConv] = useState(false);
   const [invites, setInvites] = useState<{ id: string; name: string; creator: string }[]>([]);

   // Incremental pagination (page size: 100 in full view, 25 in bubble mode)
   const [messageLimit, setMessageLimit] = useState(() => (propMode === "full" || isChatOpen ? 100 : 25));

   const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);

   // Inactivity timer for auto-closing the overlay
   const inactivityTimerRef = useRef<number | null>(null);

   // Bubble position persistence
   const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(() => {
      try {
         const saved = safeLocalStorage.getItem('floating_bubble_pos');
         if (saved) {
            const pos = JSON.parse(saved) as { x: number; y: number };
            // Restore clamped into bounds — stale saves (rotation, PWA viewport
            // changes, pre-boundary versions) snap back into the allowed region.
            return clampToBounds(pos);
         }
         // eslint-disable-next-line no-empty
      } catch { }
      return null;
   });
   const dragStartPos = useRef({ x: 0, y: 0 });

   // Live drag coordinates (motion values so out-of-bounds corrections apply
   // instantly without fighting React re-renders mid-drag)
   const bubbleX = useMotionValue(bubblePos?.x ?? (typeof window !== "undefined" ? window.innerWidth - 80 : 320));
   const bubbleY = useMotionValue(bubblePos?.y ?? 120);

   // Draggable region as state so drag constraints stay in sync with viewport
   const [bubbleBounds, setBubbleBounds] = useState(getBubbleBounds);

   // Out-of-bounds recovery: recompute the allowed region whenever the
   // viewport changes (rotation, PWA install, keyboard) and pull the bubble
   // back if it ended up outside it.
   useEffect(() => {
      const recover = () => {
         setBubbleBounds(getBubbleBounds());
         const next = clampToBounds({ x: bubbleX.get(), y: bubbleY.get() });
         if (next.x !== bubbleX.get() || next.y !== bubbleY.get()) {
            bubbleX.set(next.x);
            bubbleY.set(next.y);
            setBubblePos(next);
            safeLocalStorage.setItem('floating_bubble_pos', JSON.stringify(next));
         }
      };
      window.addEventListener('resize', recover);
      window.addEventListener('orientationchange', recover);
      window.visualViewport?.addEventListener('resize', recover);
      return () => {
         window.removeEventListener('resize', recover);
         window.removeEventListener('orientationchange', recover);
         window.visualViewport?.removeEventListener('resize', recover);
      };
   }, [bubbleX, bubbleY]);

   const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
   const [replyText, setReplyText] = useState("");
   const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
   const [editText, setEditText] = useState("");

   // Retry fuel for failed optimistic sends: exact payloads/blobs per message id
   const pendingRetriesRef = useRef<Map<string, { kind: "text"; payload: any; fallbackText: string } | { kind: "voice"; blob: Blob; objectUrl?: string } | { kind: "image"; blob: File; objectUrl?: string }>>(new Map());
   const replyTextRef = useRef("");

   // Desktop gets a docked Messenger-style panel instead of a modal sheet
   const [isDesktop, setIsDesktop] = useState(() =>
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
   );
   const isDesktopRef = useRef(isDesktop);
   useEffect(() => {
      const mq = window.matchMedia("(min-width: 768px)");
      const onChange = () => {
         setIsDesktop(mq.matches);
         isDesktopRef.current = mq.matches;
      };
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
   }, []);

   const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);

   // Desktop panel drag (header handle) — offsets live on motion values and
   // are normalized back into panelPos on release
   const panelDragControls = useDragControls();
   const panelX = useMotionValue(0);
   const panelY = useMotionValue(0);
   const panelDragStartRef = useRef<{ left: number; top: number } | null>(null);

   // Same reachable region the bubble respects: 8px side margins, below the
   // dynamic-island row, above the bottom navigation bar.
   const clampPanelPosition = useCallback((rawLeft: number, rawTop: number) => {
      const insetTop = readSafeAreaInset("top");
      const panelH = Math.min(600, window.innerHeight * 0.72);
      const minX = EDGE_MARGIN_X;
      const maxX = Math.max(minX, window.innerWidth - PANEL_WIDTH - EDGE_MARGIN_X);
      const minY = insetTop + 8;
      const maxY = window.innerHeight - BOTTOM_NAV_CLEARANCE - panelH - 8;
      const left = Math.round(Math.min(Math.max(rawLeft, minX), Math.max(minX, maxX)));
      const top = Math.round(Math.min(Math.max(rawTop, minY), Math.max(minY, maxY)));
      return { left, top };
   }, []);

   // Desktop panels persist while multitasking — close via X or Escape
   useEffect(() => {
      if (!isDesktop || !isOverlayOpen) return;
      const onKey = (e: KeyboardEvent) => {
         if (e.key === "Escape") {
            setIsOverlayOpen(false);
            setSelectedGroupId(null);
         }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
   }, [isDesktop, isOverlayOpen]);

   // Desktop panel anchors next to wherever the bubble currently sits
   const computePanelPosition = useCallback(() => {
      const bx = bubbleX.get();
      const by = bubbleY.get();
      // Prefer the side with room, flipping across the bubble if needed
      let left = bx + BUBBLE_SIZE + 12;
      if (left + PANEL_WIDTH + 8 > window.innerWidth) {
         left = bx - PANEL_WIDTH - 12;
      }
      const top = by - 8;
      return clampPanelPosition(left, top);
   }, [bubbleX, bubbleY, clampPanelPosition]);

   useEffect(() => {
      if (!isOverlayOpen || !isDesktop) return;
      const onResize = () => setPanelPos((p) => (p ? clampPanelPosition(p.left, p.top) : p));
      // Initial anchor on next frame — no synchronous setState in effect body
      const raf = requestAnimationFrame(() => setPanelPos(computePanelPosition()));
      window.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('resize', onResize);
      return () => {
         cancelAnimationFrame(raf);
         window.removeEventListener('resize', onResize);
         window.visualViewport?.removeEventListener('resize', onResize);
      };
   }, [isOverlayOpen, isDesktop, computePanelPosition, clampPanelPosition]);

   const [groups, setGroups] = useState<any[]>([]);
   const [hasPlayedToday, setHasPlayedToday] = useState(false);



   const constraintsRef = useRef<HTMLDivElement>(null);
   const scrollRef = useRef<HTMLDivElement>(null);
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const replyInputRef = useRef<HTMLTextAreaElement>(null);

   // Voice note recording states
   const [isRecording, setIsRecording] = useState(false);
   const [recordingTime, setRecordingTime] = useState(0);
   const timerRef = useRef<number | null>(null);
   const wavRecorderRef = useRef<VoiceRecorder | null>(null);

   // Reaction states
   const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
   const [reactingModalMessageId, setReactingModalMessageId] = useState<string | null>(null);
   const [showReactionDetailsId, setShowReactionDetailsId] = useState<string | null>(null);
   const [activeSplashes, setActiveSplashes] = useState<Record<string, string>>({});

   // Reply tracking
   const [replyingToMsg, setReplyingToMsg] = useState<any>(null);

   // @ Mentions support
   const [mentionState, setMentionState] = useState<{ isVisible: boolean; filter: string; cursorPosition: number } | null>(null);
   const [profilesList, setProfilesList] = useState<{ id: string; username: string; avatar_url: string }[]>([]);

   // In-chat search state
   const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
   const [chatSearchQuery, setChatSearchQuery] = useState("");

   // Scroll-to-latest button visibility state
   const [isScrolledUp, setIsScrolledUp] = useState(false);

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
         if (isDesktopRef.current) return;
         setIsOverlayOpen(false);
         setSelectedGroupId(null);
      }, CLOSE_DELAY);
   };

   // Track whether the unread line was seen in the viewport before hiding on scroll past
   const unreadLineSeenRef = useRef(false);

   // Handle scroll in the messages area
   const handleScroll = () => {
      resetInactivityTimer();
      if (scrollRef.current) {
         const el = scrollRef.current;
         const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
         setIsScrolledUp(distanceFromBottom > 200);
      }
      if (showUnreadLine && visibleUnreadId && scrollRef.current) {
         const el = document.getElementById("fb-unread-line");
         if (el) {
            const rect = el.getBoundingClientRect();
            const containerRect = scrollRef.current.getBoundingClientRect();
            const inView = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
            if (inView) {
               unreadLineSeenRef.current = true;
            } else if (unreadLineSeenRef.current && rect.bottom < containerRect.top) {
               // Only hide if the user actually scrolled down past the seen divider
               setShowUnreadLine(false);
            }
         }
      }
   };

   const scrollToLatest = (smooth = true) => {
      if (messagesEndRef.current) {
         messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
      } else if (scrollRef.current) {
         scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      }
      setIsScrolledUp(false);
   };

   const resetInactivityTimer = () => {
      if (inactivityTimerRef.current !== null) {
         startInactivityTimer();
      }
   };

   const startRecording = async () => {
      try {
         const recorder = new VoiceRecorder();
         await recorder.start({
            onMaxDuration: () => { void stopRecording(); },
         });
         wavRecorderRef.current = recorder;

         setIsRecording(true);
         setRecordingTime(0);
         timerRef.current = window.setInterval(() => {
            setRecordingTime((prev) => prev + 1);
         }, 1000);
      } catch (err) {
         console.error("Error accessing microphone:", err);
         useAppStore.getState().triggerToast("Could not access microphone.", TOAST_DURATION.LONG);
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
         useAppStore.getState().triggerToast("Audio capture failed.", TOAST_DURATION.LONG);
      } else {
         await handleSendVoice(audioBlob);
      }
   };

   const cancelRecording = () => {
      if (!wavRecorderRef.current) return;
      wavRecorderRef.current.cancel();
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

   const markGroupAsRead = (groupId: string) => {
      if (!user?.id) return;
      markGroupsRead(user.id, [groupId]);
   };

   const queueAndDeliver = async (entry: OutboxEntry, deliver: () => Promise<void>) => {
      try {
         await putOutbox(entry);
      } catch (e) {
         console.warn("Failed to persist outbox entry:", e);
      }
      await deliver();
   };

   const handleSendVoice = (blob: Blob) => {
      if (!user?.id || !selectedGroupId) return;
      const uid = user.id;
      const groupId = selectedGroupId;

      const tempId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(blob);

      useAppStore.getState().addGlobalMessage({
         id: tempId,
         content: "[Voice Message]",
         user_id: uid,
         created_at: new Date().toISOString(),
         voice_url: objectUrl,
         group_id: groupId,
         is_read: false,
         status: "sending",
         profiles: { id: uid, username: profile?.username || "User", avatar_url: profile?.avatar_url || "" },
      });
      pendingRetriesRef.current.set(tempId, { kind: "voice", blob, objectUrl });
      startInactivityTimer();

      void queueAndDeliver(
         {
            id: tempId,
            kind: "voice",
            payload: { id: tempId, content: "[Voice Message]", user_id: uid, is_read: false, group_id: groupId },
            blob,
            groupId,
            createdAt: new Date().toISOString(),
         },
         () => deliverVoiceMessage(tempId, blob, groupId),
      );
   };

   const deliverVoiceMessage = async (messageId: string, blob: Blob, groupId: string) => {
      if (!user?.id) return;
      try {
         const publicUrl = await uploadVoiceAsset(user.id, blob);
         await insertMessageWithRetry({
            id: messageId,
            content: "[Voice Message]",
            user_id: user.id,
            is_read: false,
            voice_url: publicUrl,
            group_id: groupId,
         });

         const entry = pendingRetriesRef.current.get(messageId);
         if (entry && entry.kind !== "text" && entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
         pendingRetriesRef.current.delete(messageId);
         useAppStore.getState().updateGlobalMessage({ id: messageId, status: "sent", voice_url: publicUrl });
         removeOutbox(messageId).catch(() => { });

         markGroupAsRead(groupId);

         // Trigger client-side push notification if recipient is offline in a DM
         const currentGroup = groups.find((g) => g.id === groupId);
         if (currentGroup?.type === "dm" && currentGroup?.dm_partner) {
            const partner = currentGroup.dm_partner;
            const isPartnerOnline = onlineUsers?.some((u) => u.id === partner.id);
            void sendDirectMessagePushNotification({
               senderId: user.id,
               senderName: profile?.username || "Someone",
               recipientId: partner.id,
               recipientLastSeenAt: partner.last_seen_at,
               isRecipientOnline: isPartnerOnline,
               messageSnippet: "[Voice Message]",
               groupId,
            });
         }
      } catch (err) {
         console.error("Failed to send voice note:", err);
         useAppStore.getState().updateGlobalMessage({ id: messageId, status: "failed" });
         useAppStore.getState().triggerToast("Failed to send voice note. Tap to retry.", TOAST_DURATION.LONG);
      }
   };

   const handleSendImage = (file: File) => {
      if (!user?.id || !selectedGroupId) return;
      const uid = user.id;
      const groupId = selectedGroupId;

      const tempId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);

      useAppStore.getState().addGlobalMessage({
         id: tempId,
         content: "[Image]",
         user_id: uid,
         created_at: new Date().toISOString(),
         image_url: objectUrl,
         group_id: groupId,
         is_read: false,
         status: "sending",
         profiles: { id: uid, username: profile?.username || "User", avatar_url: profile?.avatar_url || "" },
      });
      pendingRetriesRef.current.set(tempId, { kind: "image", blob: file, objectUrl });
      startInactivityTimer();

      void queueAndDeliver(
         {
            id: tempId,
            kind: "image",
            payload: { id: tempId, content: "[Image]", user_id: uid, is_read: false, group_id: groupId },
            blob: file,
            groupId,
            createdAt: new Date().toISOString(),
         },
         () => deliverImageMessage(tempId, file, groupId),
      );
   };

   const deliverImageMessage = async (messageId: string, file: File, groupId: string) => {
      if (!user?.id) return;
      try {
         const compressedBlob = await compressImage(file);
         const publicUrl = await uploadImageAsset(user.id, compressedBlob);
         await insertMessageWithRetry({
            id: messageId,
            content: "[Image]",
            user_id: user.id,
            is_read: false,
            image_url: publicUrl,
            group_id: groupId,
         });

         const entry = pendingRetriesRef.current.get(messageId);
         if (entry && entry.kind !== "text" && entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
         pendingRetriesRef.current.delete(messageId);
         useAppStore.getState().updateGlobalMessage({ id: messageId, status: "sent", image_url: publicUrl });
         removeOutbox(messageId).catch(() => { });

         markGroupAsRead(groupId);

         // Trigger client-side push notification if recipient is offline in a DM
         const currentGroup = groups.find((g) => g.id === groupId);
         if (currentGroup?.type === "dm" && currentGroup?.dm_partner) {
            const partner = currentGroup.dm_partner;
            const isPartnerOnline = onlineUsers?.some((u) => u.id === partner.id);
            void sendDirectMessagePushNotification({
               senderId: user.id,
               senderName: profile?.username || "Someone",
               recipientId: partner.id,
               recipientLastSeenAt: partner.last_seen_at,
               isRecipientOnline: isPartnerOnline,
               messageSnippet: "[Image]",
               groupId,
            });
         }
      } catch (err) {
         console.error("Failed to send image:", err);
         useAppStore.getState().updateGlobalMessage({ id: messageId, status: "failed" });
         useAppStore.getState().triggerToast("Failed to send image. Tap to retry.", TOAST_DURATION.LONG);
      }
   };

   const globalMessages = useAppStore((s) => s.globalMessages);
   const readReceipts = useAppStore((s) => s.readReceipts);
   const joinedGroupIds = useAppStore((s) => s.joinedGroupIds);
   const { user } = useAuth();

   // Profiles cache for reactor names
   const profilesCacheRef = useRef<Record<string, string>>({});
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
               profilesCacheRef.current = map;
            });
      } else {
         profilesCacheRef.current = map;
      }
   }, [globalMessages, user?.id]);
   const getUserName = (uid: string) => {
      if (uid === user?.id) return 'You';
      return profilesCacheRef.current[uid] || uid;
   };

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
                     .select("user_id, profiles(username, avatar_url, last_seen_at)")
                     .eq("group_id", cg.id)
                     .neq("user_id", user.id)
                     .maybeSingle();

                  if (partner && partner.profiles) {
                     const p = partner.profiles as any;
                     dmPartner = {
                        id: partner.user_id,
                        username: p.username,
                        avatar_url: p.avatar_url,
                        last_seen_at: p.last_seen_at,
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

         // Fetch group invites
         const { data: inviteData } = await supabase
            .from("chat_group_members")
            .select("group_id, chat_groups(id, name, created_by)")
            .eq("user_id", user.id)
            .eq("status", "invited");

         if (inviteData) {
            const mappedInvites = await Promise.all(
               inviteData.map(async (inv) => {
                  const cg = inv.chat_groups as any;
                  if (!cg) return null;
                  let creatorName = "Someone";
                  if (cg.created_by) {
                     const { data: creatorProf } = await supabase
                        .from("profiles")
                        .select("username")
                        .eq("id", cg.created_by)
                        .maybeSingle();
                     if (creatorProf?.username) creatorName = creatorProf.username;
                  }
                  return {
                     id: cg.id,
                     name: cg.name,
                     creator: creatorName,
                  };
               }),
            );
            setInvites(mappedInvites.filter(Boolean) as any[]);
         }
      };

      fetchGroupsData();
   }, [user?.id, globalMessages]);

   // Handle starting a 1-on-1 DM
   const handleStartDM = async (partnerId: string) => {
      if (!user?.id || partnerId === user.id) return;
      setIsSubmittingNewConv(true);
      try {
         const existing = groups.find((g) => g.type === "dm" && g.dm_partner?.id === partnerId);
         if (existing) {
            setSelectedGroupId(existing.id);
            setIsCreatingDM(false);
            setDmSearchQuery("");
            return;
         }

         const { data: groupId, error } = await supabase.rpc("get_or_create_dm", {
            p_partner_id: partnerId,
         });

         if (error || !groupId) {
            triggerToast("Failed to start direct message.", TOAST_DURATION.SHORT);
            return;
         }

         useAppStore.getState().setJoinedGroupIds([...useAppStore.getState().joinedGroupIds, groupId]);
         setSelectedGroupId(groupId);
         setIsCreatingDM(false);
         setDmSearchQuery("");
      } catch (e) {
         console.error("Error starting DM:", e);
         triggerToast("Could not start DM.", TOAST_DURATION.SHORT);
      } finally {
         setIsSubmittingNewConv(false);
      }
   };

   // Handle creating a custom group
   const handleCreateCustomGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.id || !newGroupName.trim()) return;
      if (selectedGroupUsers.length < 2) {
         triggerToast("A group must have at least 3 members (select 2+ users).", TOAST_DURATION.SHORT);
         return;
      }

      setIsSubmittingNewConv(true);
      try {
         const { data: newGroup, error } = await supabase
            .from("chat_groups")
            .insert([{ name: newGroupName.trim(), type: "custom", created_by: user.id }])
            .select()
            .single();

         if (error || !newGroup) {
            triggerToast("Failed to create group.", TOAST_DURATION.SHORT);
            return;
         }

         // Add self as joined member
         await supabase.from("chat_group_members").insert([
            { group_id: newGroup.id, user_id: user.id, status: "joined" },
         ]);

         // Invite other members
         const memberInserts = selectedGroupUsers.map((uid) => ({
            group_id: newGroup.id,
            user_id: uid,
            status: "invited",
         }));
         await supabase.from("chat_group_members").insert(memberInserts);

         useAppStore.getState().setJoinedGroupIds([...useAppStore.getState().joinedGroupIds, newGroup.id]);
         setSelectedGroupId(newGroup.id);
         setIsCreatingGroup(false);
         setNewGroupName("");
         setSelectedGroupUsers([]);
         triggerToast(`Group "${newGroup.name}" created!`, TOAST_DURATION.SHORT);
      } catch (e) {
         console.error("Error creating group:", e);
         triggerToast("Could not create group.", TOAST_DURATION.SHORT);
      } finally {
         setIsSubmittingNewConv(false);
      }
   };

   const handleAcceptInvite = async (groupId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
         .from("chat_group_members")
         .update({ status: "joined" })
         .eq("group_id", groupId)
         .eq("user_id", user.id);
      if (!error) {
         setInvites((prev) => prev.filter((i) => i.id !== groupId));
         useAppStore.getState().setJoinedGroupIds([...useAppStore.getState().joinedGroupIds, groupId]);
         setSelectedGroupId(groupId);
         triggerToast("Group invite accepted!", TOAST_DURATION.SHORT);
      }
   };

   const handleDeclineInvite = async (groupId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
         .from("chat_group_members")
         .update({ status: "declined" })
         .eq("group_id", groupId)
         .eq("user_id", user.id);
      if (!error) {
         setInvites((prev) => prev.filter((i) => i.id !== groupId));
         triggerToast("Invite declined.", TOAST_DURATION.SHORT);
      }
   };

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

   // Mark only conversations actually visited inside the bubble when it closes
   const visitedGroupsRef = useRef<Set<string>>(new Set());

   // Typing presence — subscribed only while a conversation is open
   const { typingNames, setSelfTyping } = useTypingPresence(
      selectedGroupId,
      user?.id,
      isOverlayOpen && !!selectedGroupId && !isChatOpen,
      profile?.username || null,
   );

   // Pause/clear inactivity timer while other users are typing
   useEffect(() => {
      if (typingNames.length > 0) {
         clearInactivityTimer();
      } else if (isOverlayOpen) {
         resetInactivityTimer();
      }
   }, [typingNames.length, isOverlayOpen]);

   const peerReceipts = usePeerReceipts(selectedGroupId, user?.id, isOverlayOpen && !!selectedGroupId);
   const [infoMsg, setInfoMsg] = useState<any>(null);

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

      const visited = Array.from(visitedGroupsRef.current);
      visitedGroupsRef.current.clear();
      if (visited.length > 0) {
         markGroupsRead(user.id, visited);
      }
   }, [isOverlayOpen, user?.id]);

   // Auto-scroll detailed message view to bottom on initial group open, when new messages arrive/are sent, or when typing indicator appears
   const prevGroupIdRef = useRef<string | null>(null);
   const prevMessagesLengthRef = useRef<number>(0);
   const prevTypingCountRef = useRef<number>(0);

   useEffect(() => {
      if (!selectedGroupId) {
         prevGroupIdRef.current = null;
         prevMessagesLengthRef.current = 0;
         prevTypingCountRef.current = 0;
         return;
      }

      const roomMessages = globalMessages.filter(m => m.group_id === selectedGroupId && !isReactionRow(m.content));
      const isGroupChange = prevGroupIdRef.current !== selectedGroupId;
      const isNewMessageAdded = roomMessages.length > prevMessagesLengthRef.current;
      const isTypingStarted = typingNames.length > 0 && prevTypingCountRef.current === 0;

      prevGroupIdRef.current = selectedGroupId;
      prevMessagesLengthRef.current = roomMessages.length;
      prevTypingCountRef.current = typingNames.length;

      if (scrollRef.current) {
         const el = scrollRef.current;
         const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 150;
         const latestMsg = roomMessages[roomMessages.length - 1];
         const isMyNewMessage = isNewMessageAdded && latestMsg && latestMsg.user_id === user?.id;

         if (isGroupChange || isMyNewMessage || (isNewMessageAdded && isNearBottom) || isTypingStarted) {
            // Use double-rAF to ensure DOM and layout changes (including typing bubble) have completely painted
            requestAnimationFrame(() => {
               requestAnimationFrame(() => {
                  if (messagesEndRef.current) {
                     messagesEndRef.current.scrollIntoView({ behavior: isGroupChange ? "auto" : "smooth", block: "end" });
                  } else if (scrollRef.current) {
                     scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
               });
            });
         }
      }
   }, [selectedGroupId, globalMessages, user?.id, typingNames.length]);

   // Re-show bubble on new unread after dismissal
   if (unreadCount !== prevUnreadCount) {
      setPrevUnreadCount(unreadCount);
      if (unreadCount > prevUnreadCount && dismissed) {
         setDismissed(false);
      }
   }

   const isVisible = !isChatOpen && !dismissed && !isOverlayOpen;

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
         if (isReactionRow(m.content)) return;
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

   // Unread count from other conversations when a conversation is open
   const otherRoomsUnreadCount = selectedGroupId
      ? unreadMessages.filter((m) => m.group_id !== selectedGroupId).length
      : 0;

   // Latest unread sender info for the bubble display
   const latestUnreadMsg = unreadMessages[unreadMessages.length - 1] as any;
   const latestUnreadGroup = latestUnreadMsg ? groups.find((g: any) => g.id === latestUnreadMsg.group_id) : null;
   const isLatestDM = latestUnreadGroup?.type === "dm";
   const latestPartner = latestUnreadGroup?.dm_partner as { id: string; username: string; avatar_url: string } | undefined;

   // Resolve DM partner and room key for a message
   const getDecryptedContent = (m: any) => {
      if (!m) return "";
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
   const handleSendReply = () => {
      if (!replyText.trim() || !user?.id || !selectedGroupId) return;
      // Don't allow replies to locked Game Analysis
      if (selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday) return;

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

      useAppStore.getState().addGlobalMessage({
         ...messagePayload,
         content: replyText,
         created_at: new Date().toISOString(),
         status: "sending",
         profiles: { id: user.id, username: profile?.username || "User", avatar_url: profile?.avatar_url || "" },
      });
      pendingRetriesRef.current.set(tempId, { kind: "text", payload: messagePayload, fallbackText: replyText });

      const sentText = replyText;
      setReplyText("");
      replyTextRef.current = "";
      setSelfTyping(false);
      setReplyingToMsg(null);
      startInactivityTimer();

      void queueAndDeliver(
         {
            id: tempId,
            kind: "text",
            payload: messagePayload,
            fallbackText: sentText,
            groupId: selectedGroupId!,
            createdAt: new Date().toISOString(),
         },
         () => deliverTextMessage(messagePayload, sentText),
      );
   };

   const deliverTextMessage = async (payload: any, plainTextForRestore?: string) => {
      if (!user?.id) return;
      try {
         const { error } = await supabase.from("messages").insert([payload]);
         if (error) throw error;

         pendingRetriesRef.current.delete(payload.id);
         useAppStore.getState().updateGlobalMessage({ id: payload.id, status: "sent" });
         removeOutbox(payload.id).catch(() => { });
         markGroupAsRead(payload.group_id);

         // Trigger client-side push notification if recipient is offline in a DM
         const currentGroup = groups.find((g) => g.id === payload.group_id);
         if (currentGroup?.type === "dm" && currentGroup?.dm_partner) {
            const partner = currentGroup.dm_partner;
            const isPartnerOnline = onlineUsers?.some((u) => u.id === partner.id);
            void sendDirectMessagePushNotification({
               senderId: user.id,
               senderName: profile?.username || "Someone",
               recipientId: partner.id,
               recipientLastSeenAt: partner.last_seen_at,
               isRecipientOnline: isPartnerOnline,
               messageSnippet: plainTextForRestore || payload.content || "",
               groupId: payload.group_id,
            });
         }
      } catch (err) {
         console.error("Failed to send message:", err);
         useAppStore.getState().updateGlobalMessage({ id: payload.id, status: "failed" });
         useAppStore.getState().triggerToast("Failed to send message. Tap to retry.", TOAST_DURATION.LONG);
         if (plainTextForRestore && !replyTextRef.current.trim()) {
            replyTextRef.current = plainTextForRestore;
            setReplyText(plainTextForRestore);
         }
      }
   };

   const handleRetryMessage = (msg: any) => {
      if (!user?.id) return;
      const entry = pendingRetriesRef.current.get(msg.id);
      if (!entry) return;
      useAppStore.getState().updateGlobalMessage({ id: msg.id, status: "sending" });
      if (entry.kind === "text") {
         void deliverTextMessage(entry.payload, entry.fallbackText);
      } else if (entry.kind === "voice") {
         void deliverVoiceMessage(msg.id, entry.blob, msg.group_id);
      } else {
         void deliverImageMessage(msg.id, entry.blob, msg.group_id);
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
         useAppStore.getState().triggerToast("Message copied to clipboard", TOAST_DURATION.SHORT);
      } catch (err) {
         console.error('Failed to copy:', err);
         useAppStore.getState().triggerToast("Failed to copy message", TOAST_DURATION.SHORT);
      }
   };

   // Handle reaction
   const handleReact = (msgId: string, emoji: string | null) => {
      if (!user?.id) return;
      if (emoji) {
         setActiveSplashes((prev) => ({ ...prev, [msgId]: emoji }));
         if (navigator.vibrate) navigator.vibrate(20);
      }
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
      // Reliably focus textarea and summon mobile virtual keyboard within user gesture tick
      const focusTextarea = () => {
         if (replyInputRef.current) {
            replyInputRef.current.focus({ preventScroll: true });
            const len = replyInputRef.current.value.length;
            replyInputRef.current.setSelectionRange(len, len);
         }
      };

      // 1. Immediate synchronous focus (required by iOS Safari & Android Chrome user gesture token)
      focusTextarea();
      // 2. Immediate microtask tick fallback in case state re-render temporarily interrupted focus
      setTimeout(focusTextarea, 0);
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
      // Proactively ask for notification permission on user interaction if not decided yet
      requestNotificationPermission().catch(() => { });
      if (unreadMessages.length > 0) {
         const autoOpenGroupId = unreadMessages[unreadMessages.length - 1].group_id;
         visitedGroupsRef.current.add(autoOpenGroupId);
         setSelectedGroupId(autoOpenGroupId);
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
      dragStartPos.current = { x: bubbleX.get(), y: bubbleY.get() };
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

      // Persist bubble position — always clamped back into bounds so the
      // bubble can never be saved (or left) outside the allowed region.
      const newPos = clampToBounds({
         x: dragStartPos.current.x + info.offset.x,
         y: dragStartPos.current.y + info.offset.y,
      });
      bubbleX.set(newPos.x);
      bubbleY.set(newPos.y);
      setBubblePos(newPos);
      safeLocalStorage.setItem('floating_bubble_pos', JSON.stringify(newPos));
   };

   // Filter messages context for the active room in popover
   const allRoomMessages = selectedGroupId
      ? globalMessages.filter(m => m.group_id === selectedGroupId && !isReactionRow(m.content))
      : [];

   // Jump-to-reply or incremental pagination widens the rendered window
   const [windowFloorId, setWindowFloorId] = useState<string | null>(null);
   const activeRoomMessages = (() => {
      if (!windowFloorId) return allRoomMessages.slice(-messageLimit);
      const floorIdx = allRoomMessages.findIndex((m: any) => m.id === windowFloorId);
      if (floorIdx === -1 || floorIdx >= allRoomMessages.length - messageLimit) return allRoomMessages.slice(-messageLimit);
      return allRoomMessages.slice(Math.max(0, floorIdx - 5));
   })();
   const hasMoreMessages = allRoomMessages.length > messageLimit && !windowFloorId;
   const handleLoadMoreMessages = () => {
      setMessageLimit((prev) => prev + 25);
   };

   const handleJumpToMessage = (messageId: string) => {
      const el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (!el) {
         const idx = allRoomMessages.findIndex((m: any) => m.id === messageId);
         if (idx === -1) return;
         setWindowFloorId(messageId);
         // Retry after React paints the widened window
         requestAnimationFrame(() => requestAnimationFrame(() => handleJumpToMessage(messageId)));
         return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-correct", "rounded-2xl");
      setTimeout(() => {
         el.classList.remove("ring-2", "ring-correct", "rounded-2xl");
      }, 2000);
   };

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
      markGroupsRead(user.id, [selectedGroupId]);

      // Only update the message row's legacy is_read column for 1-on-1 DMs to avoid false read ticks in group chats
      const currentGroup = groups.find((g) => g.id === selectedGroupId);
      if (currentGroup?.type === "dm") {
         supabase
            .from("messages")
            .update({ is_read: true })
            .eq("id", messageId)
            .then(({ error }) => {
               if (error) console.error("Failed to update message read status:", error);
            });
      }
   };

   const hasCapturedDividerRef = useRef(false);

   // Snapshot firstUnreadId for the unread divider
   useEffect(() => {
      if (!firstUnreadId || !selectedGroupId || hasCapturedDividerRef.current) return;
      hasCapturedDividerRef.current = true;
      // A large unread backlog can push the divider outside the default
      // 20-message window — widen it so the line is actually rendered.
      const idx = allRoomMessages.findIndex((m: any) => m.id === firstUnreadId);
      const needsWiden = idx !== -1 && idx < allRoomMessages.length - 20 && !windowFloorId;
      const raf = requestAnimationFrame(() => {
         setVisibleUnreadId(firstUnreadId);
         setShowUnreadLine(true);
         if (needsWiden) setWindowFloorId(firstUnreadId);
      });
      return () => cancelAnimationFrame(raf);
   }, [firstUnreadId, selectedGroupId, allRoomMessages, windowFloorId]);

   // Listen for external open-chat-room triggers and incoming reaction splash events
   useEffect(() => {
      const handleOpenRoom = (e: CustomEvent<{ groupId: string }>) => {
         if (e.detail?.groupId) {
            setSelectedGroupId(e.detail.groupId);
            setIsOverlayOpen(true);
            clearInactivityTimer();
         }
      };

      const handleIncomingReaction = (e: CustomEvent<{ messageId: string; emoji: string; userId: string; groupId: string }>) => {
         const { messageId, emoji, userId: reactorId } = e.detail || {};
         // Trigger splash animation if reaction is from another user
         if (messageId && emoji && reactorId !== user?.id) {
            setActiveSplashes((prev) => ({ ...prev, [messageId]: emoji }));
            if (navigator.vibrate) navigator.vibrate(20);
         }
      };

      window.addEventListener('open-chat-room' as any, handleOpenRoom);
      window.addEventListener('new-message-reaction' as any, handleIncomingReaction);
      return () => {
         window.removeEventListener('open-chat-room' as any, handleOpenRoom);
         window.removeEventListener('new-message-reaction' as any, handleIncomingReaction);
      };
   }, [user?.id]);

   // Reset snapshot on room change
   useEffect(() => {
      hasCapturedDividerRef.current = false;
      unreadLineSeenRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleUnreadId(null);
      setShowUnreadLine(true);
      setMentionState(null);
      setWindowFloorId(null);
      setIsChatSearchOpen(false);
      setChatSearchQuery("");
      setIsScrolledUp(false);
      setMessageLimit(isFullMode ? 100 : 25);
   }, [selectedGroupId, isFullMode]);

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
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

   // Full-Screen In-App Chat Mode Layout
   if (isFullMode) {
      return (
         <div className="w-full h-full flex flex-col md:flex-row bg-slate-950 text-white overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl relative">
            {/* Split View Left Sidebar (Conversations) */}
            <div className={`w-full md:w-80 lg:w-96 flex-col shrink-0 border-r border-white/10 bg-slate-950/80 backdrop-blur-xl ${selectedGroupId && !isDesktop ? "hidden" : "flex"} h-full min-h-0`}>
               {/* Sidebar Header */}
               <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2">
                     <MessageCircle className="w-5 h-5 text-indigo-400" />
                     <h2 className="text-sm font-black uppercase tracking-wider text-white">Chat</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <button
                        onClick={() => setIsCreatingDM(true)}
                        className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-lg transition-colors cursor-pointer"
                        title="New Direct Message"
                     >
                        <Plus size={15} />
                     </button>
                     <button
                        onClick={() => setIsCreatingGroup(true)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
                        title="Create Group"
                     >
                        <Users size={15} />
                     </button>
                     {onCloseFull && (
                        <button
                           onClick={onCloseFull}
                           className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer md:hidden"
                           title="Close"
                        >
                           <X size={16} />
                        </button>
                     )}
                  </div>
               </div>

               {/* Search bar & Invites & Conversations List */}
               <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-hide">
                  <div className="relative">
                     <input
                        type="text"
                        value={conversationSearchQuery}
                        onChange={(e) => setConversationSearchQuery(e.target.value)}
                        placeholder="Search conversations..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 transition-all"
                     />
                     <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  </div>

                  {/* Invites Banner */}
                  {invites.length > 0 && (
                     <div className="space-y-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <h3 className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Group Invites ({invites.length})</h3>
                        {invites.map((invite) => (
                           <div key={invite.id} className="flex items-center justify-between gap-2 p-2 bg-slate-900/60 rounded-lg border border-white/5">
                              <div className="flex flex-col min-w-0">
                                 <span className="text-xs font-bold text-white truncate">{invite.name}</span>
                                 <span className="text-[9px] text-white/50">by {invite.creator}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                 <button
                                    onClick={() => handleDeclineInvite(invite.id)}
                                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer"
                                 >
                                    Decline
                                 </button>
                                 <button
                                    onClick={() => handleAcceptInvite(invite.id)}
                                    className="px-2 py-1 bg-correct text-black text-[9px] font-black uppercase rounded-md hover:bg-correct/90 transition-colors cursor-pointer"
                                 >
                                    Join
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Conversations List */}
                  {filteredConversations.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 text-center">
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
                        const dmUserId = isDM ? group.dm_partner?.id : null;
                        const isUserOnline = dmUserId ? onlineUsers.some((u: any) => u.id === dmUserId) : false;
                        const userProfile = dmUserId ? allProfiles.find((p: any) => p.id === dmUserId) : null;
                        const userLastSeenAt = userProfile?.last_seen_at || group?.dm_partner?.last_seen_at;
                        const isSelected = selectedGroupId === group.id;

                        return (
                           <button
                              key={group.id}
                              onClick={() => { visitedGroupsRef.current.add(group.id); setSelectedGroupId(group.id); }}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer text-left border ${isSelected ? "bg-indigo-600/20 border-indigo-500/40 shadow-sm" : "hover:bg-white/5 border-transparent hover:border-white/5"}`}
                           >
                              {isDM ? (
                                 <div className="relative shrink-0">
                                    <ProtectedAvatar
                                       userId={group.dm_partner!.id}
                                       src={group.dm_partner!.avatar_url}
                                       username={name}
                                       className="w-10 h-10 rounded-full border border-white/10 bg-slate-900 shrink-0"
                                    />
                                    {isUserOnline && (
                                       <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full ring-1 ring-emerald-400/40" />
                                    )}
                                 </div>
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
                                 <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                                       <span className="text-xs font-black uppercase text-indigo-400 tracking-wide truncate">
                                          {name}
                                       </span>
                                       {isDM && (
                                          <span className="text-[10px] text-gray-400 shrink-0">
                                             {isUserOnline ? (
                                                <span className="text-emerald-400 font-semibold">• Online</span>
                                             ) : userLastSeenAt ? (
                                                `• ${formatLastSeen(userLastSeenAt)}`
                                             ) : null}
                                          </span>
                                       )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                       {unreadCount > 0 && (
                                          <span className="bg-rose-500/25 border border-rose-500/20 text-rose-300 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                             {unreadCount} unread
                                          </span>
                                       )}
                                    </div>
                                 </div>
                                 <p className="text-[11px] text-gray-400 truncate mt-1">
                                    {lastMessage?.profiles ? `${lastMessage.profiles.username}: ` : ""}
                                    {lastMessage?.voice_url ? (
                                       <span className="text-indigo-400 font-semibold">🎤 Voice note</span>
                                    ) : lastMessage?.image_url ? (
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
            </div>

            {/* Split View Right Pane (Active Conversation) */}
            <div className={`flex-1 flex-col h-full min-h-0 bg-slate-950/40 relative ${!selectedGroupId && !isDesktop ? "hidden" : "flex"}`}>
               {selectedGroupId ? (
                  <>
                     {/* Chat Header */}
                     <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                           <button
                              onClick={() => {
                                 if (user?.id && selectedGroupId) {
                                    markGroupsRead(user.id, [selectedGroupId]);
                                    visitedGroupsRef.current.delete(selectedGroupId);
                                 }
                                 setSelectedGroupId(null);
                              }}
                              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer md:hidden flex items-center gap-1"
                           >
                              <ArrowLeft className="w-4 h-4" />
                              {otherRoomsUnreadCount > 0 && (
                                 <span className="bg-rose-500 text-white font-extrabold text-[10px] leading-none px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                                    {otherRoomsUnreadCount > 99 ? "99+" : otherRoomsUnreadCount}
                                 </span>
                              )}
                           </button>
                           <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                 <span className="text-xs font-black uppercase tracking-wider text-gray-200 truncate">
                                    {selectedGroupName}
                                 </span>
                                 {(() => {
                                    const activeGroup = groups.find(g => g.id === selectedGroupId);
                                    if (activeGroup?.type !== "dm" || !activeGroup.dm_partner) return null;
                                    const dmPartnerId = activeGroup.dm_partner.id;
                                    const isUserOnline = onlineUsers.some((u: any) => u.id === dmPartnerId);
                                    return (
                                       <span
                                          className={`w-2 h-2 rounded-full shrink-0 ${isUserOnline ? "bg-emerald-500 ring-2 ring-emerald-400/40" : "bg-gray-500"}`}
                                          title={isUserOnline ? "Online" : "Offline"}
                                       />
                                    );
                                 })()}
                              </div>
                              {(() => {
                                 const activeGroup = groups.find(g => g.id === selectedGroupId);
                                 if (activeGroup?.type !== "dm" || !activeGroup.dm_partner) return null;
                                 const dmPartnerId = activeGroup.dm_partner.id;
                                 const isUserOnline = onlineUsers.some((u: any) => u.id === dmPartnerId);
                                 const userProfile = allProfiles.find((p: any) => p.id === dmPartnerId);
                                 const userLastSeenAt = userProfile?.last_seen_at || activeGroup.dm_partner.last_seen_at;

                                 return (
                                    <span className="text-[10px] text-gray-400 truncate leading-none mt-0.5">
                                       {isUserOnline ? (
                                          <span className="text-emerald-400 font-semibold">Online</span>
                                       ) : userLastSeenAt ? (
                                          `Last seen ${formatLastSeen(userLastSeenAt)}`
                                       ) : (
                                          "Offline"
                                       )}
                                    </span>
                                 );
                              })()}
                           </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-1.5">
                           {(() => {
                              const activeGroup = groups.find(g => g.id === selectedGroupId);
                              if (activeGroup?.type !== "dm" || !activeGroup.dm_partner) return null;
                              const partner = activeGroup.dm_partner;
                              const isPartnerOnline = onlineUsers.some((u: any) => u.id === partner.id);
                              if (!isPartnerOnline) return null;

                              const isCalling = activeCall?.targetUser?.id === partner.id && (activeCall?.status === 'calling' || activeCall?.status === 'connected');

                              return (
                                 <button
                                    onClick={() => {
                                       if (isCalling) {
                                          triggerToast("Call already in progress", TOAST_DURATION.SHORT);
                                          return;
                                       }
                                       initiatePrivateCall({
                                          id: partner.id,
                                          username: partner.username || "User",
                                          avatar_url: partner.avatar_url || ""
                                       });
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isCalling
                                       ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                                       : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                       }`}
                                    title="Start Voice Call"
                                 >
                                    <Phone className="w-3.5 h-3.5" />
                                 </button>
                              );
                           })()}
                           <button
                              onClick={() => {
                                 setIsChatSearchOpen(prev => !prev);
                                 if (isChatSearchOpen) setChatSearchQuery("");
                              }}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isChatSearchOpen
                                 ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                                 : "text-gray-400 hover:text-white hover:bg-white/5"
                                 }`}
                              title="Search in conversation"
                           >
                              <Search className="w-3.5 h-3.5" />
                           </button>
                           {onCloseFull && (
                              <button
                                 onClick={onCloseFull}
                                 className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                 title="Close"
                              >
                                 <X className="w-4 h-4" />
                              </button>
                           )}
                        </div>
                     </div>

                     {/* Messages Flow */}
                     <div className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-hide h-full" ref={scrollRef} onScroll={handleScroll}>
                        {selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday ? (
                           <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                              <ShieldAlert className="w-10 h-10 text-red-400 mb-3" />
                              <h4 className="text-sm font-black uppercase text-white tracking-tight mb-1">Analysis Room Locked</h4>
                              <p className="text-xs text-white/50 max-w-60 leading-relaxed">
                                 Complete today's daily puzzle to unlock this discussion.
                              </p>
                           </div>
                        ) : (
                           <div className="space-y-4">
                              <VoiceControlBar />

                              {/* Search bar inside conversation */}
                              <AnimatePresence>
                                 {isChatSearchOpen && (
                                    <motion.div
                                       initial={{ opacity: 0, height: 0 }}
                                       animate={{ opacity: 1, height: "auto" }}
                                       exit={{ opacity: 0, height: 0 }}
                                       className="overflow-hidden mb-2"
                                    >
                                       <div className="relative">
                                          <input
                                             type="text"
                                             autoFocus
                                             value={chatSearchQuery}
                                             onChange={(e) => setChatSearchQuery(e.target.value)}
                                             placeholder="Search in this conversation..."
                                             className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl py-1.5 pl-8 pr-8 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 transition-all shadow-inner"
                                          />
                                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
                                          {chatSearchQuery && (
                                             <button
                                                onClick={() => setChatSearchQuery("")}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
                                             >
                                                <X size={12} />
                                             </button>
                                          )}
                                       </div>
                                       {chatSearchQuery.trim() && (
                                          <div className="text-[10px] text-indigo-300/70 mt-1 px-1 flex justify-between items-center">
                                             <span>
                                                {activeRoomMessages.filter((m: any) => {
                                                   const content = getDecryptedContent(m) || "";
                                                   const author = m.profiles?.username || "";
                                                   return content.toLowerCase().includes(chatSearchQuery.toLowerCase()) || author.toLowerCase().includes(chatSearchQuery.toLowerCase());
                                                }).length} matches found
                                             </span>
                                          </div>
                                       )}
                                    </motion.div>
                                 )}
                              </AnimatePresence>

                              {hasMoreMessages && !chatSearchQuery.trim() && (
                                 <div className="flex flex-col items-center gap-2 pb-2">
                                    <button onClick={handleLoadMoreMessages} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1 rounded-full transition-colors cursor-pointer">
                                       Load older messages ({allRoomMessages.length - activeRoomMessages.length} remaining)
                                    </button>
                                    <div className="h-px w-full bg-white/10" />
                                 </div>
                              )}

                              {activeRoomMessages.map((msg: any) => {
                                 const isMe = msg.user_id === user?.id;
                                 const isEditing = editingMessageId === msg.id;
                                 const content = getDecryptedContent(msg);
                                 const userColor = getUserChatColor(msg.user_id);
                                 const isGroupChat = selectedGroupObject?.type !== "dm";
                                 const isSearchMatch = !!(chatSearchQuery.trim() && (
                                    (content && content.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
                                    (msg.profiles?.username && msg.profiles.username.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                                 ));
                                 const isSearchDimmed = !!(chatSearchQuery.trim() && !isSearchMatch);

                                 return (
                                    <div
                                       key={msg.id}
                                       data-message-id={msg.id}
                                       onMouseEnter={() => !isMe && !msg.is_read && handleMarkAsRead(msg.id)}
                                       onClick={isMe && msg.status === "failed" ? () => handleRetryMessage(msg) : undefined}
                                       onTouchStart={() => { if (!(isMe && msg.status === "failed")) handleTouchStart(msg.id); }}
                                       onTouchEnd={handleTouchEnd}
                                       onTouchMove={handleTouchMove}
                                       onTouchCancel={handleTouchEnd}
                                       className={`relative ${reactingMessageId === msg.id || reactingModalMessageId === msg.id ? 'z-50' : 'z-auto'} overflow-visible ${isMe && msg.status === "failed" ? "cursor-pointer" : ""} ${isSearchDimmed ? "opacity-30 transition-opacity" : isSearchMatch ? "ring-2 ring-indigo-400/80 rounded-2xl p-1 bg-indigo-950/20 transition-all" : "transition-opacity"}`}
                                       title={isMe && msg.status === "failed" ? "Tap to retry" : undefined}
                                    >
                                       {/* Unread divider */}
                                       {msg.id === visibleUnreadId && showUnreadLine && (
                                          <motion.div
                                             id="fb-unread-line"
                                             initial={{ opacity: 0, scale: 0.8 }}
                                             animate={{ opacity: 1, scale: 1 }}
                                             className="flex items-center my-4 gap-3 px-2"
                                          >
                                             <div className="h-px flex-1 bg-indigo-500/40" />
                                             <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                                New Messages
                                             </span>
                                             <div className="h-px flex-1 bg-indigo-500/40" />
                                          </motion.div>
                                       )}

                                       <div className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                                          <ProtectedAvatar
                                             userId={msg.user_id}
                                             src={msg.profiles?.avatar_url}
                                             username={msg.profiles?.username}
                                             className={`w-8 h-8 rounded-full border bg-slate-900 shrink-0 ${!isMe && isGroupChat ? userColor.border : "border-white/10"}`}
                                          />
                                          <div className={`flex flex-col group/msg min-w-0 max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                                             {isGroupChat && !isMe && (
                                                <span className={`text-[10px] font-black uppercase mb-1 px-1 tracking-wider ${userColor.name}`}>
                                                   {msg.profiles?.username || "Unknown"}
                                                </span>
                                             )}

                                             {/* Message bubble */}
                                             <div className={`rounded-2xl px-3.5 py-2 text-xs relative ${isMe
                                                ? "bg-indigo-600 text-white rounded-tr-xs"
                                                : "bg-white/10 text-white rounded-tl-xs"
                                                }`}>
                                                {/* Replied message preview */}
                                                {msg.reply_to && !msg.is_deleted && (() => {
                                                   const replyToId = typeof msg.reply_to === "object" ? msg.reply_to.id : msg.reply_to;
                                                   const replyToMsg = allRoomMessages.find((m: any) => m.id === replyToId);
                                                   if (!replyToMsg) return null;
                                                   return (
                                                      <div
                                                         onClick={() => handleJumpToMessage(replyToId)}
                                                         className="mb-1.5 p-1.5 bg-black/25 border-l-2 border-indigo-400 rounded text-[10px] opacity-85 cursor-pointer hover:opacity-100 flex items-center gap-1.5"
                                                      >
                                                         <Reply size={10} className="text-indigo-400 shrink-0" />
                                                         <span className="truncate">
                                                            <strong className="text-white">{replyToMsg.profiles?.username || "User"}: </strong>
                                                            <span className="text-gray-300">
                                                               {replyToMsg.voice_url ? "🎤 Voice note" : replyToMsg.image_url ? "📷 Image" : getDecryptedContent(replyToMsg)}
                                                            </span>
                                                         </span>
                                                      </div>
                                                   );
                                                })()}

                                                {/* Message Content */}
                                                {isEditing ? (
                                                   <div className="flex flex-col gap-1.5 min-w-[200px]">
                                                      <textarea
                                                         rows={2}
                                                         value={editText}
                                                         onChange={(e) => setEditText(e.target.value)}
                                                         className="bg-slate-900 border border-indigo-400 rounded p-1.5 text-xs text-white outline-none"
                                                      />
                                                      <div className="flex justify-end gap-1">
                                                         <button onClick={() => setEditingMessageId(null)} className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-white cursor-pointer">
                                                            Cancel
                                                         </button>
                                                         <button onClick={() => handleEditSave(msg.id)} className="px-2 py-0.5 text-[10px] bg-indigo-500 text-white rounded cursor-pointer">
                                                            Save
                                                         </button>
                                                      </div>
                                                   </div>
                                                ) : (
                                                   <>
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
                                                         <div className="leading-relaxed break-words whitespace-pre-wrap">
                                                            {renderEmojiNode(content || "")}
                                                         </div>
                                                      )}
                                                   </>
                                                )}

                                                {/* Metadata row: time + read status */}
                                                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-60 select-none">
                                                   {msg.is_edited && <span className="italic">edited</span>}
                                                   <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                   {isMe && (
                                                      <span>
                                                         {msg.status === "sending" ? (
                                                            "•"
                                                         ) : msg.status === "failed" ? (
                                                            <span className="text-red-400 font-bold">!</span>
                                                         ) : (
                                                            <CheckCheck size={10} className={resolveTickState(msg, user?.id, peerReceipts) === "read" ? "text-blue-400 inline" : "text-white/30 inline"} />
                                                         )}
                                                      </span>
                                                   )}
                                                </div>

                                                {/* Reactions Badge */}
                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                   <ReactionBadge
                                                      reactions={msg.reactions}
                                                      isMe={isMe}
                                                      onShowDetails={() => setShowReactionDetailsId(showReactionDetailsId === msg.id ? null : msg.id)}
                                                   />
                                                )}
                                             </div>

                                             {/* Hover quick action buttons (desktop) */}
                                             <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 px-1">
                                                <button onClick={() => setReactingMessageId(reactingMessageId === msg.id ? null : msg.id)} className="p-1 hover:text-white text-gray-400 rounded cursor-pointer" title="React">
                                                   <Smile className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => { setReplyingToMsg(msg); replyInputRef.current?.focus(); }} className="p-1 hover:text-white text-gray-400 rounded cursor-pointer" title="Reply">
                                                   <Reply className="w-3 h-3" />
                                                </button>
                                                {isMe && !msg.voice_url && !msg.image_url && (
                                                   <button onClick={() => { setEditingMessageId(msg.id); setEditText(content); }} className="p-1 hover:text-white text-gray-400 rounded cursor-pointer" title="Edit">
                                                      <Edit2 className="w-3 h-3" />
                                                   </button>
                                                )}
                                                {isMe && (
                                                   <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:text-red-400 text-gray-400 rounded cursor-pointer" title="Delete">
                                                      <Trash2 className="w-3 h-3" />
                                                   </button>
                                                )}
                                             </div>

                                             {/* Inline Reaction Picker Popover */}
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
                                          </div>
                                       </div>
                                    </div>
                                 );
                              })}

                              {/* Typing Indicator Bubble */}
                              {typingNames.length > 0 && (
                                 <TypingBubble name={typingNames.length === 1 ? typingNames[0] : typingNames.join(", ")} />
                              )}
                              <div ref={messagesEndRef} />
                           </div>
                        )}
                     </div>

                     {/* Reply Bar */}
                     {!(selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday) && (
                        <div className="p-3 bg-white/5 border-t border-white/10 shrink-0">
                           {/* Reply Preview banner */}
                           {replyingToMsg && (
                              <div className="flex items-center justify-between bg-white/5 border-l-2 border-indigo-400 px-3 py-1.5 rounded-r-lg mb-2 text-xs">
                                 <div className="truncate">
                                    <span className="font-bold text-indigo-400">Replying to {replyingToMsg.profiles?.username || "User"}: </span>
                                    <span className="text-gray-300">{getDecryptedContent(replyingToMsg) || "Attachment"}</span>
                                 </div>
                                 <button onClick={() => setReplyingToMsg(null)} className="p-0.5 text-gray-400 hover:text-white cursor-pointer">
                                    <X className="w-3.5 h-3.5" />
                                 </button>
                              </div>
                           )}

                           <div className="flex items-end gap-2">
                              <input
                                 type="file"
                                 ref={fileInputRef}
                                 onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                       handleSendImage(file);
                                       if (fileInputRef.current) fileInputRef.current.value = "";
                                    }
                                 }}
                                 accept="image/*"
                                 className="hidden"
                              />
                              <button
                                 onClick={() => fileInputRef.current?.click()}
                                 className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                                 title="Send Image"
                              >
                                 <ImageIcon className="w-4 h-4" />
                              </button>

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
                                       replyTextRef.current = value;
                                       setReplyText(value);
                                       setSelfTyping(value.length > 0);
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
                                       type="button"
                                       onClick={stopRecording}
                                       className="bg-red-600 text-white p-2.5 rounded-xl cursor-pointer relative"
                                       title="Stop and send"
                                    >
                                       <Send className="w-4 h-4" />
                                       <div className="absolute inset-0 bg-red-500 rounded-xl animate-ping opacity-25" />
                                    </button>
                                 ) : (
                                    <button
                                       type="button"
                                       onClick={startRecording}
                                       className="bg-correct text-black p-2.5 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all select-none"
                                       title="Record voice note"
                                    >
                                       <Mic className="w-4 h-4" />
                                    </button>
                                 )
                              ) : (
                                 <button
                                    onClick={handleSendReply}
                                    disabled={!replyText.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-xl transition-colors cursor-pointer"
                                 >
                                    <Send className="w-4 h-4" />
                                 </button>
                              )}
                           </div>
                        </div>
                     )}
                  </>
               ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                     <MessageCircle className="w-12 h-12 text-gray-600 mb-3" />
                     <h3 className="text-sm font-black uppercase text-white tracking-wider mb-1">Select a Conversation</h3>
                     <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                        Choose a chat from the sidebar or start a new direct message.
                     </p>
                  </div>
               )}
            </div>

            {/* Modals inside Full Mode */}
            {/* New DM Modal */}
            {isCreatingDM && (
               <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-4 flex flex-col max-h-[80vh]">
                     <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                        <h3 className="text-xs font-black uppercase text-white">Start Direct Message</h3>
                        <button onClick={() => { setIsCreatingDM(false); setDmSearchQuery(""); }} className="text-gray-400 hover:text-white">
                           <X size={16} />
                        </button>
                     </div>
                     <input
                        type="text"
                        autoFocus
                        value={dmSearchQuery}
                        onChange={(e) => setDmSearchQuery(e.target.value)}
                        placeholder="Search users..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 mb-3"
                     />
                     <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide min-h-0">
                        {allProfiles
                           .filter((p: any) => p.id !== user?.id && (!dmSearchQuery.trim() || p.username.toLowerCase().includes(dmSearchQuery.toLowerCase())))
                           .map((p: any) => (
                              <button
                                 key={p.id}
                                 disabled={isSubmittingNewConv}
                                 onClick={() => handleStartDM(p.id)}
                                 className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left"
                              >
                                 <ProtectedAvatar userId={p.id} src={p.avatar_url} username={p.username} className="w-8 h-8 rounded-full" />
                                 <span className="text-xs font-bold text-white truncate">{p.username}</span>
                              </button>
                           ))}
                     </div>
                  </div>
               </div>
            )}

            {/* Create Group Modal */}
            {isCreatingGroup && (
               <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
                  <form onSubmit={handleCreateCustomGroup} className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-4 flex flex-col max-h-[85vh]">
                     <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                        <h3 className="text-xs font-black uppercase text-white">Create Group Chat</h3>
                        <button type="button" onClick={() => { setIsCreatingGroup(false); setNewGroupName(""); setSelectedGroupUsers([]); }} className="text-gray-400 hover:text-white">
                           <X size={16} />
                        </button>
                     </div>
                     <input
                        type="text"
                        required
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group Name"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 mb-3"
                     />
                     <span className="text-[10px] font-black uppercase text-gray-400 mb-2">Select Members (Min 2)</span>
                     <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide min-h-0 mb-3">
                        {allProfiles
                           .filter((p: any) => p.id !== user?.id)
                           .map((p: any) => {
                              const isChecked = selectedGroupUsers.includes(p.id);
                              return (
                                 <button
                                    type="button"
                                    key={p.id}
                                    onClick={() => {
                                       setSelectedGroupUsers(prev => isChecked ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer ${isChecked ? "bg-indigo-600/20 border border-indigo-500/30" : "hover:bg-white/5"}`}
                                 >
                                    <div className="flex items-center gap-2">
                                       <ProtectedAvatar userId={p.id} src={p.avatar_url} username={p.username} className="w-7 h-7 rounded-full" />
                                       <span className="text-xs text-white font-medium">{p.username}</span>
                                    </div>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? "bg-indigo-600 border-indigo-500" : "border-white/20"}`}>
                                       {isChecked && <Check size={11} className="text-white" />}
                                    </div>
                                 </button>
                              );
                           })}
                     </div>
                     <button
                        type="submit"
                        disabled={isSubmittingNewConv || !newGroupName.trim() || selectedGroupUsers.length < 2}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black uppercase rounded-xl transition-colors cursor-pointer"
                     >
                        {isSubmittingNewConv ? "Creating..." : `Create Group (${selectedGroupUsers.length + 1} Members)`}
                     </button>
                  </form>
               </div>
            )}
         </div>
      );
   }

   return (
      <>
         {/* Drag constraint boundary — excludes the top island row and the
             bottom navbar zone so the bubble can never rest there */}
         <div
            ref={constraintsRef}
            className="fixed pointer-events-none z-9999 overflow-hidden"
            style={{
               left: bubbleBounds.minX,
               top: bubbleBounds.minY,
               width: bubbleBounds.maxX - bubbleBounds.minX + BUBBLE_SIZE,
               height: bubbleBounds.maxY - bubbleBounds.minY + BUBBLE_SIZE,
            }}
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
                     initial={{ scale: 0, opacity: 0 }}
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
                        x: bubbleX,
                        y: bubbleY,
                        zIndex: Z_INDEX.CHAT_BUBBLE,
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

         {/* Centered Modal Popover */}
         <AnimatePresence>
            {isOverlayOpen && !isChatOpen && (!isDesktop || panelPos) && (
               <>
                  {/* Backdrop — desktop panel stays non-blocking so the page remains usable */}
                  {!isDesktop && (
                     <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                           if (Date.now() - overlayOpenedAtRef.current < 400) return;
                           setIsOverlayOpen(false);
                           setSelectedGroupId(null);
                        }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99990] pointer-events-auto"
                     />
                  )}

                  {/* Bottom Sheet (mobile) / Bubble-anchored Docked Panel (desktop) */}
                  <motion.div
                     key="fb-panel-pos"
                     initial={{ opacity: 0, y: isDesktop ? 24 : "100%", x: isDesktop ? 0 : "-50%" }}
                     animate={{ opacity: 1, y: 0, x: isDesktop ? 0 : "-50%" }}
                     exit={{ opacity: 0, y: isDesktop ? 24 : "100%", x: isDesktop ? 0 : "-50%" }}
                     transition={{ type: "spring", damping: 25, stiffness: 280 }}
                     style={isDesktop && panelPos ? { left: panelPos.left, top: panelPos.top, width: PANEL_WIDTH, height: "min(600px,72vh)" } : undefined}
                     className={`fixed z-[99991] pointer-events-auto ${isDesktop ? "" : "bottom-4 left-1/2 w-[92%] max-w-md h-[75vh]"}`}
                  >
                     <motion.div
                        drag={isDesktop}
                        dragListener={false}
                        dragControls={panelDragControls}
                        dragMomentum={false}
                        dragElastic={0}
                        onDragStart={() => { panelDragStartRef.current = panelPos; }}
                        onDragEnd={(_e, info) => {
                           const base = panelDragStartRef.current ?? panelPos;
                           if (!base) return;
                           const next = clampPanelPosition(base.left + info.offset.x, base.top + info.offset.y);
                           setPanelPos(next);
                           panelX.set(0);
                           panelY.set(0);
                        }}
                        style={{ x: panelX, y: panelY }}
                        className="w-full h-full bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col pointer-events-auto overflow-hidden"
                     >
                        {/* Header */}
                        <div
                           onPointerDown={(e) => { if (isDesktop) panelDragControls.start(e); }}
                           className={`px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0 ${isDesktop ? "cursor-grab active:cursor-grabbing select-none" : ""}`}
                           title={isDesktop ? "Drag to move" : undefined}
                        >
                           <div className="flex items-center gap-2">
                              {selectedGroupId && (
                                 <button
                                    onClick={() => {
                                       if (user?.id && selectedGroupId) {
                                          markGroupsRead(user.id, [selectedGroupId]);
                                          visitedGroupsRef.current.delete(selectedGroupId);
                                       }
                                       setSelectedGroupId(null);
                                    }}
                                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
                                 >
                                    <ArrowLeft className="w-4 h-4" />
                                    {otherRoomsUnreadCount > 0 && (
                                       <span className="bg-rose-500 text-white font-extrabold text-[10px] leading-none px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                                          {otherRoomsUnreadCount > 99 ? "99+" : otherRoomsUnreadCount}
                                       </span>
                                    )}
                                 </button>
                              )}
                              <div className="flex flex-col min-w-0">
                                 <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-black uppercase tracking-wider text-gray-200 truncate">
                                       {selectedGroupId ? selectedGroupName : "Conversations"}
                                    </span>
                                    {(() => {
                                       if (!selectedGroupId) return null;
                                       const activeGroup = groups.find(g => g.id === selectedGroupId);
                                       if (activeGroup?.type !== "dm" || !activeGroup.dm_partner) return null;
                                       const dmPartnerId = activeGroup.dm_partner.id;
                                       const isUserOnline = onlineUsers.some((u: any) => u.id === dmPartnerId);
                                       return (
                                          <span
                                             className={`w-2 h-2 rounded-full shrink-0 ${isUserOnline ? "bg-emerald-500 ring-2 ring-emerald-400/40" : "bg-gray-500"}`}
                                             title={isUserOnline ? "Online" : "Offline"}
                                          />
                                       );
                                    })()}
                                 </div>
                                 {(() => {
                                    if (!selectedGroupId) return null;
                                    const activeGroup = groups.find(g => g.id === selectedGroupId);
                                    if (activeGroup?.type !== "dm" || !activeGroup.dm_partner) return null;
                                    const dmPartnerId = activeGroup.dm_partner.id;
                                    const isUserOnline = onlineUsers.some((u: any) => u.id === dmPartnerId);
                                    const userProfile = allProfiles.find((p: any) => p.id === dmPartnerId);
                                    const userLastSeenAt = userProfile?.last_seen_at || activeGroup.dm_partner.last_seen_at;

                                    return (
                                       <span className="text-[10px] text-gray-400 truncate leading-none mt-0.5">
                                          {isUserOnline ? (
                                             <span className="text-emerald-400 font-semibold">Online</span>
                                          ) : userLastSeenAt ? (
                                             `Last seen ${formatLastSeen(userLastSeenAt)}`
                                          ) : (
                                             "Offline"
                                          )}
                                       </span>
                                    );
                                 })()}
                              </div>
                           </div>
                           <div className="flex items-center gap-1.5">
                              {(() => {
                                 if (!selectedGroupId) return null;
                                 const activeGroup = groups.find(g => g.id === selectedGroupId);
                                 if (activeGroup?.type !== "dm" || !activeGroup.dm_partner) return null;
                                 const partner = activeGroup.dm_partner;
                                 const isPartnerOnline = onlineUsers.some((u: any) => u.id === partner.id);
                                 if (!isPartnerOnline) return null;

                                 const isCalling = activeCall?.targetUser?.id === partner.id && (activeCall?.status === 'calling' || activeCall?.status === 'connected');

                                 return (
                                    <button
                                       onClick={() => {
                                          if (isCalling) {
                                             triggerToast("Call already in progress", TOAST_DURATION.SHORT);
                                             return;
                                          }
                                          initiatePrivateCall({
                                             id: partner.id,
                                             username: partner.username || "User",
                                             avatar_url: partner.avatar_url || ""
                                          });
                                       }}
                                       className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isCalling
                                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                                          : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                          }`}
                                       title="Start Voice Call"
                                    >
                                       <Phone className="w-3.5 h-3.5" />
                                    </button>
                                 );
                              })()}
                              {selectedGroupId && (
                                 <button
                                    onClick={() => {
                                       setIsChatSearchOpen(prev => !prev);
                                       if (isChatSearchOpen) setChatSearchQuery("");
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isChatSearchOpen
                                       ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                                       : "text-gray-400 hover:text-white hover:bg-white/5"
                                       }`}
                                    title="Search in conversation"
                                 >
                                    <Search className="w-3.5 h-3.5" />
                                 </button>
                              )}
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
                        <div className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-hide h-full" ref={scrollRef} onScroll={handleScroll}>
                           {!selectedGroupId ? (
                              /* Screen A: Conversation List */
                              <div className="space-y-3">
                                 {/* Search input + Action Buttons */}
                                 <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                       <input
                                          type="text"
                                          value={conversationSearchQuery}
                                          onChange={(e) => setConversationSearchQuery(e.target.value)}
                                          placeholder="Search conversations..."
                                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 transition-all"
                                       />
                                       <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                    </div>
                                    <button
                                       onClick={() => setIsCreatingDM(true)}
                                       className="p-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                                       title="New Direct Message"
                                    >
                                       <Plus size={15} />
                                    </button>
                                    <button
                                       onClick={() => setIsCreatingGroup(true)}
                                       className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                                       title="Create Group Chat"
                                    >
                                       <Users size={15} />
                                    </button>
                                 </div>

                                 {/* Invites Section */}
                                 {invites.length > 0 && (
                                    <div className="space-y-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                       <h3 className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Group Invites ({invites.length})</h3>
                                       {invites.map((invite) => (
                                          <div key={invite.id} className="flex items-center justify-between gap-2 p-2 bg-slate-900/60 rounded-lg border border-white/5">
                                             <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-white truncate">{invite.name}</span>
                                                <span className="text-[9px] text-white/50">by {invite.creator}</span>
                                             </div>
                                             <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                   onClick={() => handleDeclineInvite(invite.id)}
                                                   className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-black uppercase rounded-md transition-colors cursor-pointer"
                                                >
                                                   Decline
                                                </button>
                                                <button
                                                   onClick={() => handleAcceptInvite(invite.id)}
                                                   className="px-2 py-1 bg-correct text-black text-[9px] font-black uppercase rounded-md hover:bg-correct/90 transition-colors cursor-pointer"
                                                >
                                                   Join
                                                </button>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}

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
                                       const dmUserId = isDM ? group.dm_partner?.id : null;
                                       const isUserOnline = dmUserId ? onlineUsers.some((u: any) => u.id === dmUserId) : false;
                                       const userProfile = dmUserId ? allProfiles.find((p: any) => p.id === dmUserId) : null;
                                       const userLastSeenAt = userProfile?.last_seen_at || group?.dm_partner?.last_seen_at;

                                       return (
                                          <div
                                             key={group.id}
                                             role="button"
                                             tabIndex={0}
                                             onClick={() => { visitedGroupsRef.current.add(group.id); setSelectedGroupId(group.id); }}
                                             onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                   e.preventDefault();
                                                   visitedGroupsRef.current.add(group.id);
                                                   setSelectedGroupId(group.id);
                                                }
                                             }}
                                             className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left border border-transparent hover:border-white/5"
                                          >
                                             {isDM ? (
                                                <div className="relative shrink-0">
                                                   <ProtectedAvatar
                                                      userId={group.dm_partner!.id}
                                                      src={group.dm_partner!.avatar_url}
                                                      username={name}
                                                      className="w-10 h-10 rounded-full border border-white/10 bg-slate-900 shrink-0"
                                                   />
                                                   {isUserOnline && (
                                                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full ring-1 ring-emerald-400/40" />
                                                   )}
                                                </div>
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
                                                <div className="flex items-center justify-between gap-1">
                                                   <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                      <span className="text-xs font-black uppercase text-indigo-400 tracking-wide truncate">
                                                         {name}
                                                      </span>
                                                      {isDM && (
                                                         <span className="text-[10px] text-gray-400 shrink-0">
                                                            {isUserOnline ? (
                                                               <span className="text-emerald-400 font-semibold">• Online</span>
                                                            ) : userLastSeenAt ? (
                                                               `• ${formatLastSeen(userLastSeenAt)}`
                                                            ) : null}
                                                         </span>
                                                      )}
                                                   </div>
                                                   <div className="flex items-center gap-1 shrink-0">
                                                      {isDM && isUserOnline && (
                                                         <button
                                                            type="button"
                                                            onClick={(e) => {
                                                               e.stopPropagation();
                                                               const partner = group.dm_partner;
                                                               if (!partner) return;
                                                               const isCalling = activeCall?.targetUser?.id === partner.id && (activeCall?.status === 'calling' || activeCall?.status === 'connected');
                                                               if (isCalling) {
                                                                  triggerToast("Call already in progress", TOAST_DURATION.SHORT);
                                                                  return;
                                                               }
                                                               initiatePrivateCall({
                                                                  id: partner.id,
                                                                  username: partner.username || "User",
                                                                  avatar_url: partner.avatar_url || ""
                                                               });
                                                            }}
                                                            className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                                            title={`Voice call with ${name}`}
                                                         >
                                                            <Phone className="w-3.5 h-3.5" />
                                                         </button>
                                                      )}
                                                      {unreadCount > 0 && (
                                                         <span className="bg-rose-500/25 border border-rose-500/20 text-rose-300 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                                            {unreadCount} unread
                                                         </span>
                                                      )}
                                                   </div>
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
                                          </div>
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
                              <div className="space-y-4">
                                 <VoiceControlBar />

                                 {/* In-chat search bar */}
                                 <AnimatePresence>
                                    {isChatSearchOpen && (
                                       <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="overflow-hidden mb-2"
                                       >
                                          <div className="relative">
                                             <input
                                                type="text"
                                                autoFocus
                                                value={chatSearchQuery}
                                                onChange={(e) => setChatSearchQuery(e.target.value)}
                                                placeholder="Search in this conversation..."
                                                className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl py-1.5 pl-8 pr-8 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 transition-all shadow-inner"
                                             />
                                             <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
                                             {chatSearchQuery && (
                                                <button
                                                   onClick={() => setChatSearchQuery("")}
                                                   className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
                                                >
                                                   <X size={12} />
                                                </button>
                                             )}
                                          </div>
                                          {chatSearchQuery.trim() && (
                                             <div className="text-[10px] text-indigo-300/70 mt-1 px-1 flex justify-between items-center">
                                                <span>
                                                   {activeRoomMessages.filter((m: any) => {
                                                      const content = getDecryptedContent(m) || "";
                                                      const author = m.profiles?.username || "";
                                                      return content.toLowerCase().includes(chatSearchQuery.toLowerCase()) || author.toLowerCase().includes(chatSearchQuery.toLowerCase());
                                                   }).length} matches found
                                                </span>
                                             </div>
                                          )}
                                       </motion.div>
                                    )}
                                 </AnimatePresence>

                                 {hasMoreMessages && !chatSearchQuery.trim() && (
                                    <div className="flex flex-col items-center gap-2 pb-2">
                                       <button onClick={handleLoadMoreMessages} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1 rounded-full transition-colors cursor-pointer">
                                          Load older messages ({allRoomMessages.length - activeRoomMessages.length} remaining)
                                       </button>
                                       <div className="h-px w-full bg-white/10" />
                                    </div>
                                 )}
                                 {activeRoomMessages.map((msg: any) => {
                                    const isMe = msg.user_id === user?.id;
                                    const isEditing = editingMessageId === msg.id;
                                    const content = getDecryptedContent(msg);
                                    const userColor = getUserChatColor(msg.user_id);
                                    const isGroupChat = selectedGroupObject?.type !== "dm";
                                    const isSearchMatch = !!(chatSearchQuery.trim() && (
                                       (content && content.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
                                       (msg.profiles?.username && msg.profiles.username.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                                    ));
                                    const isSearchDimmed = !!(chatSearchQuery.trim() && !isSearchMatch);

                                    return (
                                       <div
                                          key={msg.id}
                                          data-message-id={msg.id}
                                          onMouseEnter={() => !isMe && !msg.is_read && handleMarkAsRead(msg.id)}
                                          onClick={isMe && msg.status === "failed" ? () => handleRetryMessage(msg) : undefined}
                                          onTouchStart={() => { if (!(isMe && msg.status === "failed")) handleTouchStart(msg.id); }}
                                          onTouchEnd={handleTouchEnd}
                                          onTouchMove={handleTouchMove}
                                          onTouchCancel={handleTouchEnd}
                                          className={`relative ${reactingMessageId === msg.id || reactingModalMessageId === msg.id ? 'z-50' : 'z-auto'} overflow-visible ${isMe && msg.status === "failed" ? "cursor-pointer" : ""} ${isSearchDimmed ? "opacity-30 transition-opacity" : isSearchMatch ? "ring-2 ring-indigo-400/80 rounded-2xl p-1 bg-indigo-950/20 transition-all" : "transition-opacity"}`}
                                          title={isMe && msg.status === "failed" ? "Tap to retry" : undefined}
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
                                                className={`w-8 h-8 rounded-full border bg-slate-900 shrink-0 ${!isMe && isGroupChat ? userColor.border : "border-white/10"}`}
                                             />
                                             <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : ""}`}>
                                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                                   <span className={`text-[10px] font-black uppercase tracking-wider ${isMe ? "text-indigo-400" : isGroupChat ? userColor.name : "text-indigo-400"}`}>
                                                      {msg.profiles?.username || "User"}
                                                   </span>
                                                   <span className="text-[8px] text-gray-500 inline-flex items-center gap-1">
                                                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                      {isMe && !msg.is_deleted && (
                                                         msg.status === "sending" ? (
                                                            <span className="animate-spin text-white/50 text-[8px]">⌛</span>
                                                         ) : msg.status === "failed" ? (
                                                            <span className="text-red-400 text-[8px] font-black cursor-pointer">⚠️ retry</span>
                                                         ) : (
                                                            <CheckCheck size={10} className={resolveTickState(msg, user?.id, peerReceipts) === "read" ? "text-blue-400" : "text-white/30"} />
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
                                                            <div
                                                               onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  handleJumpToMessage(msg.reply_to);
                                                               }}
                                                               className={`flex items-center gap-2 mb-1.5 text-[10px] text-white/60 bg-white/5 hover:bg-white/10 border-l-2 border-correct/40 px-3 py-1.5 rounded-t-xl max-w-[85%] cursor-pointer transition-colors ${isMe ? 'flex-row-reverse ml-auto' : ''}`}
                                                            >
                                                               <Reply size={10} className="text-correct shrink-0" />
                                                               <span className="truncate text-gray-400">
                                                                  {replyToMsg.profiles?.username || 'User'}: {replyToMsg.voice_url ? '🎤 Voice note' : replyToMsg.image_url ? '📷 Image' : getDecryptedContent(replyToMsg)}
                                                               </span>
                                                            </div>
                                                         );
                                                      })()}
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
                                                            <p className={`text-xs text-left mt-1 leading-relaxed whitespace-pre-wrap break-words px-3 py-2 rounded-2xl ${isMe
                                                               ? 'bg-indigo-600 border border-indigo-500 text-white'
                                                               : isGroupChat
                                                                  ? `${userColor.bg} border ${userColor.border} text-gray-100`
                                                                  : 'bg-white/5 border border-white/5 text-gray-200'
                                                               }`}>
                                                               {renderFormattedMessageText(getDecryptedContent(msg), profile?.username, isMe)}
                                                               {msg.is_edited && (
                                                                  <span className="text-[8px] text-gray-500 ml-1">(edited)</span>
                                                               )}
                                                            </p>
                                                         )}
                                                      </motion.div>

                                                      {/* Action buttons (Reply, React, Edit, Delete) */}
                                                      {!msg.is_deleted && !isEditing && msg.status !== "failed" && (
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

                                                      {/* Messenger-style Reaction Splash Animation */}
                                                      <AnimatePresence>
                                                         {activeSplashes[msg.id] && (
                                                            <ReactionSplash
                                                               emoji={activeSplashes[msg.id]}
                                                               onComplete={() => {
                                                                  setActiveSplashes((prev) => {
                                                                     const next = { ...prev };
                                                                     delete next[msg.id];
                                                                     return next;
                                                                  });
                                                               }}
                                                            />
                                                         )}
                                                      </AnimatePresence>
                                                   </div>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    );
                                 })}
                                 {typingNames.length > 0 && (
                                    <TypingBubble name={typingNames.length === 1 ? typingNames[0] : typingNames.join(", ")} />
                                 )}
                                 {/* Bottom scroll anchor sentinel */}
                                 <div ref={messagesEndRef} className="h-1 shrink-0 pointer-events-none" />

                                 {/* Scroll to latest button */}
                                 <AnimatePresence>
                                    {isScrolledUp && (
                                       <motion.button
                                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                          onClick={() => scrollToLatest(true)}
                                          className="sticky bottom-3 left-1/2 -translate-x-1/2 mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider shadow-xl border border-indigo-400/40 z-30 cursor-pointer backdrop-blur-md"
                                          title="Scroll to latest messages"
                                       >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                          <span>Latest</span>
                                       </motion.button>
                                    )}
                                 </AnimatePresence>
                              </div>
                           )}
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
                                          replyTextRef.current = value;
                                          setReplyText(value);
                                          setSelfTyping(value.length > 0);
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
                                          type="button"
                                          onClick={stopRecording}
                                          className="bg-red-600 text-white p-2.5 rounded-xl cursor-pointer relative"
                                          title="Stop and send"
                                       >
                                          <Send className="w-4 h-4" />
                                          <div className="absolute inset-0 bg-red-500 rounded-xl animate-ping opacity-25" />
                                       </button>
                                    ) : (
                                       <button
                                          type="button"
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
                                       disabled={!replyText.trim()}
                                       className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white p-2.5 rounded-xl transition-colors cursor-pointer"
                                    >
                                       <Send className="w-4 h-4" />
                                    </button>
                                 )}
                              </div>
                           </div>
                        )}
                     </motion.div>
                  </motion.div>
               </>
            )}
         </AnimatePresence>

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
                     onInfo={isMe ? () => { setInfoMsg(modalMsg); setReactingModalMessageId(null); } : undefined}
                     onClose={() => setReactingModalMessageId(null)}
                  />
               );
            })()}
         </AnimatePresence>

         {/* Message Info */}
         <MessageInfoModal
            open={!!infoMsg}
            onClose={() => setInfoMsg(null)}
            createdAt={infoMsg?.created_at || new Date().toISOString()}
            kindLabel={
               infoMsg?.voice_url ? "🎤 Voice note"
                  : infoMsg?.image_url ? "📷 Image"
                     : infoMsg
                        ? (getDecryptedContent(infoMsg) || "Message").slice(0, 60)
                        : "Message"
            }
            peerReceipts={peerReceipts}
            resolveName={(uid) => getUserName(uid)}
         />

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