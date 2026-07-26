import { useState } from "react";
import { motion } from "framer-motion";
import { X, Search, Play, Clock } from "lucide-react";
import { CATEGORIES } from "./constants";
import { CATEGORY_STYLE_MAP, DEFAULT_STYLE, loadRecents, saveRecents, pushRecent, recordClick } from "./categorySelectConstants";
import { useTopics } from "../../hooks/queries/useTopics";

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
   const { data: dbTopics = [] } = useTopics();

   if (!isOpen) return null;

   const suspendedSet = new Set(
      dbTopics.filter((t) => t.is_suspended).map((t) => t.slug)
   );
   const inactiveSet = new Set(
      dbTopics.filter((t) => !t.is_active).map((t) => t.slug)
   );

   const availableCategories = CATEGORIES.filter((cat) => !inactiveSet.has(cat.id));

   const getCategoryStyles = (catId: string, isSel: boolean) => {
      const isSuspended = suspendedSet.has(catId);
      const style = CATEGORY_STYLE_MAP[catId] || DEFAULT_STYLE;
      if (isSuspended) {
         return {
            btnClass: `bg-red-950/20 border-red-500/30 text-red-300 opacity-70 cursor-not-allowed`,
            emojiContainerClass: `bg-red-500/10 border border-red-500/30`,
         };
      }
      if (isSel) {
         return {
            btnClass: `bg-linear-to-br ${style.gradient} ${style.border} ${style.glow} shadow-md ring-1 ring-white/10`,
            emojiContainerClass: `bg-white/10 border ${style.border.split(" ")[0]}`,
         };
      } else {
         const borderCol = style.border.split(" ")[0].replace("/50", "/20");
         return {
            btnClass: `bg-slate-950/45 ${borderCol} border text-gray-300 hover:bg-slate-900/60 hover:border-white/30`,
            emojiContainerClass: `bg-white/5 border ${borderCol}`,
         };
      }
   };

   const filteredCategories = availableCategories.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.desc.toLowerCase().includes(searchQuery.toLowerCase())
   );

   const featuredCats = filteredCategories.filter(c => c.featured);
   const regularCats = filteredCategories
      .filter(c => !c.featured)
      .sort((a, b) => a.name.localeCompare(b.name));

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
      if (suspendedSet.has(id)) {
         alert("This topic is currently unavailable.");
         return;
      }
      setCategory(id);
      recordRecent(id);
      recordClick(id);
      onClose();
   };

   const handleSelectAndPlay = () => {
      if (suspendedSet.has(category)) {
         alert("This topic is currently unavailable.");
         return;
      }
      recordRecent(category);
      recordClick(category);
      startMatchmaking();
      onClose();
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pt-[calc(2rem+env(safe-area-inset-top,0))] pb-[calc(5rem+env(safe-area-inset-bottom,0))]">
         <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#121212]/95 border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
         >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
               <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Select Arena Category</h3>
                  <p className="text-[10px] text-white/40 mt-0.5">Choose an arena mode to matchmake or play bots</p>
               </div>
               <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/5 rounded-full text-white/60 hover:text-white transition-all cursor-pointer"
               >
                  <X size={18} />
               </button>
            </div>

            {/* Search Box */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2 shrink-0">
               <Search size={16} className="text-white/40 shrink-0 ml-1" />
               <input
                  type="text"
                  placeholder="Search categories or modes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/30 font-bold"
               />
               {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-[10px] font-black uppercase text-white/40 hover:text-white tracking-widest cursor-pointer mr-1">
                     Clear
                  </button>
               )}
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0 scrollbar-hide">
               {/* Recents */}
               {!searchQuery && recentCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-[#E85151] tracking-widest pl-1 flex items-center gap-1.5">
                        <Clock size={11} /> Recents
                     </p>
                     <div className="flex flex-wrap gap-2">
                        {recentCats.map((cat) => {
                           const isSel = category === cat.id;
                           const isSuspended = suspendedSet.has(cat.id);
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    isSuspended
                                       ? "bg-red-950/20 border-red-500/30 text-red-400 opacity-70"
                                       : isSel
                                       ? "bg-[#E85151]/20 border-[#E85151] text-[#E85151] shadow-[0_0_12px_rgba(232,81,81,0.15)]"
                                       : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                                 }`}
                              >
                                 <Clock size={10} className={isSel ? "text-[#E85151]" : "text-white/40"} />
                                 {cat.name}
                                 {isSuspended && <span className="text-[8px] text-red-400 uppercase font-black">(Unavailable)</span>}
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* Editor's Picks */}
               {featuredCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-[#E85151] tracking-widest pl-1">Editor's Picks</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {featuredCats.map((cat) => {
                           const isSel = category === cat.id;
                           const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                           const visual = getCategoryStyles(cat.id, isSel);
                           const isSuspended = suspendedSet.has(cat.id);
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer w-full ${visual.btnClass}`}
                              >
                                 <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${visual.emojiContainerClass}`}>
                                    {style.emoji}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                       <p className="text-xs font-black uppercase tracking-wider text-white truncate">{cat.name}</p>
                                       {isSuspended && (
                                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[8px] font-black uppercase tracking-widest shrink-0">
                                             Unavailable
                                          </span>
                                       )}
                                    </div>
                                    <p className="text-[11px] text-white/60 mt-0.5 leading-tight line-clamp-2">{cat.desc}</p>
                                 </div>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* All Categories */}
               {regularCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-white/40 tracking-widest pl-1">All Categories</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {regularCats.map((cat) => {
                           const isSel = category === cat.id;
                           const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                           const visual = getCategoryStyles(cat.id, isSel);
                           const isSuspended = suspendedSet.has(cat.id);
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer w-full ${visual.btnClass}`}
                              >
                                 <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${visual.emojiContainerClass}`}>
                                    {style.emoji}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                       <p className="text-xs font-black uppercase tracking-wider text-white truncate">{cat.name}</p>
                                       {isSuspended && (
                                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[8px] font-black uppercase tracking-widest shrink-0">
                                             Unavailable
                                          </span>
                                       )}
                                    </div>
                                    <p className="text-[11px] text-white/60 mt-0.5 leading-tight line-clamp-2">{cat.desc}</p>
                                 </div>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {filteredCategories.length === 0 && (
                  <div className="text-center py-8 text-white/40 text-xs font-bold uppercase tracking-wider">
                     No categories match "{searchQuery}"
                  </div>
               )}
            </div>

            {/* Footer Select & Play button */}
            <div className="p-4 border-t border-white/5 bg-white/5 flex gap-3">
               <button
                  onClick={onClose}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl transition-all border border-white/5 cursor-pointer"
               >
                  Back
               </button>
               <button
                  onClick={handleSelectAndPlay}
                  className="flex-1 bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(232,81,81,0.3)] cursor-pointer"
               >
                  <Play size={12} fill="white" className="text-white" /> Play Mode
               </button>
            </div>
         </motion.div>
      </div>
   );
};
