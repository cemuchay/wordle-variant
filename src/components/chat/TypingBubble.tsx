import { Mic } from "lucide-react";

export interface TypingBubbleProps {
   /** Optional "X is typing" prefix or names */
   name?: string | null;
   /** Mode of activity */
   type?: "typing" | "recording";
}

/**
 * Messenger-style typing & voice recording activity indicator.
 * Pure CSS/Tailwind animation, mounts only while someone is active.
 */
export default function TypingBubble({ name, type = "typing" }: TypingBubbleProps) {
   const isRecording = type === "recording";
   const displayName = name?.trim() || "Someone";
   const isPlural = displayName.includes(",");

   return (
      <div
         data-testid="chat-activity-indicator"
         className="flex items-center gap-2.5 my-2 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none"
      >
         <div
            className={`backdrop-blur-md px-3.5 py-2 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-sm border ${
               isRecording
                  ? "bg-rose-500/15 border-rose-500/25 text-rose-400"
                  : "bg-white/10 border-white/10 text-indigo-400"
            }`}
         >
            {isRecording ? (
               <div className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  <div className="flex items-center gap-0.5 h-3">
                     <span className="w-0.5 h-2 bg-rose-400 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                     <span className="w-0.5 h-3.5 bg-rose-400 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                     <span className="w-0.5 h-1.5 bg-rose-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
               </div>
            ) : (
               <div className="flex items-center gap-1">
                  <span
                     className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                     style={{ animationDelay: "0ms" }}
                  />
                  <span
                     className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                     style={{ animationDelay: "150ms" }}
                  />
                  <span
                     className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                     style={{ animationDelay: "300ms" }}
                  />
               </div>
            )}
         </div>

         <span className="text-[10px] font-semibold text-gray-400 tracking-wide">
            <span className="text-gray-200 font-bold">{displayName}</span>{" "}
            {isRecording
               ? `${isPlural ? "are" : "is"} recording audio…`
               : `${isPlural ? "are" : "is"} typing…`}
         </span>
      </div>
   );
}
