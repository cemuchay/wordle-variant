import { motion } from "framer-motion";
import { Loader2, Swords, XCircle } from "lucide-react";

interface LoadingViewProps {
   message?: string;
   onCancel?: () => void;
}

export const LoadingView = ({ message = "Preparing Arena...", onCancel }: LoadingViewProps) => {
   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="flex flex-col flex-1 items-center justify-center min-h-[400px] p-6 text-center space-y-6"
      >
         <div className="relative flex items-center justify-center">
            {/* Pulsing glow background */}
            <div className="absolute w-24 h-24 rounded-full bg-correct/10 border border-correct/20 animate-ping opacity-25" />
            <div className="absolute w-16 h-16 rounded-full bg-correct/25 blur-xl" />

            {/* Spinning Loader */}
            <div className="relative p-6 bg-slate-900/80 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
               <Loader2 size={36} className="text-correct animate-spin" />
            </div>
         </div>

         <div className="space-y-2 max-w-xs">
            <motion.h3
               initial={{ y: 10, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.1 }}
               className="text-xs font-black uppercase tracking-widest text-correct flex items-center justify-center gap-1.5"
            >
               <Swords size={12} className="animate-pulse" />
               WordUp Battles (beta)
            </motion.h3>
            <motion.p
               initial={{ y: 10, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="text-sm font-bold text-white tracking-wide uppercase animate-pulse"
            >
               {message}
            </motion.p>
            <motion.p
               initial={{ y: 10, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.3 }}
               className="text-[10px] text-gray-500 font-bold uppercase tracking-wider"
            >
               Please wait a moment
            </motion.p>
         </div>

         {onCancel && (
            <motion.button
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.5 }}
               onClick={onCancel}
               className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold uppercase tracking-wider transition-all duration-200"
            >
               <XCircle size={14} />
               Cancel
            </motion.button>
         )}
      </motion.div>
   );
};

export default LoadingView;
