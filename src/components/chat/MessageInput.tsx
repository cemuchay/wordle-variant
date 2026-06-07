/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useMemo } from "react";
import { SendIcon, X, Mic, Trash2, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "../../hooks/useChat";
import UserSuggestions from "./UserSuggestions";
import { useApp } from "../../context/AppContext";

interface MessageInputProps {
    onSend: (content: string, replyToId?: string, mentions?: string[]) => void;
    onSendVoice: (audioBlob: Blob) => void;
    onSendImage?: (file: File) => void;
    onTyping: (isTyping: boolean) => void;
    replyingTo: Message | null;
    onCancelReply: () => void;
    users: { username: string; avatar_url: string; id: string }[];
    isGameAnalysis?: boolean;
    dailyGuesses?: any[];
}

const MENTION_COLORS = ["#4ade80", "#60a5fa", "#f87171", "#fbbf24", "#c084fc", "#22d3ee", "#f472b6", "#fb923c"];

const MessageInput = ({ onSend, onSendVoice, onSendImage, onTyping, replyingTo, onCancelReply, users, isGameAnalysis, dailyGuesses }: MessageInputProps) => {
    const { profile } = useApp();
    const [input, setInput] = useState("");
    const [mentionState, setMentionState] = useState<{ isVisible: boolean; filter: string; cursorPosition: number } | null>(null);

    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    // Voice note recording helpers
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
                if (audioChunksRef.current.length > 0) {
                    onSendVoice(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const cancelRecording = () => {
        if (!mediaRecorderRef.current) return;
        // override onstop callback to prevent sending the chunk
        mediaRecorderRef.current.onstop = () => {
            audioChunksRef.current = [];
            const stream = mediaRecorderRef.current?.stream;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const formatDuration = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '44px';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [input]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    const renderHighlightedText = (text: string) => {
        if (!text) return "";
        let highlighted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const sortedUsers = [...users].sort((a, b) => b.username.length - a.username.length);

        sortedUsers.forEach((user) => {
            const userIndex = users.findIndex(u => u.username === user.username);
            const color = MENTION_COLORS[userIndex % MENTION_COLORS.length];
            const escapedName = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escapedName}(\\s|$)`, 'g');

            highlighted = highlighted.replace(regex, (match) => {
                const endsWithSpace = match.endsWith(' ');
                const cleanMatch = endsWithSpace ? match.slice(0, -1) : match;
                return `<span style="background-color: ${color}20; color: ${color}; outline: 1px solid ${color}40; border-radius: 4px; padding: 0px 0px;">${cleanMatch}</span>${endsWithSpace ? ' ' : ''}`;
            });
        });

        return highlighted + (text.endsWith('\n') ? '\n ' : '');
    };

    const hasDailyScore = useMemo(() => {
        if (!dailyGuesses || !profile?.id) return false;
        return dailyGuesses.some(dg => dg.user_id === profile.id);
    }, [dailyGuesses, profile]);

    return (
        <div className="px-3 pb-4 pt-2 bg-[#0b141a] relative">
            {/* Quick Actions for Game Analysis */}
            {isGameAnalysis && hasDailyScore && profile?.id && (
                <div className="mx-2 mb-2.5 flex justify-start">
                    <button
                        type="button"
                        onClick={() => onSend(`[guess:${profile.id}]`)}
                        className="px-3 py-1.5 bg-correct/10 hover:bg-correct/20 border border-correct/30 rounded-full text-[10px] font-black uppercase text-correct tracking-wider cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                        📊 Share My Guess Board
                    </button>
                </div>
            )}

            <AnimatePresence>
                {replyingTo && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mx-2 mb-2 bg-[#1d282f] p-3 rounded-t-2xl border-l-4 border-correct flex justify-between items-start shadow-lg"
                    >
                        <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-correct mb-0.5 font-sans">Replying to {replyingTo.profiles?.username}</p>
                            <p className="text-[12px] text-white/60 truncate italic font-sans">{replyingTo.content}</p>
                        </div>
                        <button type="button" onClick={onCancelReply} className="text-white/60 hover:text-white p-1 cursor-pointer">
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
                    {/* Image Attachment Trigger */}
                    {!isRecording && onSendImage && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-[#2a3942] hover:bg-white/10 text-white/60 hover:text-white h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer border border-white/5"
                            title="Share Image"
                        >
                            <ImageIcon size={20} />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        onSendImage(file);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }
                                }}
                            />
                        </button>
                    )}
                    {isRecording ? (
                        <div className="flex-1 flex items-center justify-between bg-[#2a3942] rounded-[24px] px-4 py-[10px] min-h-[44px] text-white">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                                <span className="text-xs font-black uppercase tracking-wider text-red-400">Recording</span>
                                <span className="text-sm font-mono">{formatDuration(recordingTime)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={cancelRecording}
                                className="text-white/60 hover:text-red-400 p-1 transition-colors cursor-pointer"
                                title="Discard voice note"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 relative bg-[#2a3942] rounded-[24px] shadow-sm min-h-[44px] overflow-hidden">
                            <div
                                ref={backdropRef}
                                aria-hidden="true"
                                className="absolute inset-0 px-4 py-[10px] text-[15px] leading-6 font-sans tracking-normal text-left whitespace-pre-wrap wrap-break-word pointer-events-none text-white border-none overflow-y-auto scrollbar-hide"
                                style={{ fontVariantLigatures: 'none' }}
                                dangerouslySetInnerHTML={{ __html: renderHighlightedText(input) }}
                            />

                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleInputChange}
                                onScroll={handleScroll}
                                placeholder="Message (use @ to mention players)..."
                                className="w-full relative bg-transparent border-none px-4 py-[10px] text-[15px] leading-6 font-sans tracking-normal text-left text-white focus:ring-0 outline-none resize-none max-h-[150px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent placeholder-white/50 caret-white z-10"
                                rows={1}
                                style={{
                                    WebkitTextFillColor: 'transparent',
                                    fontVariantLigatures: 'none'
                                }}
                            />
                        </div>
                    )}

                    {input.trim() === "" ? (
                        isRecording ? (
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="bg-red-500 text-white h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer animate-pulse"
                                title="Stop and send"
                            >
                                <SendIcon size={20} className="ml-0.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={startRecording}
                                className="bg-correct text-black h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer hover:scale-105"
                                title="Record voice message"
                            >
                                <Mic size={20} />
                            </button>
                        )
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={handleSend}
                            className="bg-correct text-black h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer"
                        >
                            <SendIcon size={20} className="ml-1" />
                        </motion.button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageInput;
