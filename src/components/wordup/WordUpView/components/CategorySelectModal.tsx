import { useState } from "react";
import { motion } from "framer-motion";
import { X, Search, Play, Clock } from "lucide-react";
import { CATEGORIES } from "../constants";
import { safeLocalStorage } from "../../../../utils/storage";
import { useWordUpStore } from "../../../../store/useWordUpStore";

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

export const CATEGORY_STYLE_MAP: Record<string, { emoji: string; gradient: string; glow: string; border: string }> = {
   mixed: {
      emoji: "🎲",
      gradient: "from-emerald-950/40 via-teal-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(52,211,153,0.15)]",
      border: "border-emerald-500/50 text-emerald-400"
   },
   vowel_drop: {
      emoji: "🅰️",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   anagram_scrambled: {
      emoji: "🔀",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   reverse_wordle: {
      emoji: "🔄",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   missing_letter: {
      emoji: "🧩",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   word_ladder: {
      emoji: "🪜",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   rhyme_match: {
      emoji: "🎵",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   letter_count: {
      emoji: "🔢",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   capitals_clash: {
      emoji: "🌍",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   currency_exchange: {
      emoji: "💸",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   flag_bearer: {
      emoji: "🚩",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   mental_math_blitz: {
      emoji: "🧮",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   sequence_solver: {
      emoji: "📈",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   element_arena: {
      emoji: "🧪",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   animal_kingdom: {
      emoji: "🦁",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   cosmic_frontier: {
      emoji: "🚀",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   cinephile_trivia: {
      emoji: "🎬",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   history_milestones: {
      emoji: "🏛️",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   naija_music: {
      emoji: "🎧",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   naija_celebs: {
      emoji: "🇳🇬",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   unn_lions: {
      emoji: "🦁",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   nysc_trivia: {
      emoji: "🪖",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   us_tech_trivia: {
      emoji: "💻",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   elon_musk: {
      emoji: "🚘",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   }
};

const DEFAULT_STYLE = {
   emoji: "💡",
   gradient: "from-slate-950/40 via-slate-900/30 to-slate-950/40",
   glow: "shadow-[0_0_15px_rgba(255,255,255,0.05)]",
   border: "border-white/20 text-gray-300"
};

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

   const getCategoryStyles = (catId: string, isSel: boolean) => {
      const style = CATEGORY_STYLE_MAP[catId] || DEFAULT_STYLE;
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

   const filteredCategories = CATEGORIES.filter(cat =>
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
       setCategory(id);
       recordRecent(id);
       onClose();
    };

    const handleSelectAndPlay = () => {
        const currentCategory = useWordUpStore.getState().category;
        recordRecent(currentCategory);
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

            {/* Search Box — always visible */}
            <div className="p-4 border-b border-white/5 bg-slate-950/45 flex items-center gap-2 shrink-0">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0 scrollbar-hide">
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

               {/* Editor's Picks — vertical list */}
               {featuredCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-amber-400 tracking-widest pl-1">Editor's Picks</p>
                     <div className="flex flex-col gap-2">
                        {featuredCats.map((cat) => {
                           const isSel = category === cat.id;
                           const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                           const visual = getCategoryStyles(cat.id, isSel);
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer w-full ${visual.btnClass}`}
                              >
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${visual.emojiContainerClass}`}>
                                    {style.emoji}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase tracking-wider text-white truncate">{cat.name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{cat.desc}</p>
                                 </div>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               )}

               {/* All Categories (alphabetical) — single column */}
               {regularCats.length > 0 && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-widest pl-1">All Categories</p>
                     <div className="flex flex-col gap-2">
                        {regularCats.map((cat) => {
                           const isSel = category === cat.id;
                           const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                           const visual = getCategoryStyles(cat.id, isSel);
                           return (
                              <button
                                 key={cat.id}
                                 onClick={() => handleCategoryClick(cat.id)}
                                 className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer w-full ${visual.btnClass}`}
                              >
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${visual.emojiContainerClass}`}>
                                    {style.emoji}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black uppercase tracking-wider text-white truncate">{cat.name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{cat.desc}</p>
                                 </div>
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
