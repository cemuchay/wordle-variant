import { useEffect, useRef, useState, memo } from "react";
import { Send, MessageSquare } from "lucide-react";
import { useChallengeChat } from "../../hooks/useChallengeChat";

interface ChallengeChatProps {
  challengeId: string;
  effectiveUser: any;
  isGuest: boolean;
}

export const ChallengeChat = memo(function ChallengeChat({
  challengeId,
  effectiveUser,
  isGuest,
}: ChallengeChatProps) {
  const { messages, sendMessage, loading } = useChallengeChat(
    challengeId,
    effectiveUser,
    isGuest
  );
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText("");
    await sendMessage(textToSend);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col h-[450px] space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-correct/5 blur-2xl -mr-12 -mt-12 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 shrink-0">
        <MessageSquare size={14} className="text-correct" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
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
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2 animate-in fade-in duration-300">
            <MessageSquare size={28} className="text-gray-600 animate-pulse" />
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Room is Quiet</p>
              <p className="text-[9px] text-gray-500 mt-0.5">Send a message to start the banter!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              (msg.sender_id && msg.sender_id === effectiveUser?.id) ||
              (msg.guest_sender_id && msg.guest_sender_id === effectiveUser?.id);

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end animate-in slide-in-from-right-3 duration-200" : "items-start animate-in slide-in-from-left-3 duration-200"}`}
              >
                <span className="text-[8px] text-gray-500 font-black uppercase mb-0.5 px-1 tracking-wider">
                  {msg.sender_name} {isMe && "(You)"}
                </span>
                <div
                  className={`px-3 py-2 text-xs font-semibold break-words leading-relaxed rounded-2xl ${
                    isMe
                      ? "bg-correct text-black rounded-tr-none shadow-md shadow-correct/5 font-bold"
                      : "bg-white/10 text-white rounded-tl-none border border-white/5"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[7px] text-white/20 px-1 mt-0.5 font-bold tabular-nums">
                  {new Date(msg.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/5 pt-3 shrink-0">
        <input
          type="text"
          maxLength={300}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-correct outline-none focus:ring-1 focus:ring-correct/20 transition-all font-medium"
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
