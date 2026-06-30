/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from 'react';

interface ProtectedAvatarProps {
    userId?: string;
    src?: string;
    username?: string;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

const avatarUrlCache = new Map<string, string>();

export const ProtectedAvatar: React.FC<ProtectedAvatarProps> = ({
    userId,
    src,
    username = '',
    className = 'w-8 h-8 rounded-full',
    onClick
}) => {
    const cacheKey = userId || src || username;

    const avatarUrl = useMemo(() => {
        if (cacheKey && avatarUrlCache.has(cacheKey)) {
            return avatarUrlCache.get(cacheKey)!;
        }

        let url = src || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;

        if (userId) {
           const isExternal = src && (
              src.startsWith("http://") || 
              src.startsWith("https://")
           ) && !src.includes("supabase.co") && !src.includes("dicebear.com") && !src.includes("ui-avatars.com");
           
           if (isExternal || !src) {
              url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/avatar-proxy?uid=${userId}`;
           }
        }

        if (cacheKey) avatarUrlCache.set(cacheKey, url);
        return url;
    }, [userId, src, username, cacheKey]);

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
