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

const saveSelection = (element: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(element);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    return preSelectionRange.toString().length;
};

const restoreSelection = (element: HTMLElement, offset: number) => {
    let charIndex = 0;
    const range = document.createRange();
    range.setStart(element, 0);
    range.collapse(true);
    const nodeStack: Node[] = [element];
    let node: Node | undefined;
    let foundStart = false;
    let stop = false;

    while (!stop && (node = nodeStack.pop())) {
        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const nextCharIndex = charIndex + textNode.length;
            if (!foundStart && offset >= charIndex && offset <= nextCharIndex) {
                range.setStart(textNode, offset - charIndex);
                range.collapse(true);
                foundStart = true;
                stop = true;
            }
            charIndex = nextCharIndex;
        } else {
            let i = node.childNodes.length;
            while (i--) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }

    const sel = window.getSelection();
    if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
    }
};

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

    const textareaRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const nextCursorPositionRef = useRef<number | null>(null);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const rawText = e.currentTarget.textContent || "";
        setInput(rawText);
        onTyping(rawText.length > 0);

        const cursorPos = saveSelection(e.currentTarget);
        if (cursorPos !== null) {
            const textBeforeCursor = rawText.substring(0, cursorPos);
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
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            if (!e.shiftKey && window.innerWidth > 768) {
                e.preventDefault();
                handleSend();
            } else {
                e.preventDefault();
                document.execCommand('insertText', false, '\n');
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const handleUserSelect = (username: string) => {
        if (!mentionState) return;
        const lastAt = input.lastIndexOf("@", mentionState.cursorPosition - 1);
        const textBeforeAt = input.substring(0, lastAt);
        const textAfterCursor = input.substring(mentionState.cursorPosition);
        const newInput = textBeforeAt + "@" + username + " " + textAfterCursor;
        
        setInput(newInput);
        setMentionState(null);
        nextCursorPositionRef.current = (textBeforeAt + "@" + username + " ").length;
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
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
        if (textareaRef.current) {
            textareaRef.current.innerHTML = "";
        }
        onTyping(false);
        onCancelReply();
        setMentionState(null);
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
                return `<span style="background-color: ${color}20; color: ${color}; outline: 1px solid ${color}40; border-radius: 6px; padding: 1px 2px; font-weight: 800;">${cleanMatch}</span>${endsWithSpace ? ' ' : ''}`;
            });
        });

        return highlighted + (text.endsWith('\n') ? '<br/>' : '');
    };

    // Auto-grow and innerHTML synchronization logic
    useEffect(() => {
        const el = textareaRef.current;
        if (!el || isRecording) return;

        const targetHtml = renderHighlightedText(input);

        // Only update innerHTML if it's semantically different or if we have a forced cursor update
        if (el.innerHTML !== targetHtml || nextCursorPositionRef.current !== null) {
            let cursorOffset = nextCursorPositionRef.current;
            if (cursorOffset === null) {
                cursorOffset = document.activeElement === el ? saveSelection(el) : null;
            }

            el.innerHTML = targetHtml;
            
            if (cursorOffset !== null) {
                restoreSelection(el, cursorOffset);
            }
            nextCursorPositionRef.current = null;
        }
    }, [input, users, isRecording]);

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
            <style>{`
                [contenteditable]:empty::before {
                    content: attr(data-placeholder);
                    color: rgba(255, 255, 255, 0.4);
                    pointer-events: none;
                    display: block;
                }
            `}</style>
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
                            <div
                                ref={textareaRef}
                                contentEditable={true}
                                onInput={handleInput}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                data-placeholder="Message..."
                                className="w-full bg-transparent border-none px-5 py-[12px] text-[15px] leading-[22px] font-medium font-sans tracking-normal text-left text-white focus:ring-0 outline-none resize-none scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent caret-correct block whitespace-pre-wrap break-words"
                                style={{
                                    fontVariantLigatures: 'none',
                                    minHeight: '48px',
                                    maxHeight: '180px',
                                    overflowY: 'auto'
                                }}
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
