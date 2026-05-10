import { useEffect, useRef, useState } from "react";
import { useChat, type Message } from "../hooks/useChat";
import { MessageSquare, SendIcon, Lock, Reply, CheckCheck } from "lucide-react";
import type { AppUser } from "../types/game";
import { useAuth } from "../hooks/useAuth";

const ChatRoom = ({ user }: { user: AppUser }) => {
    const { messages, sendMessage, typingUsers, setTyping, markAsRead,firstUnreadId } = useChat(user?.id);

    const [input, setInput] = useState("");
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { signInWithGoogle } = useAuth();

    // Auto-scroll on new message
    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [messages, typingUsers]);

    const nameOfUser = user.user_metadata?.full_name as string

    // Handle typing indicator logic
    const handleInputChange = (val: string) => {
        setInput(val);
        if (user) {

            if (val.length === 0) {
                setTyping(false, nameOfUser);
            } else {
                setTyping(true, nameOfUser);
            }
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        // Extract mentions (simple @username regex)
        const mentions = input.match(/@(\w+)/g)?.map(m => m.substring(1));

        await sendMessage(input, replyingTo?.id, mentions);
        setInput("");
        setReplyingTo(null);
        setTyping(false, nameOfUser);

    };

    if (!user) {
        return (
            <div className="flex flex-col h-125 w-full max-w-md mx-auto bg-gray-950/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl items-center justify-center p-8 text-center">
                <div className="relative mb-6">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 rotate-12 transition-transform">
                        <MessageSquare size={32} className="text-gray-500 -rotate-12" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-correct rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,255,0,0.3)]">
                        <Lock size={14} className="text-black" />
                    </div>
                </div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-6">Chat Room Restricted</h3>
                <button onClick={signInWithGoogle} className="mt-4 w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-correct transition-all">
                    Login with Google
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-125 w-full max-w-md mx-auto bg-gray-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl relative">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-linear-to-tr from-correct to-emerald-400 flex items-center justify-center text-black font-black text-xs">
                            {user.user_metadata?.full_name ? user.user_metadata?.full_name[0].toUpperCase() : ""}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-correct border-2 border-gray-950 rounded-full" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tighter text-white">Chat Room</h3>
                        <p className="text-[9px] text-correct font-bold uppercase animate-pulse">
                            {typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : 'Live Now'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Message Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                {messages.map((msg,) => {
                    const isMe = msg.user_id === user.id;
                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const replyMsg = messages.find(m => m.id === msg.reply_to);

                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                            onMouseEnter={() => !isMe && !msg.is_read && markAsRead(msg.id)}
                        >
                            {msg.id === firstUnreadId && (
                                <div className="flex items-center my-8 gap-4 px-4">
                                    <div className="h-px flex-1 bg-correct/20" />
                                    <span className="text-[9px] font-black text-correct uppercase tracking-widest bg-correct/10 px-3 py-1 rounded-full border border-correct/20">
                                        New Messages
                                    </span>
                                    <div className="h-px flex-1 bg-correct/20" />
                                </div>
                            )}
                            {/* Reply Preview inside Chat */}
                            {replyMsg && (
                                <div className={`text-[10px] mb-1 flex items-center gap-1 text-gray-500 italic ${isMe ? 'flex-row-reverse' : ''}`}>
                                    <Reply size={10} /> Replying to {replyMsg.profiles?.username}
                                </div>
                            )}

                            <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <img src={msg.profiles?.avatar_url} className="w-5 h-5 rounded-full" alt="avatar" />
                                <span className="text-[10px] font-black text-gray-400 uppercase">{msg.profiles?.username}</span>
                                <button onClick={() => setReplyingTo(msg)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded">
                                    <Reply size={12} className="text-gray-400" />
                                </button>
                            </div>

                            <div className={`relative max-w-[85%] p-3 px-4 rounded-2xl text-[13px] ${isMe
                                ? 'bg-linear-to-br from-correct to-emerald-500 text-black font-bold rounded-tr-none'
                                : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'}`}>

                                {msg.content}

                                <div className={`text-[8px] mt-1 flex items-center gap-1 ${isMe ? 'justify-end text-black/50' : 'justify-start text-gray-500'}`}>
                                    {time}
                                    {isMe && <CheckCheck size={10} className={msg.is_read ? "text-blue-600" : "text-black/30"} />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-transparent space-y-2">
                {replyingTo && (
                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border-l-2 border-correct px-4">
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-black text-correct uppercase">Replying to {replyingTo.profiles?.username}</p>
                            <p className="text-[11px] text-gray-400 truncate">{replyingTo.content}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-white">×</button>
                    </div>
                )}

                <form onSubmit={handleSend} className="relative flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 pl-4 rounded-2xl focus-within:border-correct/50 transition-all">
                    <input
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder="Message (use @ for mentions)..."
                        className="flex-1 bg-transparent border-none py-2 text-sm text-white focus:ring-0 outline-none"
                    />
                    <button type="submit" disabled={!input.trim()} className="bg-correct text-black h-9 w-9 rounded-xl flex items-center justify-center disabled:opacity-50 transition-all">
                        <SendIcon size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatRoom;