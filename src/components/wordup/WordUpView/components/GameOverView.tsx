import { motion } from "framer-motion";
import { Award } from "lucide-react";

interface GameOverViewProps {
   matchData: any;
   setView: (view: "menu") => void;
}

export const GameOverView = ({ matchData, setView }: GameOverViewProps) => {
   if (!matchData) return null;

   const isWinner = matchData.p1_score > matchData.p2_score;
   const isDraw = matchData.p1_score === matchData.p2_score;

   return (
      <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         className="flex flex-col flex-1 justify-center gap-6 py-4"
      >
         <div className="text-center space-y-1">
            <Award size={48} className="mx-auto text-correct animate-bounce" />
            <h2 className="text-2xl font-black uppercase tracking-wider text-white">
               {isWinner ? "Victory!" : isDraw ? "Draw!" : "Defeat"}
            </h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-black">Match Completed</p>
         </div>

         {/* Side-by-Side Scores */}
         <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div>
               <p className="text-[10px] text-gray-500 font-black uppercase">You</p>
               <p className="text-2xl font-black text-white">{matchData.p1_score} pts</p>
            </div>
            <div className="border-l border-white/10">
               <p className="text-[10px] text-gray-500 font-black uppercase">
                  {matchData.is_bot_match ? "Bot Opponent" : "Opponent"}
               </p>
               <p className="text-2xl font-black text-white">{matchData.p2_score} pts</p>
            </div>
         </div>

         {/* Rewards and Elo changes */}
         <div className="bg-correct/10 border border-correct/20 rounded-2xl p-4 text-center space-y-1 shadow-[0_0_15px_rgba(46,204,113,0.1)]">
            <p className="text-xs font-bold text-correct uppercase tracking-wider">
               Rating Change: {isWinner ? "+18 Elo Rating" : isDraw ? "+2 Elo" : "-12 Elo Rating"}
            </p>
            <p className="text-[10px] text-gray-400 uppercase font-black">
               Earned: +{50 + (isWinner ? 100 : 0) + (matchData.p1_answers.filter((a: any) => a.correct).length * 10)} XP
            </p>
         </div>

         {/* Rematch action */}
         <button
            onClick={() => setView("menu")}
            className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all"
         >
            Play Again
         </button>
      </motion.div>
   );
};
