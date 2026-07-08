import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import { CATEGORIES } from "./constants";
// import { WordUpMascot } from "./WordUpMascot";

interface MatchmakingViewProps {
   category: string;
   cancelMatchmaking: () => void;
   countdownSecs: number;
}

export const MatchmakingView = ({ category, cancelMatchmaking, countdownSecs }: MatchmakingViewProps) => {
   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="flex flex-col flex-1 justify-center items-center gap-8 py-12"
      >
         <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border border-correct/20 border-t-correct animate-spin" />
            <Swords size={28} className="absolute text-correct animate-pulse" />
         </div>

         {/* <WordUpMascot expression="thinking" size={72} className="mb-2" /> */}

         <div className="text-center space-y-2">
            <h3 className="text-lg font-black uppercase tracking-wider">Finding Match</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
               Searching for an opponent...
            </p>
            <p className="text-xs text-gray-500 uppercase font-black tracking-wide">
               Category: {CATEGORIES.find(c => c.id === category)?.name}
            </p>
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-4">
               Opponent joins in {countdownSecs} seconds...
            </p>
         </div>

         <button
            onClick={cancelMatchmaking}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
         >
            Cancel
         </button>
      </motion.div>
   );
};
