/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

interface ProtectedAvatarProps {
    src?: string;
    username?: string;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const ProtectedAvatar: React.FC<ProtectedAvatarProps> = ({
    src,
    username = '',
    className = 'w-8 h-8 rounded-full',
    onClick
}) => {
    // Generate fallback UI avatar if src is missing or empty
    const avatarUrl = src || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;

    return (
        <div
            className={`relative overflow-hidden select-none cursor-pointer ${className}`}
            onClick={onClick}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
        >
            {/* The actual image container rendered as a CSS background-image */}
            <div
                className="w-full h-full bg-cover bg-center pointer-events-none select-none"
                style={{
                    backgroundImage: `url("${avatarUrl}")`,
                    WebkitUserDrag: 'none',
                } as any}
            />
            {/* Overlay transparent div to intercept drag-and-drop / pointer clicks / right clicks */}
            <div
                className="absolute inset-0 bg-transparent pointer-events-auto select-none"
                draggable={false}
                style={{ WebkitUserDrag: 'none' } as any}
            />
        </div>
    );
};
