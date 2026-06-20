import { useState } from "react";
import { motion } from "framer-motion";
import { X, Search, Play, Clock } from "lucide-react";
import { CATEGORIES } from "../constants";
import { safeLocalStorage } from "../../../../utils/storage";

const RECENTS_KEY = "wordup_recent_categories";
const MAX_RECENTS = 5;

function loadRecents(): string[] {
   try {
      const raw = safeLocalStorage.getItem(RECENTS_KEY);
      return raw ? JSON.parse(raw) : [];
   } catch {
      return [];
   }
}

function saveRecents(ids: string[]) {
   try {
      safeLocalStorage.setItem(RECENTS_KEY, JSON.stringify(ids));
   } catch { /* ignore */ }
}

function pushRecent(ids: string[], id: string): string[] {
   const filtered = ids.filter((i) => i !== id);
   return [id, ...filtered].slice(0, MAX_RECENTS);
}

interface CategorySelectModalProps {
   isOpen: boolean;
   onClose: () => void;
   category: string;
   setCategory: (catId: string) => void;
   startMatchmaking: () => void;
}

export const CategorySelectModal = ({
   isOpen,
   onClose,
   category,
   setCategory,
   startMatchmaking
}: CategorySelectModalProps) => {
   const [searchQuery, setSearchQuery] = useState("");
   const [recents, setRecents] = useState<string[]>(() => loadRecents());

   if (!isOpen) return null;

   const filteredCategories = CATEGORIES.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.desc.toLowerCase().includes(searchQuery.toLowerCase())
   );

   const generalCats = filteredCategories.filter(c => c.type === "general");
   const lengthCats = filteredCategories.filter(c => c.type === "length");
   const gameTypeCats = filteredCategories.filter(c => c.type === "game_type");
   const proceduralCats = filteredCategories.filter(c => c.type === "procedural");

   const recentCats = recents
      .map((id) => CATEGORIES.find((c) => c.id === id))
      .filter(Boolean) as typeof CATEGORIES;

   const recordRecent = (id: string) => {
      setRecents((prev) => {
         const next = pushRecent(prev, id);
         saveRecents(next);
         return next;
      });
   };

   const handleCategoryClick = (id: string) => {
      setCategory(id);
      recordRecent(id);
   };

   const handleSelectAndPlay = () => {
      recordRecent(category);
      startMatchmaking();
      onClose();
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pt-[calc(2rem+env(safe-area-inset-top,0))] pb-[calc(5rem+env(safe-area-inset-bottom,0))]">
         <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
         >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
               <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Select Arena Category</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Choose an arena mode to matchmake or play bots</p>
               </div>
               <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
               >
                  <X size={18} />
               </button>
            </div>

            {/* Search Box */}
            <div className="p-4 border-b border-white/5 bg-slate-950/45 flex items-center gap-2">
               <Search size={16} className="text-gray-500 shrink-0 ml-1" />
               <input
                  type="text"
                  placeholder="Search categories or modes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-gray-500 font-bold"
               />
               {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-[10px] font-black uppercase text-gray-500 hover:text-white tracking-widest cursor-pointer mr-1">
                     Clear
                  </button>
               )}
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-hide">
               {/* Recents (only when not searching) */}
               {!searchQuery && recentCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-amber-400 tracking-widest pl-1 flex items-center gap-1.5">
                        <Clock size={11} /> Recents
                     </p>
                     <div className="flex flex-wrap gap-2">
                        {recentCats.map((cat) => {
                           const isSel = category === cat.id;
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    isSel
                                       ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                                       : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                                 }`}
                              >
                                 <Clock size={10} className={isSel ? "text-amber-400" : "text-gray-600"} />
                                 {cat.name}
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* Mixed / Quick Match */}
               {generalCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest pl-1">General</p>
                     <div className="grid grid-cols-1 gap-2">
                        {generalCats.map((cat) => {
                           const isSel = category === cat.id;
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                    isSel
                                       ? "bg-correct/10 border-correct text-white shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                                       : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                 }`}
                              >
                                 <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isSel ? "bg-correct animate-pulse" : "bg-gray-600"}`} />
                                    <p className="text-xs font-black uppercase tracking-wider text-white">{cat.name}</p>
                                 </div>
                                 <p className="text-[9px] text-gray-500 mt-1">{cat.desc}</p>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* Lengths */}
               {lengthCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest pl-1">Word Length Modes</p>
                     <div className="grid grid-cols-2 gap-2">
                        {lengthCats.map((cat) => {
                           const isSel = category === cat.id;
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                    isSel
                                       ? "bg-correct/10 border-correct text-white shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                                       : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                 }`}
                              >
                                 <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-correct" : "bg-gray-600"}`} />
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-white truncate">{cat.name}</p>
                                 </div>
                                 <p className="text-[8px] text-gray-500 mt-0.5 line-clamp-1">{cat.desc}</p>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* Game Types */}
               {gameTypeCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest pl-1">Game Type Modes</p>
                     <div className="grid grid-cols-2 gap-2">
                        {gameTypeCats.map((cat) => {
                           const isSel = category === cat.id;
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                    isSel
                                       ? "bg-correct/10 border-correct text-white shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                                       : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                 }`}
                              >
                                 <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-correct" : "bg-gray-600"}`} />
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-white truncate">{cat.name}</p>
                                 </div>
                                 <p className="text-[8px] text-gray-500 mt-0.5 line-clamp-1">{cat.desc}</p>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* Knowledge Categories */}
               {proceduralCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-cyan-400 tracking-widest pl-1">Knowledge Categories</p>
                     <div className="grid grid-cols-2 gap-2">
                        {proceduralCats.map((cat) => {
                           const isSel = category === cat.id;
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                    isSel
                                       ? "bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                       : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                 }`}
                              >
                                 <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-cyan-400 animate-pulse" : "bg-gray-600"}`} />
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-white truncate">{cat.name}</p>
                                 </div>
                                 <p className="text-[8px] text-gray-500 mt-0.5 line-clamp-1">{cat.desc}</p>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {filteredCategories.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-xs font-bold uppercase tracking-wider">
                     No categories match "{searchQuery}"
                  </div>
               )}
            </div>

            {/* Footer Select & Play button */}
            <div className="p-4 border-t border-white/5 bg-slate-950/30 flex gap-3">
               <button
                  onClick={onClose}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl transition-all border border-white/5 cursor-pointer"
               >
                  Back
               </button>
               <button
                  onClick={handleSelectAndPlay}
                  className="flex-1 bg-correct hover:bg-correct/90 text-black font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_15px_rgba(46,204,113,0.2)] cursor-pointer"
               >
                  <Play size={12} fill="black" /> Play Mode
               </button>
            </div>
         </motion.div>
      </div>
   );
};
