/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useMemo } from "react";
import { SendIcon, X, Mic, Trash2, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "../../hooks/useChat";
import UserSuggestions from "./UserSuggestions";
import { useApp } from "../../context/AppContext";
import { useAppStore } from "../../store/useAppStore";

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

    const adjustHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInput(value);
        onTyping(value.length > 0);
        adjustHeight();

        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtPos = textBeforeCursor.lastIndexOf("@");

        if (lastAtPos !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);
            if (!textAfterAt.includes("\n") && !textAfterAt.includes(" ")) {
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleUserSelect = (username: string) => {
        if (!mentionState || !textareaRef.current) return;
        const lastAt = input.lastIndexOf("@", mentionState.cursorPosition - 1);
        const textBeforeAt = input.substring(0, lastAt);
        const textAfterCursor = input.substring(mentionState.cursorPosition);
        const newInput = textBeforeAt + "@" + username + " " + textAfterCursor;

        setInput(newInput);
        setMentionState(null);

        const newCursorPos = (textBeforeAt + "@" + username + " ").length;

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                adjustHeight();
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

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    // Voice note recording helpers
    const startRecording = async () => {
        try {
            // 1. Explicitly check for supported MIME types (iOS fallback)
            const mimeType = [
                'audio/webm;codecs=opus',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/wav'
            ].find(type => MediaRecorder.isTypeSupported(type)) || '';

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                // 2. Validate blob size (prevent silent/empty notes)
                // If it's less than 1000 bytes, it's likely empty or failed
                if (audioBlob.size < 500) {
                    console.warn("Captured audio is too small, likely failed:", audioBlob.size);
                    useAppStore.getState().triggerToast("Audio capture failed. Please check permissions.", 4000);
                } else {
                    onSendVoice(audioBlob);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            // 3. Use a smaller timeslice for dataavailable to ensure data is captured on mobile
            mediaRecorder.start(200);
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            useAppStore.getState().triggerToast("Could not access microphone. Ensure you have granted permission.", 4000);
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

    // Focus input when replyingTo changes
    useEffect(() => {
        if (replyingTo && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [replyingTo]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    const hasDailyScore = useMemo(() => {
        if (!dailyGuesses || !profile?.id) return false;
        return dailyGuesses.some(dg => dg.user_id === profile.id);
    }, [dailyGuesses, profile]);

    return (
        <div className="px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0))] pt-2 bg-[#0b141a] border-t border-white/5 relative">
            {/* Quick Actions for Game Analysis */}
            {isGameAnalysis && hasDailyScore && profile?.id && (
                <div className="mx-2 mb-2.5 flex justify-start">
                    <button
                        type="button"
                        onClick={() => onSend(`[guess:${profile.id}]`)}
                        className="px-4 py-2 bg-correct/10 hover:bg-correct/20 border border-correct/20 rounded-2xl text-[10px] font-black uppercase text-correct tracking-widest cursor-pointer flex items-center gap-2 transition-all shadow-lg active:scale-95"
                    >
                        <span className="text-sm">📊</span> Share Guess Board
                    </button>
                </div>
            )}

            <AnimatePresence>
                {replyingTo && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        className="mx-2 mb-3 bg-[#1d282f] p-4 rounded-t-[24px] border-l-[6px] border-correct flex justify-between items-start shadow-2xl backdrop-blur-md"
                    >
                        <div className="overflow-hidden pr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-correct" />
                                <p className="text-[11px] font-black text-correct uppercase tracking-widest">Replying to {replyingTo.profiles?.username}</p>
                            </div>
                            <p className="text-[13px] text-white/70 line-clamp-2 font-medium leading-relaxed">{replyingTo.content}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onCancelReply}
                            className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white p-1.5 rounded-full cursor-pointer transition-colors"
                        >
                            <X size={14} />
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

                <div className="flex items-end gap-2.5 px-1.5">
                    {/* Image Attachment Trigger */}
                    {!isRecording && onSendImage && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-[#2a3942] hover:bg-[#37474f] text-white/70 hover:text-white h-[48px] w-[48px] rounded-full flex items-center justify-center transition-all shadow-xl shrink-0 cursor-pointer border border-white/10 active:scale-90"
                            title="Share Image"
                        >
                            <ImageIcon size={22} strokeWidth={2.5} />
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
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex-1 flex items-center justify-between bg-[#2a3942] rounded-[28px] px-5 py-2.5 min-h-[48px] text-white border border-red-500/20 shadow-2xl shadow-red-500/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                                    <div className="absolute inset-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Live Recording</span>
                                <span className="text-sm font-black tabular-nums text-white/90">{formatDuration(recordingTime)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={cancelRecording}
                                className="bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 p-2 rounded-full transition-all cursor-pointer active:scale-90"
                                title="Discard voice note"
                            >
                                <Trash2 size={18} />
                            </button>
                        </motion.div>
                    ) : (
                        <div className="flex-1 relative bg-[#2a3942] rounded-[28px] shadow-2xl min-h-[48px] overflow-hidden border border-white/10 focus-within:border-correct/40 transition-colors group flex flex-col justify-center">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="Message..."
                                className="w-full bg-transparent border-none px-5 py-[12px] text-[15px] leading-[22px] font-medium font-sans tracking-normal text-left text-white focus:ring-0 outline-none resize-none scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent caret-correct block whitespace-pre-wrap break-words min-h-[48px] max-h-[180px]"
                                rows={1}
                            />
                        </div>
                    )}

                    {input.trim() === "" ? (
                        isRecording ? (
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="bg-red-500 text-white h-[48px] w-[48px] rounded-full flex items-center justify-center transition-all shadow-xl shadow-red-500/20 shrink-0 cursor-pointer active:scale-90 relative"
                                title="Stop and send"
                            >
                                <SendIcon size={22} className="ml-1" />
                                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={startRecording}
                                className="bg-correct text-black h-[48px] w-[48px] rounded-full flex items-center justify-center transition-all shadow-xl shadow-correct/20 shrink-0 cursor-pointer hover:scale-105 active:scale-90 border border-black/5"
                                title="Record voice message"
                            >
                                <Mic size={22} strokeWidth={2.5} />
                            </button>
                        )
                    ) : (
                        <motion.button
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.9 }}
                            type="button"
                            onClick={handleSend}
                            className="bg-correct text-black h-[48px] w-[48px] rounded-full flex items-center justify-center transition-all shadow-xl shadow-correct/20 shrink-0 cursor-pointer border border-black/5"
                        >
                            <SendIcon size={22} className="ml-1" strokeWidth={2.5} />
                        </motion.button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageInput;
