import FloatingChatBubble from "./chat/FloatingChatBubble";

/**
 * @deprecated ChatRoom has been sunset and replaced by FloatingChatBubble in full mode.
 */
export default function ChatRoom({ onClose }: { user?: any; onClose?: () => void }) {
   return <FloatingChatBubble mode="full" onCloseFull={onClose} />;
}

