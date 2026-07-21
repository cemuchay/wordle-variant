/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Play, PauseCircle } from "lucide-react";
import { CATEGORIES } from "./constants";

interface MarathonConfigModalProps {
   isOpen: boolean;
   onClose: () => void;
   categoryId: string;
   onConfirm: (config: {
      totalGames: number;
      allowPause: boolean;
      mode: "live_bot" | "async";
      targetUser?: any;
   }) => void;
   allProfiles?: any[];
}

export const MarathonConfigModal = ({
   isOpen,
   onClose,
   categoryId,
   onConfirm,
   allProfiles = [],
}: MarathonConfigModalProps) => {
   const [totalGames, setTotalGames] = useState<number>(5);
   const [allowPause, setAllowPause] = useState<boolean>(false);
   const [mode, setMode] = useState<"live_bot" | "async">("live_bot");
   const [selectedTargetUser, setSelectedTargetUser] = useState<any | null>(null);
   const [userSearch, setUserSearch] = useState<string>("");

   if (!isOpen) return null;

   const catObj = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
   const totalQuestions = totalGames * 7;

   const gameOptions = [2, 3, 5, 7, 10];

   const filteredProfiles = allProfiles.filter((p: any) =>
      (p.username || "").toLowerCase().includes(userSearch.toLowerCase())
   );

   const handleStart = () => {
      onConfirm({
         totalGames,
         allowPause,
         mode,
         targetUser: selectedTargetUser,
      });
      onClose();
   };

   return (
      <AnimatePresence>
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="w-full max-w-md bg-[#18181b] border border-amber-500/30 rounded-3xl p-6 text-white shadow-2xl space-y-6 relative overflow-hidden"
            >
               {/* Background Accent Glow */}
               <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

               {/* Header */}
               <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shadow-inner">
                        <Flame size={22} className="text-amber-400 fill-amber-400" />
                     </div>
                     <div>
                        <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">
                           Extended Marathon
                        </h2>
                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider">
                           {catObj.name} • Extended Rounds
                        </p>
                     </div>
                  </div>
                  <button
                     onClick={onClose}
                     className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors text-white/60 hover:text-white cursor-pointer"
                  >
                     <X size={18} />
                  </button>
               </div>

               {/* Game Length Selector */}
               <div className="space-y-3">
                  <div className="flex justify-between items-center">
                     <label className="text-xs font-black uppercase tracking-wider text-white">
                        Marathon Length
                     </label>
                     <span className="text-xs font-black uppercase text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                        {totalGames} Games ({totalQuestions} Rounds)
                     </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                     {gameOptions.map((g) => (
                        <button
                           key={g}
                           type="button"
                           onClick={() => setTotalGames(g)}
                           className={`py-3 rounded-2xl font-black text-xs transition-all cursor-pointer border flex flex-col items-center gap-0.5 ${
                              totalGames === g
                                 ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105"
                                 : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
                           }`}
                        >
                           <span className="text-sm">{g}x</span>
                           <span className="text-[8px] opacity-75 font-bold uppercase">{g * 7} Qs</span>
                        </button>
                     ))}
                  </div>
               </div>

               {/* Mode Selection */}
               <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-white">
                     Match Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                     <button
                        type="button"
                        onClick={() => {
                           setMode("live_bot");
                           setSelectedTargetUser(null);
                        }}
                        className={`py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer border flex items-center justify-center gap-2 ${
                           mode === "live_bot"
                              ? "bg-blue-600 text-white border-blue-400 shadow-md"
                              : "bg-white/5 hover:bg-white/10 text-white/60 border-white/10"
                        }`}
                     >
                        <span>🤖 vs Bot</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => setMode("async")}
                        className={`py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer border flex items-center justify-center gap-2 ${
                           mode === "async"
                              ? "bg-[#E85151] text-white border-red-400 shadow-md"
                              : "bg-white/5 hover:bg-white/10 text-white/60 border-white/10"
                        }`}
                     >
                        <span>👥 1v1 Async</span>
                     </button>
                  </div>
               </div>

               {/* Target User for Async mode */}
               {mode === "async" && (
                  <div className="space-y-2">
                     <label className="text-xs font-black uppercase tracking-wider text-white">
                        Select Opponent
                     </label>
                     <input
                        type="text"
                        placeholder="Search player username..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 font-bold"
                     />
                     <div className="max-h-28 overflow-y-auto space-y-1 scrollbar-hide border border-white/5 rounded-xl p-1">
                        {filteredProfiles.length > 0 ? (
                           filteredProfiles.slice(0, 5).map((p: any) => (
                              <div
                                 key={p.id}
                                 onClick={() => setSelectedTargetUser(p)}
                                 className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                                    selectedTargetUser?.id === p.id
                                       ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                       : "hover:bg-white/5 text-white/80"
                                 }`}
                              >
                                 <span>{p.username}</span>
                                 {selectedTargetUser?.id === p.id && <span className="text-[10px] text-amber-400 font-black">SELECTED</span>}
                              </div>
                           ))
                        ) : (
                           <div className="text-center py-2 text-[10px] text-white/40">No profiles found</div>
                        )}
                     </div>
                  </div>
               )}

               {/* Allow Pause & Resume Toggle */}
               <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <PauseCircle size={20} className="text-amber-400 shrink-0" />
                     <div>
                        <p className="text-xs font-black uppercase tracking-wider text-white">
                           Allow Pause & Resume
                        </p>
                        <p className="text-[10px] text-white/50 font-bold">
                           {allowPause ? "Enabled (Pause button active during match)" : "Disabled (Play straight through)"}
                        </p>
                     </div>
                  </div>

                  <button
                     type="button"
                     onClick={() => setAllowPause(!allowPause)}
                     className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                        allowPause ? "bg-amber-500 justify-end" : "bg-white/20 justify-start"
                     }`}
                  >
                     <motion.div
                        layout
                        className="w-4 h-4 rounded-full bg-white shadow-md"
                     />
                  </button>
               </div>

               {/* Action Button */}
               <button
                  type="button"
                  onClick={handleStart}
                  disabled={mode === "async" && !selectedTargetUser}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                     mode === "async" && !selectedTargetUser
                        ? "bg-gray-700 text-white/40 cursor-not-allowed"
                        : "bg-linear-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white hover:scale-102 active:scale-98"
                  }`}
               >
                  <Play size={16} fill="white" />
                  <span>Start Extended Game ({totalQuestions} Rounds)</span>
               </button>
            </motion.div>
         </div>
      </AnimatePresence>
   );
};
