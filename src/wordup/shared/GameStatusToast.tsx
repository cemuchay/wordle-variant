/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type StatusType = 'info' | 'warning' | 'error';

interface StatusMessage {
   id: number;
   text: string;
   type: StatusType;
}

const STYLES: Record<StatusType, { dot: string; border: string; bg: string; text: string }> = {
   info: { dot: 'bg-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-300' },
   warning: { dot: 'bg-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-300' },
   error: { dot: 'bg-red-500', border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-300' },
};

let statusIdCounter = 0;

export function dispatchGameStatus(text: string, type: StatusType = 'info') {
   window.dispatchEvent(new CustomEvent('wordup-game-status', {
      detail: { id: ++statusIdCounter, text, type },
   }));
}

export const GameStatusToast = () => {
   const [messages, setMessages] = useState<StatusMessage[]>([]);
   const timersRef = useRef<Map<number, number>>(new Map());

   const removeMessage = useCallback((id: number) => {
      setMessages(prev => prev.filter(m => m.id !== id));
      const t = timersRef.current.get(id);
      if (t !== undefined) clearTimeout(t);
      timersRef.current.delete(id);
   }, []);

   useEffect(() => {
      const handler = (e: Event) => {
         const detail = (e as CustomEvent).detail as StatusMessage;
         if (!detail?.text) return;

         setMessages(prev => [...prev.slice(-4), { id: detail.id, text: detail.text, type: detail.type }]);

         const timer = window.setTimeout(() => removeMessage(detail.id), 3500);
         timersRef.current.set(detail.id, timer);
      };

      window.addEventListener('wordup-game-status', handler);
      return () => {
         window.removeEventListener('wordup-game-status', handler);
         timersRef.current.forEach(t => clearTimeout(t));
         timersRef.current.clear();
      };
   }, [removeMessage]);

   return (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none w-full max-w-xs">
         <AnimatePresence mode="popLayout">
            {messages.map(msg => {
               const s = STYLES[msg.type];
               return (
                  <motion.div
                     key={msg.id}
                     layout
                     initial={{ opacity: 0, y: -10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: -10, scale: 0.95 }}
                     transition={{ duration: 0.25, ease: 'easeOut' }}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${s.border} ${s.bg} shadow-lg backdrop-blur-sm`}
                  >
                     <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                     <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{msg.text}</span>
                  </motion.div>
               );
            })}
         </AnimatePresence>
      </div>
   );
};
