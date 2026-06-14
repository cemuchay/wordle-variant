import { forwardRef } from 'react';
import { Copy } from "lucide-react";
import { EMOJIS } from './constants';

interface ReactionPickerProps {
    onReact: (emoji: string | null) => void;
    currentReaction?: string;
    onCopy: () => void;
    isMe: boolean;
}

export const ReactionPicker = forwardRef<HTMLDivElement, ReactionPickerProps>(({ onReact, currentReaction, onCopy, isMe }, ref) => (
    <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute ${isMe ? 'right-4' : 'left-4'} top-[-44px] flex items-center gap-1 bg-[#1f2c34] border border-white/15 rounded-2xl px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-100 animate-in fade-in zoom-in-95 duration-100`}
    >
        <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            {EMOJIS.map((emoji) => (
                <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onReact(currentReaction === emoji ? null : emoji);
                    }}
                    className={`text-[18px] w-9 h-9 flex items-center justify-center hover:scale-125 transition-transform duration-100 cursor-pointer rounded-full ${currentReaction === emoji ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                    {emoji}
                </button>
            ))}
        </div>
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onCopy();
            }}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer group/copy"
            title="Copy Message"
        >
            <Copy size={14} className="group-hover/copy:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-wider">Copy</span>
        </button>
    </div>
));

ReactionPicker.displayName = 'ReactionPicker';
