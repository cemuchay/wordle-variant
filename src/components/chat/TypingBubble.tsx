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
      <div className="flex items-center gap-2 my-2">
         <div className="bg-white/5 border border-white/10 px-3 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1">
            {[0, 1, 2].map((i) => (
               <span
                  key={i}
                  className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
               />
            ))}
         </div>
         {name && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
               {name} {name.includes(",") ? "are" : "is"} typing…
            </span>
         )}
      </div>
   );
}
