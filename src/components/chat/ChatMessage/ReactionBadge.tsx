import { forwardRef } from 'react';

interface ReactionBadgeProps {
    reactions: Record<string, string>;
    onShowDetails: () => void;
    isMe: boolean;
}

export const ReactionBadge = forwardRef<HTMLDivElement, ReactionBadgeProps>(({ reactions, onShowDetails, isMe }, ref) => {
    const emojis = Array.from(new Set(Object.values(reactions))).slice(0, 3);
    const count = Object.keys(reactions).length;

    return (
        <div
            ref={ref}
            onClick={(e) => {
                e.stopPropagation();
                onShowDetails();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute bottom-[-10px] ${isMe ? 'left-3' : 'right-3'} flex items-center gap-0.5 bg-[#1f2c34] border border-white/10 rounded-full px-1.5 py-0.5 shadow-md z-30 cursor-pointer hover:bg-[#2a3942] transition-colors`}
        >
            {emojis.map((emoji, idx) => (
                <span key={idx} className="text-[10px]">{emoji}</span>
            ))}
            <span className="text-[9px] text-white font-black ml-0.5">{count}</span>
        </div>
    );
});

ReactionBadge.displayName = 'ReactionBadge';
