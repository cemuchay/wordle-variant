import { motion } from "framer-motion";
import { Swords, Zap, GraduationCap } from "lucide-react";

interface ModeSelectProps {
   onSelect: (mode: "live" | "async") => void;
   onTutorial?: () => void;
}

export const ModeSelect = ({ onSelect, onTutorial }: ModeSelectProps) => {
   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col items-center justify-center flex-1 gap-8 px-6 py-12 relative"
      >
         {onTutorial && (
            <button
               onClick={onTutorial}
               className="absolute top-4 right-4 p-2 rounded-xl bg-black/20 hover:bg-black/40 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
               title="Play Tutorial"
            >
               <GraduationCap size={16} />
            </button>
         )}

         <div className="text-center space-y-2">
            {/* Flex container to place icon and heading side-by-side */}
            <div className="flex items-center justify-center gap-4">
               <div className="inline-flex p-1 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)]">
                  <Swords size={36} />
               </div>
               <h1 className="text-3xl font-black uppercase tracking-wider text-white">
                  WordUp <span className="text-[10px]">beta</span>
               </h1>
            </div>

            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
               Choose your battle mode
            </p>
         </div>

         <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
            <motion.button
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               onClick={() => onSelect("live")}
               className="group relative overflow-hidden bg-linear-to-br from-correct/20 to-correct/5 border-2 border-correct/30 rounded-3xl p-2 py-3 text-left transition-all hover:border-correct/60 hover:shadow-[0_0_30px_rgba(46,204,113,0.15)] cursor-pointer"
            >
               <div className="flex items-start gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-correct/20 border border-correct/30 flex items-center justify-center shrink-0 shadow-lg group-hover:shadow-correct/20">
                     <Zap size={28} className="text-correct" fill="currentColor" />
                  </div>
                  <div className="space-y-1.5">
                     <h2 className="text-lg font-black uppercase tracking-wider text-white">Live Game</h2>
                     <p className="text-xs text-gray-300 leading-relaxed">
                        Real-time battles against opponents or bots. <br />
                        <span className="text-correct font-bold">7 rounds • timed • ranked</span>
                     </p>
                     <div className="flex gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase bg-correct/10 text-correct border border-correct/20 px-2 py-0.5 rounded-lg">vs Players</span>
                        <span className="text-[9px] font-black uppercase bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-lg">vs Bots</span>
                     </div>
                  </div>
               </div>
            </motion.button>

            <motion.button
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               onClick={() => onSelect("async")}
               className="group relative overflow-hidden bg-linear-to-br from-indigo-500/20 to-indigo-500/5 border-2 border-indigo-500/30 rounded-3xl p-2 py-3 text-left transition-all hover:border-indigo-500/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] cursor-pointer"
            >
               <div className="flex items-start gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-lg group-hover:shadow-indigo-500/20">
                     <Swords size={28} className="text-indigo-400" />
                  </div>
                  <div className="space-y-1.5">
                     <h2 className="text-lg font-black uppercase tracking-wider text-white">1 v 1 Challenge</h2>
                     <p className="text-xs text-gray-300 leading-relaxed">
                        Play at your own pace, challenge friends. <br />
                        <span className="text-indigo-400 font-bold">7 rounds • no timer • ranked</span>
                     </p>
                     <div className="flex gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-lg">Challenge Friends</span>
                        <span className="text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-lg">Play Anytime</span>
                     </div>
                  </div>
               </div>
            </motion.button>
         </div>

      </motion.div>
   );
};

export default ModeSelect;
