import { motion } from 'framer-motion';
import { Copy, Edit2, Trash2, Reply, Info } from "lucide-react";
import { EMOJIS } from './constants';

interface ReactionModalProps {
    isMe: boolean;
    currentReaction?: string;
    onReact: (emoji: string | null) => void;
    onCopy: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onReply?: () => void;
    onInfo?: () => void;
    onClose: () => void;
}

export function ReactionModal({ currentReaction, onReact, onCopy, onEdit, onDelete, onReply, onInfo, onClose }: ReactionModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-8"
        >
            <div className="absolute inset-0 bg-black/60" />
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-[#1f2c34] border border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3 max-w-[260px] w-full"
            >
                <div className="flex items-center justify-center gap-1.5">
                    {EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReact(currentReaction === emoji ? null : emoji);
                            }}
                            className={`text-[22px] w-11 h-11 flex items-center justify-center hover:scale-125 transition-transform duration-100 cursor-pointer rounded-full ${currentReaction === emoji ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                    {onReply && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReply();
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 hover:bg-correct/20 text-correct rounded-xl transition-all cursor-pointer"
                        >
                            <Reply size={16} />
                            <span className="text-xs font-black uppercase tracking-wider">Reply</span>
                        </button>
                    )}
                    {onEdit && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all cursor-pointer"
                        >
                            <Edit2 size={16} />
                            <span className="text-xs font-black uppercase tracking-wider">Edit</span>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all cursor-pointer"
                        >
                            <Trash2 size={16} />
                            <span className="text-xs font-black uppercase tracking-wider">Delete</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy();
                        }}
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
                    >
                        <Copy size={16} />
                        <span className="text-xs font-black uppercase tracking-wider">Copy</span>
                    </button>
                    {onInfo && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onInfo();
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
                        >
                            <Info size={16} />
                            <span className="text-xs font-black uppercase tracking-wider">Info</span>
                        </button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
