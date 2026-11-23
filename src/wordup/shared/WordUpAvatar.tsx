import React from "react";
import { ProtectedAvatar } from "../../components/chat/ProtectedAvatar";
import {
   USE_INITIAL_AVATARS_TEMPORARILY,
   getInitialAvatarVisuals,
} from "./botAvatarGenerator";

interface WordUpAvatarProps {
   userId?: string;
   src?: string;
   username?: string;
   className?: string;
   onClick?: (e: React.MouseEvent) => void;
}

function getInitialFontClass(className: string): string {
   if (/\b(w-full|w-16|w-14|w-12)\b/.test(className)) {
      return "text-2xl";
   }
   if (/\b(w-7|w-6)\b/.test(className)) {
      return "text-xs";
   }
   return "text-sm";
}

/**
 * WordUp-scoped avatar renderer.
 * Temporarily renders crisp first-letter initial avatars across WordUp views
 * when USE_INITIAL_AVATARS_TEMPORARILY is enabled, and delegates to ProtectedAvatar otherwise.
 */
export const WordUpAvatar: React.FC<WordUpAvatarProps> = ({
   userId,
   src,
   username = "",
   className = "w-8 h-8 rounded-full",
   onClick,
}) => {
   if (!USE_INITIAL_AVATARS_TEMPORARILY) {
      return (
         <ProtectedAvatar
            userId={userId}
            src={src}
            username={username}
            className={className}
            onClick={onClick}
         />
      );
   }

   const { initial, backgroundHex } = getInitialAvatarVisuals(username, userId || username);
   const fontClass = getInitialFontClass(className);

   return (
      <div
         className={`relative overflow-hidden select-none flex items-center justify-center font-black text-white uppercase tracking-tight ${onClick ? "cursor-pointer" : ""} ${fontClass} ${className}`}
         style={{
            backgroundColor: `#${backgroundHex}`,
            WebkitUserSelect: "none",
            userSelect: "none",
         }}
         onClick={onClick}
         onContextMenu={(e) => e.preventDefault()}
         aria-label={username || "Player"}
      >
         <span className="leading-none drop-shadow-xs">{initial}</span>
      </div>
   );
};
