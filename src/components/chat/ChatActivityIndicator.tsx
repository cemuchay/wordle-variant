import TypingBubble from "./TypingBubble";

export interface ChatActivityIndicatorProps {
   typingNames?: string[];
   recordingNames?: string[];
}

/**
 * Dedicated Chat Activity Indicator component.
 * Displays active typing and/or voice note recording indicators for chat participants.
 */
export default function ChatActivityIndicator({
   typingNames = [],
   recordingNames = [],
}: ChatActivityIndicatorProps) {
   const hasRecording = recordingNames.length > 0;
   const hasTyping = typingNames.length > 0;

   if (!hasRecording && !hasTyping) {
      return null;
   }

   const recordingLabel = recordingNames.length === 1
      ? recordingNames[0]
      : recordingNames.join(", ");

   const typingLabel = typingNames.length === 1
      ? typingNames[0]
      : typingNames.join(", ");

   return (
      <div className="flex flex-col gap-1">
         {hasRecording && (
            <TypingBubble
               name={recordingLabel}
               type="recording"
            />
         )}
         {hasTyping && (
            <TypingBubble
               name={typingLabel}
               type="typing"
            />
         )}
      </div>
   );
}
