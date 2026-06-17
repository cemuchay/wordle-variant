import { motion } from "framer-motion";
import { Swords, Play, Volume2, VolumeX } from "lucide-react";
import { CATEGORIES } from "../constants";
import { type ProfileStats } from "../types";

interface LobbyViewProps {
   userStats: ProfileStats | null;
   category: string;
   setCategory: (cat: string) => void;
   startMatchmaking: () => void;
   getRankColor: (rankName: string) => string;
   soundEnabled: boolean;
   onToggleSound: () => void;
}

export const LobbyView = ({
   userStats,
   category,
   setCategory,
   startMatchmaking,
   getRankColor,
   soundEnabled,
   onToggleSound
}: LobbyViewProps) => {
   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-6 flex-1 justify-center py-6"
      >
         <div className="text-center space-y-2 relative">
            <button
               onClick={onToggleSound}
               className="absolute right-0 top-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
               title="Toggle Sound"
            >
               {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <div className="inline-flex p-4 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)] animate-pulse">
               <Swords size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles</h2>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
               Test your word speed & pattern skills in a head-to-head 7-question rapid match!
            </p>
         </div>

         {userStats && (
            <div className="grid grid-cols-3 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
               <div>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rating</p>
                  <p className="text-lg font-black text-white">{userStats.rating} ELO</p>
               </div>
               <div>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rank</p>
                  <p className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border inline-block mt-1 ${getRankColor(userStats.rank_name)}`}>
                     {userStats.rank_name}
                  </p>
               </div>
               <div>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Wins/Losses</p>
                  <p className="text-lg font-black text-correct">
                     {userStats.games_won}<span className="text-gray-500 text-xs">/</span><span className="text-red-400">{userStats.games_lost}</span>
                  </p>
               </div>
            </div>
         )}

         <div className="space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Select Category</p>
            <div className="grid grid-cols-1 gap-2">
               {CATEGORIES.map((cat) => (
                  <button
                     key={cat.id}
                     onClick={() => setCategory(cat.id)}
                     className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${category === cat.id
                           ? "bg-correct/10 border-correct text-white shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                           : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                        }`}
                  >
                     <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${category === cat.id ? "bg-correct" : "bg-gray-600"}`} />
                        <p className="text-xs font-black uppercase tracking-wider text-white">{cat.name}</p>
                     </div>
                     <p className="text-[9px] text-gray-500 mt-1">{cat.desc}</p>
                  </button>
               ))}
            </div>
         </div>

         <button
            onClick={startMatchmaking}
            className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(46,204,113,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
         >
            <Play size={16} fill="black" /> Search Opponent
         </button>
      </motion.div>
   );
};
