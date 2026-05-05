import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { MessageSquare, SendIcon, Lock } from "lucide-react";
import type { AppUser } from "../types/game";
import { useAuth } from "../hooks/useAuth";


const ChatRoom = ({ user }: { user: AppUser }) => {
    const { messages, sendMessage, loading } = useChat();
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const { signInWithGoogle, } = useAuth();

    // Auto-scroll to bottom on new message
    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [messages]);

    if (!user) {
        return (
            <div className="flex flex-col h-125 w-full max-w-md mx-auto bg-gray-950/50 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl items-center justify-center p-8 text-center">
                {/* Icon/Visual Decor */}
                <div className="relative mb-6">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 rotate-12 group-hover:rotate-0 transition-transform">
                        <MessageSquare size={32} className="text-gray-500 -rotate-12" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-correct rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,255,0,0.3)]">
                        <Lock size={14} className="text-black" />
                    </div>
                </div>

                <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-6">
                    Chat Room Restricted
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase mb-8 mt-4 leading-relaxed">
                    You need to be logged in to join the conversation and see live messages.
                </p>

                <button
                    onClick={signInWithGoogle}
                    className="mt-4 w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-correct transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl"
                >
                    Login with Google
                </button>


            </div>
        );
    }
    return (
        <div className="flex flex-col h-125 w-full max-w-md mx-auto bg-gray-950 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {/* Modern Glass Header */}
            <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-linear-to-tr from-correct to-emerald-400 flex items-center justify-center text-black font-black text-xs">
                            L
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-correct border-2 border-gray-950 rounded-full" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tighter text-white">Chat Room</h3>
                        <div className="flex items-center gap-1">
                            <p className="text-[9px] text-correct font-bold uppercase animate-pulse">Live Now</p>
                            <span className="text-[9px] text-gray-500">•</span>
                            <p className="text-[9px] text-gray-500 font-bold uppercase">24h Disappearing Messages</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Area with subtle gradient background */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-[radial-gradient(at_top_right,var(--tw-gradient-stops))] from-gray-900/20 via-transparent to-transparent">
                {messages.map((msg, i) => {
                    const isMe = msg.user_id === user?.id;
                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                            {/* Username & Avatar Row */}
                            <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <img
                                    src={msg.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${msg.profiles?.username}&background=random`}
                                    className="w-5 h-5 rounded-full ring-1 ring-white/10"
                                    alt="avatar"
                                />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">
                                    {msg.profiles?.username || 'User'}
                                </span>
                                <span className="text-[9px] text-gray-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                    {time}
                                </span>
                            </div>

                            {/* Bubble */}
                            <div className={`relative max-w-[85%] p-3 px-4 rounded-2xl text-[13px] leading-relaxed shadow-lg transition-all ${isMe
                                ? 'bg-linear-to-br from-correct to-emerald-500 text-black font-bold rounded-tr-none'
                                : 'bg-white/5 border border-white/10 text-gray-200 font-medium rounded-tl-none backdrop-blur-md'
                                }`}>
                                {msg.content}

                                {/* Tiny time stamp inside for mobile/always-on view */}
                                <div className={`text-[8px] mt-1 flex ${isMe ? 'justify-end text-black/50' : 'justify-start text-gray-500'}`}>
                                    {time}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-gray-950/20 backdrop-blur-sm z-10">
                    <div className="w-6 h-6 border-2 border-correct border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-correct animate-pulse">
                        fetching messages...
                    </p>
                </div>
            )}

            {!loading && messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-3">
                        <MessageSquare size={24} className="text-gray-500" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        No messages yet
                    </p>
                    <p className="text-[9px] font-bold text-gray-600 uppercase mt-1">
                        Be the first to break the silence
                    </p>
                </div>
            )}

            {/* Floating Input Area */}
            <div className="p-4 bg-transparent">
                <form
                    onSubmit={(e) => { e.preventDefault(); sendMessage(input, user.id); setInput(""); }}
                    className="relative flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 pl-4 rounded-2xl focus-within:border-correct/50 transition-all backdrop-blur-md"
                >
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Message the chat room..."
                        className="flex-1 bg-transparent border-none py-2 text-sm text-white placeholder:text-gray-600 focus:ring-0 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="bg-correct text-black h-9 w-9 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)]"
                    >
                        <SendIcon size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatRoom