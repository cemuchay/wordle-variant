import React, { useEffect, useRef, useState, memo, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Pencil, Trash2, Smile } from "lucide-react";
import { type ChallengeMessage } from "../../hooks/useChallengeChat";
import { type ChallengeParticipant } from "../../hooks/useChallenge";
import { useConfirmation } from "../../hooks/useConfirmation";
import { CHALLENGE_LIMITS, CHALLENGE_TIMEOUT } from "../../constants/challenge";
import { ProtectedAvatar } from "../chat/ProtectedAvatar";
import { ChatImage } from "../chat/ChatMessage/ChatImage";
import { ConnectedAudioPlayer } from "../chat/ChatMessage/ConnectedAudioPlayer";
import { VoiceControlBar } from "../chat/VoiceControlBar";
import formatUsername from '../../utils/formatUsername';

interface ChallengeChatProps {
  messages: ChallengeMessage[];
  sendMessage: (content: string) => Promise<void>;
  editMessage: (id: string, newContent: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  reactToMessage: (id: string, emoji: string | null) => Promise<void>;
  typingUsers: string[];
  setTyping: (isTyping: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effectiveUser: any;
  loading?: boolean;
  participants: ChallengeParticipant[];
}

interface ChallengeChatMessageProps {
  msg: ChallengeMessage;
  isMe: boolean;
  usernames: string[];
  avatarUrl?: string;
  senderColor: string;
  allMessageIds?: string[];
  allMessages?: ChallengeMessage[];
  onEdit: (newContent: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onReact: (emoji: string | null) => void;
  currentUserId: string;
  participants: ChallengeParticipant[];
}

const MENTION_COLORS = ["#4ade80", "#60a5fa", "#f87171", "#fbbf24", "#c084fc", "#22d3ee", "#f472b6", "#fb923c"];
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const ReactionPicker = React.forwardRef<HTMLDivElement, {
  onReact: (emoji: string | null) => void;
  currentReaction?: string;
  isMe: boolean;
}>(({ onReact, currentReaction, isMe }, ref) => (
  <motion.div
    ref={ref}
    initial={{ scale: 0.8, opacity: 0, y: 10 }}
    animate={{ scale: 1, opacity: 1, y: 0 }}
    exit={{ scale: 0.8, opacity: 0, y: 10 }}
    className={`absolute ${isMe ? 'right-0' : 'left-0'} top-[-54px] flex items-center gap-1 bg-[#1f2c34] border border-white/15 rounded-2xl px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50`}
  >
    <div className="flex items-center gap-1 pr-2 border-r border-white/10">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(currentReaction === emoji ? null : emoji)}
          className={`text-[18px] w-9 h-9 flex items-center justify-center hover:scale-125 transition-transform duration-100 cursor-pointer rounded-full ${currentReaction === emoji ? 'bg-white/10' : 'hover:bg-white/5'}`}
        >
          {emoji}
        </button>
      ))}
    </div>
    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/40">
      React
    </div>
  </motion.div>
));

const ReactionBadge = React.forwardRef<HTMLDivElement, {
  reactions: Record<string, string>;
  onShowDetails: () => void;
  isMe: boolean;
}>(({ reactions, onShowDetails, isMe }, ref) => {
  const emojis = Array.from(new Set(Object.values(reactions))).slice(0, CHALLENGE_LIMITS.MAX_OPPONENT_AVATARS);
  const count = Object.keys(reactions).length;

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onShowDetails();
      }}
      className={`absolute bottom-[-10px] ${isMe ? 'left-3' : 'right-3'} flex items-center gap-0.5 bg-[#1f2c34] border border-white/10 rounded-full px-1.5 py-0.5 shadow-md z-30 cursor-pointer hover:bg-[#2a3942] transition-colors`}
    >
      {emojis.map((emoji, idx) => (
        <span key={idx} className="text-[10px]">{emoji}</span>
      ))}
      <span className="text-[9px] text-white font-black ml-0.5">{count}</span>
    </div>
  );
});
const ChallengeChatMessage = memo(function ChallengeChatMessage({
  msg,
  isMe,
  usernames,
  avatarUrl,
  senderColor,
  onEdit,
  onDelete,
  onReact,
  currentUserId,
  participants,
  allMessageIds,
  allMessages
}: ChallengeChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showReactionDetails, setShowReactionDetails] = useState(false);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  // Outside click to close menus
  useEffect(() => {
    if (!showReactionsMenu && !showReactionDetails) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showReactionsMenu && reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
        setShowReactionsMenu(false);
      }
      if (showReactionDetails && detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        setShowReactionDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReactionsMenu, showReactionDetails]);

  const isWithinTimeLimit = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const elapsed = Date.now() - new Date(msg.created_at).getTime();
    return elapsed < CHALLENGE_TIMEOUT.EDIT_TIME_LIMIT;
  }, [msg.created_at]);

  const isEditable = isMe && !msg.is_deleted && isWithinTimeLimit;

  return (
    <div
      className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end animate-in slide-in-from-right-3 duration-200" : "items-start animate-in slide-in-from-left-3 duration-200"} mb-4 relative group ${showReactionsMenu ? 'z-50' : 'z-auto'}`}
    >
      <AnimatePresence>
        {showReactionsMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowReactionsMenu(false)}
            className="fixed inset-0 bg-black/10 z-40"
          />
        )}
      </AnimatePresence>

      <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {!msg.is_deleted && !isEditing && (
          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-0.5 transition-all bg-black/25 rounded-md px-1 py-0.5 border border-white/5">
            <button
              type="button"
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer relative"
              title="React"
            >
              <Smile size={13} className="text-white" />
            </button>
            {isEditable && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditText(msg.content);
                    setIsEditing(true);
                  }}
                  className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                  title="Edit message"
                >
                  <Pencil size={13} className="text-blue-400" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Delete this message?")) {
                      onDelete();
                    }
                  }}
                  className="p-1 hover:bg-white/10 rounded-md transition-all cursor-pointer"
                  title="Delete message"
                >
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </>
            )}
          </div>
        )}

        <AnimatePresence>
          {showReactionsMenu && (
            <ReactionPicker
              ref={reactionsRef}
              isMe={isMe}
              onReact={(emoji) => {
                onReact(emoji);
                setShowReactionsMenu(false);
              }}
              currentReaction={msg.reactions?.[currentUserId]}
            />
          )}
        </AnimatePresence>

      </div>

      <div
        className={`relative p-3 px-4 shadow-lg transition-all text-left ${isMe
          ? "bg-[#005c4b] text-white rounded-2xl rounded-tr-none"
          : "bg-[#202c33] border border-white/5 text-white rounded-2xl rounded-tl-none hover:bg-[#2a3942]"
          }`}
      >
        {/* Sender profile header inside the bubble container */}
        <div className={`flex items-center gap-1.5 mb-1.5 justify-start text-left`}>
          <ProtectedAvatar
            userId={msg.sender_id || undefined}
            src={avatarUrl || undefined}
            username={formatUsername(msg.sender_name) || undefined}
            className="w-4 h-4 rounded-full border border-white/10 cursor-pointer hover:scale-105 transition-transform"
            onClick={(e) => {
              if (msg.sender_id) {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: msg.sender_id } }));
              }
            }}
          />
          <span
            className="text-[9px] font-black uppercase tracking-wider cursor-pointer hover:underline text-left"
            style={{
              color: isMe
                ? '#82e0aa'
                : senderColor
            }}
            onClick={(e) => {
              if (msg.sender_id) {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId: msg.sender_id } }));
              }
            }}
          >
            {isMe ? 'You' : formatUsername(msg.sender_name)}
          </span>
        </div>

        <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap wrap-break-word text-left">
          {msg.is_deleted ? (
            <span className="text-white/40 italic font-medium flex items-center gap-1">
              🚫 This message was deleted
            </span>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px] mt-1">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-black/25 text-white border border-white/15 rounded-lg p-1.5 text-xs outline-none focus:border-correct resize-none font-sans"
                rows={2}
                maxLength={CHALLENGE_LIMITS.MAX_MESSAGE_LENGTH}
               />
               <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-white/60 hover:text-white text-[10px] font-black uppercase bg-white/5 px-2.5 py-1 rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (editText.trim() && editText.trim() !== msg.content) {
                      await onEdit(editText.trim());
                    }
                    setIsEditing(false);
                  }}
                  className="text-black bg-correct hover:brightness-110 text-[10px] font-black uppercase px-2.5 py-1 rounded cursor-pointer transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          ) : msg.voice_url ? (
            <ConnectedAudioPlayer
              url={msg.voice_url}
              messageId={msg.id}
              allMessageIds={allMessageIds}
              allMessages={allMessages}
              userId={currentUserId}
            />
          ) : msg.image_url ? (
            <ChatImage url={msg.image_url} />
          ) : (
            formatMessageContent(msg.content, isMe, usernames)
          )}
        </div>

        <div className="text-[10px] mt-1 flex font-mono font-bold items-center gap-1.5 justify-end text-white/60 text-left">
          {msg.is_edited && !msg.is_deleted && (
            <span className="text-[8px] font-black uppercase tracking-wider text-white/40 italic">(edited)</span>
          )}
          {new Date(msg.created_at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </div>

        {/* Reactions Count Display */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && !msg.is_deleted && (
          <>
            <ReactionBadge
              ref={detailsRef}
              reactions={msg.reactions}
              isMe={isMe}
              onShowDetails={() => setShowReactionDetails(!showReactionDetails)}
            />

            {/* Reactions Details Popover */}
            <AnimatePresence>
              {showReactionDetails && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className={`absolute bottom-full mb-2 ${isMe ? 'left-0' : 'right-0'} bg-[#1f2c34] border border-white/15 rounded-2xl p-2 shadow-2xl z-50 min-w-[140px] max-w-[200px]`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(msg.reactions).map(([uid, emoji]) => {
                      const participant = participants?.find(p => p.user_id === uid || p.guest_id === uid);
                      const username = participant?.profiles?.username || participant?.guest_profiles?.username || 'Someone';
                      const avatar = participant?.profiles?.avatar_url || '';

                      return (
                        <div key={uid} className="flex items-center justify-between gap-3 px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <ProtectedAvatar
                              userId={uid}
                              src={avatar}
                              username={username}
                              className="w-4 h-4 rounded-full shrink-0"
                            />
                            <span className="text-[10px] font-black text-white truncate">
                              {uid === currentUserId ? 'You' : username}
                            </span>
                          </div>
                          <span className="text-[12px] shrink-0">{emoji as string}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

      </div>
    </div>
  );
});

const formatMessageContent = (
  content: string,
  isMe: boolean,
  usernames: string[],
) => {
  if (!content) return [];
  let parts: (string | React.JSX.Element)[] = [content];

  // 1. Match exact participant usernames (including those with spaces)
  usernames.forEach((username) => {
    const mention = `@${username}`;
    const newParts: (string | React.JSX.Element)[] = [];

    parts.forEach((part, pIdx) => {
      if (typeof part !== "string") {
        newParts.push(part);
        return;
      }

      const escapedMention = mention.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const subParts = part.split(
        new RegExp(`(${escapedMention}(?:\\s|$))`, "g"),
      );

      subParts.forEach((subPart, sIdx) => {
        if (subPart.startsWith(mention)) {
          const endsWithSpace = subPart.endsWith(" ");
          const cleanMention = endsWithSpace ? subPart.slice(0, -1) : subPart;

          newParts.push(
            <span
              key={`mention-${username}-${pIdx}-${sIdx}`}
              className={`px-1.5 py-0.5 rounded font-black whitespace-nowrap inline-block ${isMe
                ? "bg-black/15 text-black border border-black/10"
                : "bg-correct/20 text-correct border border-correct/10"
                }`}
            >
              {cleanMention}
            </span>,
          );
          if (endsWithSpace) newParts.push(" ");
        } else if (subPart !== "") {
          newParts.push(subPart);
        }
      });
    });
    parts = newParts;
  });

  // 2. Fallback: Match any remaining standard @username mentions (without spaces)
  const finalParts: (string | React.JSX.Element)[] = [];
  parts.forEach((part, pIdx) => {
    if (typeof part !== "string") {
      finalParts.push(part);
      return;
    }

    const subParts = part.split(/(@[A-Za-z0-9_]+)/g);
    subParts.forEach((subPart, sIdx) => {
      if (subPart.startsWith("@")) {
        finalParts.push(
          <span
            key={`fallback-${pIdx}-${sIdx}`}
            className={`px-1.5 py-0.5 rounded font-black whitespace-nowrap inline-block ${isMe
              ? "bg-black/15 text-black border border-black/10"
              : "bg-correct/20 text-correct border border-correct/10"
              }`}
          >
            {subPart}
          </span>,
        );
      } else if (subPart !== "") {
        finalParts.push(subPart);
      }
    });
  });

  return finalParts;
};

export const ChallengeChat = memo(function ChallengeChat({
  messages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  typingUsers,
  setTyping,
  effectiveUser,
  loading = false,
  participants,
}: ChallengeChatProps) {
  const { ask } = useConfirmation();
  const [inputText, setInputText] = useState("");

  // Extract all unique usernames in this challenge room (including ourselves)
  const usernames = useMemo(() => {
    const set = new Set<string>();
    if (participants) {
      participants.forEach((p) => {
        const username =
          p.profiles?.username || p.guest_profiles?.username || "";
        if (username) set.add(username);
      });
    }
    const myName =
      effectiveUser?.username || effectiveUser?.user_metadata?.full_name || "";
    if (myName) set.add(myName);
    return Array.from(set).sort((a, b) => b.length - a.length);
  }, [participants, effectiveUser]);

  // Consolidate input regex matches into a single computation
  const mentionMatch = useMemo(() => {
    const match = inputText.match(/@(\w*)$/);
    return match
      ? { show: true, query: match[1].toLowerCase() }
      : { show: false, query: "" };
  }, [inputText]);

  const showMentionsDropdown = mentionMatch.show;
  const mentionSearchQuery = mentionMatch.query;

  const mentionSuggestions = useMemo(() => {
    if (!showMentionsDropdown || !participants) return [];

    const suggestionsSet = new Set<string>();
    const myUsername =
      effectiveUser?.username || effectiveUser?.user_metadata?.full_name || "";

    participants.forEach((p) => {
      const username = p.profiles?.username || p.guest_profiles?.username || "";
      if (
        username &&
        username !== myUsername &&
        username.toLowerCase().includes(mentionSearchQuery)
      ) {
        suggestionsSet.add(username);
      }
    });

    return Array.from(suggestionsSet);
  }, [participants, showMentionsDropdown, mentionSearchQuery, effectiveUser]);

  const handleSelectMention = useCallback((username: string) => {
    setInputText((prev) => {
      const match = prev.match(/@(\w*)$/);
      if (match) {
        const index = match.index!;
        return prev.substring(0, index) + `@${username} `;
      }
      return prev;
    });
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim()) return;
      const textToSend = inputText.trim();
      setInputText("");
      await sendMessage(textToSend);
    },
    [inputText, sendMessage],
  );

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col h-full min-h-0 space-y-3 relative overflow-hidden"
      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-correct/5 blur-2xl -mr-12 -mt-12 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 shrink-0">
        <MessageSquare size={14} className="text-correct" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white">
          Real-time Room Chat
        </span>
      </div>

      {/* Messages List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10 scroll-smooth"
      >
        {loading && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-correct border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/80 space-y-2 animate-in fade-in duration-300">
            <MessageSquare size={28} className="text-white/40 animate-pulse" />
            <div>
              <p className="text-[10px] font-black uppercase text-white">
                Room is Quiet
              </p>
              <p className="text-[9px] text-white/80 mt-0.5">
                Send a message to start the banter!
              </p>
            </div>
          </div>
        ) : (
          <>
            <VoiceControlBar />
            {messages.map((msg) => {
            const isMe = !!(
              (msg.sender_id && msg.sender_id === effectiveUser?.id) ||
              (msg.guest_sender_id && msg.guest_sender_id === effectiveUser?.id)
            );

            const participant = participants?.find(p => p.user_id === msg.sender_id || p.guest_id === msg.guest_sender_id);
            const avatarUrl = participant?.profiles?.avatar_url || '';
            const participantIndex = participants?.findIndex(p => p.user_id === msg.sender_id || p.guest_id === msg.guest_sender_id);
            const senderColor = MENTION_COLORS[participantIndex % MENTION_COLORS.length] || '#38bdf8';

            return (
              <ChallengeChatMessage
                key={msg.id}
                msg={msg}
                isMe={isMe}
                usernames={usernames}
                avatarUrl={avatarUrl}
                senderColor={senderColor}
                onEdit={(newContent) => editMessage(msg.id, newContent)}
                onDelete={async () => {
                  const confirmed = await ask({
                    title: "Delete Message",
                    message: "Are you sure you want to delete this message? This action cannot be undone.",
                    confirmLabel: "Delete",
                    cancelLabel: "Cancel",
                    type: "danger"
                  });
                  if (confirmed) {
                    await deleteMessage(msg.id);
                  }
                }}
                onReact={(emoji) => reactToMessage(msg.id, emoji)}
                currentUserId={effectiveUser?.id}
                participants={participants}
                allMessageIds={messages.map((m) => m.id)}
                allMessages={messages}
              />
            );
          })}
          </>
        )}
      </div>

      {/* Mention Suggestions Dropdown */}
      {mentionSuggestions.length > 0 && (
        <div
          className={`absolute left-4 right-4 ${typingUsers.length > 0 ? "bottom-[72px]" : "bottom-[55px]"} bg-gray-950/98 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[150px] overflow-y-auto z-50 divide-y divide-white/5 animate-in fade-in slide-in-from-bottom-2 duration-150`}
        >
          {mentionSuggestions.map((username) => (
            <button
              key={username}
              type="button"
              onClick={() => handleSelectMention(username)}
              className="w-full px-4 py-2.5 text-left text-xs font-bold text-white hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <span className="text-correct">@</span>
              <span>{username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="text-[10px] text-white/80 italic px-1 shrink-0 animate-pulse">
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"}{" "}
          typing...
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 border-t border-white/5 pt-3 shrink-0"
      >
        <textarea
          maxLength={CHALLENGE_LIMITS.MAX_MESSAGE_LENGTH}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setTyping(true);
            // Auto-grow height
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/60 focus:border-correct outline-none focus:ring-1 focus:ring-correct/20 transition-all font-medium resize-none max-h-[120px] scrollbar-hide"
          rows={1}
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-correct hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 text-black h-[38px] w-[38px] rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer shrink-0"
        >
          <Send size={12} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
});
