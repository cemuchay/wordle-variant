import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
   BarChart3,
   ChevronRight,
   Clock,
   EyeOff,
   Pin,
   RefreshCw,
   Shield,
   Trophy,
   X,
} from "lucide-react";
import { useAdminPolls } from "../../../hooks/useAdminPolls";
import { formatPollRemainingTime } from "../../../hooks/usePoll";
import { AdminPollDetailView } from "./AdminPollDetailView";

interface AdminPollsModalProps {
   isOpen: boolean;
   onClose: () => void;
   currentUserId?: string;
}

export const AdminPollsModal = ({
   isOpen,
   onClose,
   currentUserId,
}: AdminPollsModalProps) => {
   const {
      enrichedPolls,
      activePolls,
      pastPolls,
      loading,
      actionLoadingId,
      handleTogglePin,
      handleEndEarly,
      refresh,
   } = useAdminPolls(isOpen, currentUserId);

   const [filterTab, setFilterTab] = useState<"all" | "active" | "past">("all");
   const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

   const selectedItem = enrichedPolls.find((p) => p.poll.id === selectedPollId) || null;

   const displayedPolls =
      filterTab === "active"
         ? activePolls
         : filterTab === "past"
         ? pastPolls
         : enrichedPolls;

   return (
      <AnimatePresence>
         {isOpen && (
            <div
               onClick={onClose}
               className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            >
               <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh]"
               >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 shrink-0">
                     <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300">
                           <BarChart3 size={16} />
                        </div>
                        <div>
                           <h2 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                              Admin Polls & Results
                              <Shield size={12} className="text-correct" />
                           </h2>
                           <p className="text-[11px] text-gray-400">
                              Inspect General group admin polls, live vote tallies, and pinned status
                           </p>
                        </div>
                     </div>

                     <div className="flex items-center gap-1">
                        <button
                           type="button"
                           onClick={() => void refresh()}
                           className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                           title="Refresh polls"
                        >
                           <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button
                           type="button"
                           onClick={onClose}
                           className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        >
                           <X size={16} />
                        </button>
                     </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-3">
                     {selectedItem ? (
                        <AdminPollDetailView
                           item={selectedItem}
                           actionLoading={actionLoadingId === selectedItem.poll.id}
                           onBack={() => setSelectedPollId(null)}
                           onTogglePin={() => void handleTogglePin(selectedItem.poll)}
                           onEndEarly={() => void handleEndEarly(selectedItem.poll.id)}
                        />
                     ) : (
                        <>
                           {/* Filter Tabs */}
                           <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
                              {(
                                 [
                                    { key: "all", label: `All (${enrichedPolls.length})` },
                                    { key: "active", label: `Active (${activePolls.length})` },
                                    { key: "past", label: `Ended (${pastPolls.length})` },
                                 ] as const
                              ).map((tab) => (
                                 <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setFilterTab(tab.key)}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                       filterTab === tab.key
                                          ? "bg-indigo-600 text-white shadow"
                                          : "text-gray-400 hover:text-white"
                                    }`}
                                 >
                                    {tab.label}
                                 </button>
                              ))}
                           </div>

                           {loading && enrichedPolls.length === 0 ? (
                              <div className="py-12 text-center text-xs text-gray-400">
                                 Loading admin polls...
                              </div>
                           ) : displayedPolls.length === 0 ? (
                              <div className="py-12 text-center space-y-2">
                                 <BarChart3 className="w-8 h-8 text-gray-600 mx-auto" />
                                 <p className="text-xs font-bold text-gray-400">
                                    No admin polls found in this category.
                                 </p>
                                 <p className="text-[11px] text-gray-500">
                                    Create an admin poll from the General chat room to see its live results here.
                                 </p>
                              </div>
                           ) : (
                              <div className="space-y-2.5">
                                 {displayedPolls.map((item) => {
                                    const { poll, totalVotes, isExpired, optionResults } = item;
                                    const remaining = formatPollRemainingTime(poll.expires_at);
                                    const leading = [...optionResults].sort(
                                       (a, b) => b.count - a.count
                                    )[0];

                                    return (
                                       <div
                                          key={poll.id}
                                          onClick={() => setSelectedPollId(poll.id)}
                                          className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer space-y-2 group"
                                       >
                                          <div className="flex items-center justify-between gap-2">
                                             <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                   className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                      isExpired
                                                         ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                                         : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                   }`}
                                                >
                                                   <Clock size={8} className="inline mr-1" />
                                                   {isExpired ? "Ended" : remaining.text}
                                                </span>

                                                {poll.is_pinned && !isExpired && (
                                                   <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase inline-flex items-center gap-1">
                                                      <Pin size={8} /> Pinned
                                                   </span>
                                                )}

                                                {poll.is_anonymous && (
                                                   <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-black uppercase inline-flex items-center gap-1">
                                                      <EyeOff size={8} /> Anon
                                                   </span>
                                                )}
                                             </div>

                                             <div className="flex items-center gap-1 text-xs font-black text-indigo-300">
                                                <span>{totalVotes} votes</span>
                                                <ChevronRight
                                                   size={14}
                                                   className="group-hover:translate-x-0.5 transition-transform"
                                                />
                                             </div>
                                          </div>

                                          <h4 className="text-xs font-extrabold text-white leading-snug">
                                             {poll.question}
                                          </h4>

                                          {leading && leading.count > 0 && (
                                             <div className="flex items-center justify-between text-[11px] bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-white/5">
                                                <span className="text-gray-300 flex items-center gap-1.5 truncate">
                                                   <Trophy size={11} className="text-correct shrink-0" />
                                                   Leading: <strong className="text-white">{leading.option.text}</strong>
                                                </span>
                                                <span className="text-correct font-black shrink-0 ml-2">
                                                   {leading.percentage}% ({leading.count})
                                                </span>
                                             </div>
                                          )}
                                       </div>
                                    );
                                 })}
                              </div>
                           )}
                        </>
                     )}
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
   );
};

