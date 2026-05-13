import { useState, useRef, useEffect } from "react";
import { SendIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "../../hooks/useChat";
import UserSuggestions from "./UserSuggestions";

interface MessageInputProps {
    onSend: (content: string, replyToId?: string, mentions?: string[]) => void;
    onTyping: (isTyping: boolean) => void;
    replyingTo: Message | null;
    onCancelReply: () => void;
    users: { username: string; avatar_url: string; id: string }[];
}

const MENTION_COLORS = ["#4ade80", "#60a5fa", "#f87171", "#fbbf24", "#c084fc", "#22d3ee", "#f472b6", "#fb923c"];

const MessageInput = ({ onSend, onTyping, replyingTo, onCancelReply, users }: MessageInputProps) => {
    const [input, setInput] = useState("");
    const [mentionState, setMentionState] = useState<{ isVisible: boolean; filter: string; cursorPosition: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (textareaRef.current && backdropRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
            backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const cursorPos = e.target.selectionStart;
        setInput(val);
        onTyping(val.length > 0);

        const textBeforeCursor = val.substring(0, cursorPos);
        const lastAtPos = textBeforeCursor.lastIndexOf("@");

        if (lastAtPos !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);
            // Allow spaces during search so users can find "Chioma Alozie"
            if (!textAfterAt.includes("\n")) {
                setMentionState({
                    isVisible: true,
                    filter: textAfterAt,
                    cursorPosition: cursorPos
                });
            } else {
                setMentionState(null);
            }
        } else {
            setMentionState(null);
        }
    };

    const handleUserSelect = (username: string) => {
        if (!mentionState) return;
        const textBeforeAt = input.substring(0, input.lastIndexOf("@", mentionState.cursorPosition - 1));
        const textAfterCursor = input.substring(mentionState.cursorPosition);
        const newInput = textBeforeAt + "@" + username + " " + textAfterCursor;
        setInput(newInput);
        setMentionState(null);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = (textBeforeAt + "@" + username + " ").length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };


    const handleSend = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        // Match mentions based on actual user list to support spaces
        const mentions: string[] = [];
        users.forEach(u => {
            if (input.includes(`@${u.username}`)) {
                mentions.push(u.id);
            }
        });

        onSend(input, replyingTo?.id, mentions);
        setInput("");
        onTyping(false);
        onCancelReply();
        setMentionState(null);
        if (textareaRef.current) textareaRef.current.style.height = '44px';
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '44px';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [input]);

    const renderHighlightedText = (text: string) => {
        if (!text) return "";
        let highlighted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Sort users by length to prevent partial matches (e.g., matching "@Chioma" instead of "@Chioma Alozie")
        const sortedUsers = [...users].sort((a, b) => b.username.length - a.username.length);

        sortedUsers.forEach((user) => {
            const userIndex = users.findIndex(u => u.username === user.username);
            const color = MENTION_COLORS[userIndex % MENTION_COLORS.length];
            const escapedName = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escapedName}(\\s|$)`, 'g');

            highlighted = highlighted.replace(regex, (match) => {
                // If match ends with space, preserve it outside the span to prevent drift
                const endsWithSpace = match.endsWith(' ');
                const cleanMatch = endsWithSpace ? match.slice(0, -1) : match;
                return `<span style="background-color: ${color}20; color: ${color}; outline: 1px solid ${color}40; border-radius: 4px; padding: 0px 0px;">${cleanMatch}</span>${endsWithSpace ? ' ' : ''}`;
            });
        });

        return highlighted + (text.endsWith('\n') ? '\n ' : '');
    };

    return (
        <div className="px-3 pb-4 pt-2 bg-[#0b141a] relative">
            <AnimatePresence>
                {replyingTo && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mx-2 mb-2 bg-[#1d282f] p-3 rounded-t-2xl border-l-4 border-correct flex justify-between items-start shadow-lg"
                    >
                        <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-correct mb-0.5">Replying to {replyingTo.profiles?.username}</p>
                            <p className="text-[12px] text-[#8696a0] truncate italic">{replyingTo.content}</p>
                        </div>
                        <button onClick={onCancelReply} className="text-[#8696a0] hover:text-white p-1">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative">
                <UserSuggestions
                    users={users}
                    filter={mentionState?.filter || ""}
                    isVisible={!!mentionState?.isVisible}
                    onSelect={handleUserSelect}
                    currentInput={input}
                />

                <div className="flex items-end gap-2 px-2">
                    <div className="flex-1 relative bg-[#2a3942] rounded-[24px] shadow-sm min-h-[44px] overflow-hidden">
                        <div
                            ref={backdropRef}
                            aria-hidden="true"
                            className="absolute inset-0 px-4 py-3 text-[15px] leading-6 font-sans tracking-normal text-left whitespace-pre-wrap wrap-break-word pointer-events-none text-[#e9edef] border-none overflow-y-auto scrollbar-hide"
                            style={{ fontVariantLigatures: 'none' }}
                            dangerouslySetInnerHTML={{ __html: renderHighlightedText(input) }}
                        />

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            onScroll={handleScroll}
                            placeholder="Message (use @ to mention players)..."
                            className="w-full relative bg-transparent border-none px-4 py-3 text-[15px] leading-6 font-sans tracking-normal text-left text-[#e9edef] focus:ring-0 outline-none resize-none max-h-[150px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent placeholder-[#8696a0] caret-white z-10"
                            rows={1}
                            style={{
                                WebkitTextFillColor: 'transparent',
                                fontVariantLigatures: 'none'
                            }}
                        />
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="bg-correct text-black h-[44px] w-[44px] rounded-full flex items-center justify-center disabled:opacity-30 transition-all shadow-md shrink-0"
                    >
                        <SendIcon size={20} className="ml-1" />
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default MessageInput;
