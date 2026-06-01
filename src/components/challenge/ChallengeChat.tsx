import { useEffect, useRef, useState, memo, useMemo, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { type ChallengeMessage } from "../../hooks/useChallengeChat";
import { type ChallengeParticipant } from "../../hooks/useChallenge";

interface ChallengeChatProps {
  messages: ChallengeMessage[];
  sendMessage: (content: string) => Promise<void>;
  typingUsers: string[];
  setTyping: (isTyping: boolean) => void;
  effectiveUser: any;
  loading?: boolean;
  participants: ChallengeParticipant[];
}

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

      const escapedMention = mention.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
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
              className={`px-1.5 py-0.5 rounded font-black whitespace-nowrap inline-block ${
                isMe
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
            className={`px-1.5 py-0.5 rounded font-black whitespace-nowrap inline-block ${
              isMe
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
  typingUsers,
  setTyping,
  effectiveUser,
  loading = false,
  participants,
}: ChallengeChatProps) {
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
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col h-[450px] space-y-3 relative overflow-hidden">
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
          messages.map((msg) => {
            const isMe = !!(
              (msg.sender_id && msg.sender_id === effectiveUser?.id) ||
              (msg.guest_sender_id && msg.guest_sender_id === effectiveUser?.id)
            );

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end animate-in slide-in-from-right-3 duration-200" : "items-start animate-in slide-in-from-left-3 duration-200"}`}
              >
                <span className="text-[8px] text-white/80 font-black uppercase mb-0.5 px-1 tracking-wider">
                  {msg.sender_name} {isMe && "(You)"}
                </span>
                <div
                  className={`px-3 py-2 text-xs font-semibold wrap-break-word leading-relaxed rounded-2xl ${
                    isMe
                      ? "bg-correct text-black rounded-tr-none shadow-md shadow-correct/5 font-bold"
                      : "bg-white/10 text-white rounded-tl-none border border-white/5"
                  }`}
                >
                  {formatMessageContent(msg.content, isMe, usernames)}
                </div>
                <span className="text-[7px] text-white/20 px-1 mt-0.5 font-bold tabular-nums">
                  {new Date(msg.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            );
          })
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
        className="flex gap-2 border-t border-white/5 pt-3 shrink-0"
      >
        <input
          type="text"
          maxLength={300}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setTyping(true);
          }}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/60 focus:border-correct outline-none focus:ring-1 focus:ring-correct/20 transition-all font-medium"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-correct hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 text-black px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Send size={12} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
});
