import { motion } from "framer-motion";
import { Loader2, Zap } from "lucide-react";

export const ConnectingView = () => {
   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="flex flex-col flex-1 items-center justify-center min-h-[400px] p-6 text-center space-y-6"
      >
         <div className="relative flex items-center justify-center">
            {/* Glowing background */}
            <div className="absolute w-24 h-24 rounded-full bg-correct/10 border border-correct/20 animate-ping opacity-25" />
            <div className="absolute w-16 h-16 rounded-full bg-correct/25 blur-xl animate-pulse" />
            
            {/* Loader card */}
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
               <Zap size={12} className="animate-pulse" />
               Entering Arena
            </motion.h3>
            <motion.p 
               initial={{ y: 10, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="text-sm font-bold text-white tracking-wide uppercase"
            >
               Connecting to Server...
            </motion.p>
            <motion.p 
               initial={{ y: 10, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.3 }}
               className="text-[10px] text-gray-500 font-bold uppercase tracking-wider"
            >
               Setting up match database
            </motion.p>
         </div>
      </motion.div>
   );
};

export default ConnectingView;
