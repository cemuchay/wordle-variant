/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Message } from "../../../hooks/useChat";

export interface ChatMessageProps {
    msg: Message;
    isMe: boolean;
    replyMsg?: Message;
    onReply: (msg: Message) => void;
    onScrollToMessage?: (messageId: string) => void;
    onMarkAsRead: (id: string) => void;
    users: { username: string; avatar_url: string; id: string }[];
    allProfiles?: { id: string; username: string; avatar_url: string }[];
    onReact: (emoji: string | null) => void;
    currentUserId: string;
    onEdit: (newContent: string) => Promise<void>;
    onDelete: () => Promise<void>;
    dailyGuesses?: any[];
    onResend?: (id: string) => void;
}
