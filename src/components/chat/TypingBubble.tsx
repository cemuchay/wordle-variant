interface TypingBubbleProps {
   /** Optional "X is typing" prefix for group conversations */
   name?: string | null;
}

/**
 * Messenger-style typing indicator. Pure CSS animation, mounts only while
 * someone is actually typing — zero cost otherwise.
 */
export default function TypingBubble({ name }: TypingBubbleProps) {
   return (
      <div className="flex items-center gap-2.5 my-2 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
         <div className="bg-white/10 border border-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-sm">
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
         {name && (
            <span className="text-[10px] font-semibold text-gray-400 tracking-wide">
               <span className="text-gray-200 font-bold">{name}</span> {name.includes(",") ? "are" : "is"} typing…
            </span>
         )}
      </div>
   );
}
