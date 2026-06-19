import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const MAX_LOGS = 200;

type LogEntry = { text: string; type: "log" | "warn" | "error" };

let logs: LogEntry[] = [];
let listeners: Set<() => void> = new Set();

const addLog = (text: string, type: LogEntry["type"]) => {
   logs = [...logs.slice(-MAX_LOGS + 1), { text, type }];
   listeners.forEach((l) => l());
};

const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

console.log = (...args: any[]) => {
   originalLog(...args);
   addLog(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "), "log");
};
console.warn = (...args: any[]) => {
   originalWarn(...args);
   addLog(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "), "warn");
};
console.error = (...args: any[]) => {
   originalError(...args);
   addLog(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "), "error");
};

let toggleFn: (() => void) | null = null;

export const openDebugConsole = () => toggleFn?.();

export const DebugConsole = () => {
   const [visible, setVisible] = useState(false);
   const [entries, setEntries] = useState<LogEntry[]>([]);
   const bottomRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      toggleFn = () => setVisible((v) => !v);
      return () => { toggleFn = null; };
   }, []);

   useEffect(() => {
      const update = () => setEntries([...logs]);
      listeners.add(update);
      return () => { listeners.delete(update); };
   }, []);

   useEffect(() => {
      if (visible) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
   }, [entries, visible]);

   return (
      <>
         {visible && (
            <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={() => setVisible(false)}>
               <div
                  className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-0.5"
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="flex items-center justify-between sticky top-0 bg-black/95 pb-2 mb-2 border-b border-white/10 z-10">
                     <span className="text-white font-bold text-xs">Debug Console</span>
                     <button onClick={() => setVisible(false)} className="text-gray-400 hover:text-white p-1 cursor-pointer">
                        <X size={14} />
                     </button>
                  </div>
                  {entries.map((e, i) => (
                     <div
                        key={i}
                        className={`${
                           e.type === "error" ? "text-red-400" : e.type === "warn" ? "text-amber-400" : "text-gray-300"
                        } break-all leading-snug`}
                     >
                        {e.text}
                     </div>
                  ))}
                  <div ref={bottomRef} />
               </div>
            </div>
         )}
      </>
   );
};
