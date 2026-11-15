import { useState } from "react";
import {
   BarChart3,
   CalendarPlus,
   Clock,
   EyeOff,
   Pin,
   RefreshCw,
   Shield,
   StopCircle,
   Trophy,
} from "lucide-react";
import { useAdminPolls } from "../../../hooks/useAdminPolls";
import { formatPollRemainingTime } from "../../../hooks/usePoll";
import { extendPollLifetime } from "../../../services/pollService";
import { MAX_POLL_LIFETIME_HOURS, MAX_POLL_EXTENSIONS, type Poll } from "../../../types/poll";
import { AdminPollDetailView } from "./AdminPollDetailView";

interface AdminPollsTabProps {
   currentUserId?: string;
   onToast: (text: string, type?: "success" | "error") => void;
}

export const AdminPollsTab = ({ currentUserId, onToast }: AdminPollsTabProps) => {
   const {
      enrichedPolls,
      activePolls,
      pastPolls,
      loading,
      actionLoadingId,
      handleTogglePin,
      handleEndEarly,
      refresh,
   } = useAdminPolls(true, currentUserId);

   const [filterTab, setFilterTab] = useState<"all" | "active" | "past">("active");
   const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
   const [extendingId, setExtendingId] = useState<string | null>(null);

   const selectedItem = enrichedPolls.find((p) => p.poll.id === selectedPollId) || null;
   const displayedPolls =
      filterTab === "active"
         ? activePolls
         : filterTab === "past"
         ? pastPolls
         : enrichedPolls;

   const canExtendPoll = (poll: Poll, isExpired: boolean): { allowed: boolean; reason?: string } => {
      if (isExpired) return { allowed: false, reason: "Poll has expired" };
      const extCount = poll.extension_count ?? 0;
      if (extCount >= MAX_POLL_EXTENSIONS) {
         return { allowed: false, reason: `Max ${MAX_POLL_EXTENSIONS} extensions reached` };
      }
      const createdMs = new Date(poll.created_at).getTime();
      const expiresMs = new Date(poll.expires_at).getTime();
      const maxMs = createdMs + MAX_POLL_LIFETIME_HOURS * 60 * 60 * 1000;
      if (expiresMs >= maxMs) {
         return { allowed: false, reason: "Already at 10-day max lifetime" };
      }
      return { allowed: true };
   };

   const [extendDaysByPoll, setExtendDaysByPoll] = useState<Record<string, number>>({});

   const getRemainingExtendableDays = (poll: Poll): number => {
      const createdMs = new Date(poll.created_at).getTime();
      const expiresMs = new Date(poll.expires_at).getTime();
      const maxMs = createdMs + MAX_POLL_LIFETIME_HOURS * 60 * 60 * 1000;
      const remainingMs = Math.max(0, maxMs - expiresMs);
      return Math.floor(remainingMs / (24 * 60 * 60 * 1000));
   };

   const handleExtend = async (e: React.MouseEvent, poll: Poll) => {
      e.stopPropagation();
      const days = extendDaysByPoll[poll.id] ?? 1;
      setExtendingId(poll.id);
      try {
         await extendPollLifetime(poll.id, days);
         await refresh();
         onToast(`Poll lifetime extended by +${days} ${days === 1 ? "day" : "days"}.`, "success");
      } catch (err: unknown) {
         onToast(err instanceof Error ? err.message : "Failed to extend poll", "error");
      } finally {
         setExtendingId(null);
      }
   };

   if (selectedItem) {
      return (
         <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <AdminPollDetailView
               item={selectedItem}
               actionLoading={actionLoadingId === selectedItem.poll.id}
               onBack={() => setSelectedPollId(null)}
               onTogglePin={() => void handleTogglePin(selectedItem.poll)}
               onEndEarly={() => void handleEndEarly(selectedItem.poll.id)}
            />
         </div>
      );
   }

   return (
      <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
         <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                  <BarChart3 size={22} />
               </div>
               <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                     Admin Polls & Lifetime Manager
                     <Shield size={14} className="text-correct" />
                  </h2>
                  <p className="text-xs text-gray-400">
                     Extend active polls by +1 day (max 2 extensions, up to 7 days total), pin, or close early.
                  </p>
               </div>
            </div>

            <button
               type="button"
               onClick={() => void refresh()}
               className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-colors cursor-pointer"
               title="Refresh polls"
            >
               <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
         </div>

         {/* Filter Tabs */}
         <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10">
            {(
               [
                  { key: "active", label: `Active (${activePolls.length})` },
                  { key: "past", label: `Expired (${pastPolls.length})` },
                  { key: "all", label: `All (${enrichedPolls.length})` },
               ] as const
            ).map((tab) => (
               <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                     filterTab === tab.key
                        ? "bg-indigo-600 text-white shadow"
                        : "text-gray-400 hover:text-white"
                  }`}
               >
                  {tab.label}
               </button>
            ))}
         </div>

         {/* Polls List */}
         {loading && enrichedPolls.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading polls...</div>
         ) : displayedPolls.length === 0 ? (
            <div className="py-12 text-center space-y-2">
               <BarChart3 className="w-10 h-10 text-gray-600 mx-auto" />
               <p className="text-sm font-bold text-gray-400">No polls in this category.</p>
            </div>
         ) : (
            <div className="space-y-3">
               {displayedPolls.map((item) => {
                  const { poll, totalVotes, isExpired, optionResults } = item;
                  const remaining = formatPollRemainingTime(poll.expires_at);
                  const leading = [...optionResults].sort((a, b) => b.count - a.count)[0];
                  const extCheck = canExtendPoll(poll, isExpired);
                  const extCount = poll.extension_count ?? 0;

                  return (
                     <div
                        key={poll.id}
                        onClick={() => setSelectedPollId(poll.id)}
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/[0.07] border border-white/10 transition-all cursor-pointer space-y-3"
                     >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                           <div className="flex items-center gap-2 flex-wrap">
                              <span
                                 className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isExpired
                                       ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                       : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                 }`}
                              >
                                 <Clock size={10} className="inline mr-1" />
                                 {isExpired ? "Expired" : remaining.text}
                              </span>

                              {poll.is_pinned && !isExpired && (
                                 <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                    <Pin size={10} /> Pinned
                                 </span>
                              )}

                              {poll.is_anonymous && (
                                 <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                    <EyeOff size={10} /> Anon
                                 </span>
                              )}

                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[10px] font-black uppercase">
                                 Extensions: {extCount}/{MAX_POLL_EXTENSIONS}
                              </span>
                           </div>

                           <span className="text-xs font-black text-white">
                              {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                           </span>
                        </div>

                        <h4 className="text-sm font-extrabold text-white">{poll.question}</h4>

                        {leading && leading.count > 0 && (
                           <div className="flex items-center justify-between text-xs bg-black/30 px-3 py-2 rounded-xl border border-white/5">
                              <span className="text-gray-300 flex items-center gap-1.5 truncate">
                                 <Trophy size={12} className="text-correct shrink-0" />
                                 Leading: <strong className="text-white">{leading.option.text}</strong>
                              </span>
                              <span className="text-correct font-black shrink-0 ml-2">
                                 {leading.percentage}% ({leading.count})
                              </span>
                           </div>
                        )}

                        {/* Quick Admin Actions */}
                        {!isExpired && (
                           <div
                              onClick={(e) => e.stopPropagation()}
                              className="pt-2 border-t border-white/10 flex items-center gap-2 flex-wrap"
                           >
                              {extCheck.allowed && (
                                 <select
                                    value={extendDaysByPoll[poll.id] ?? 1}
                                    onChange={(e) =>
                                       setExtendDaysByPoll((prev) => ({
                                          ...prev,
                                          [poll.id]: Number(e.target.value),
                                       }))
                                    }
                                    disabled={extendingId === poll.id}
                                    aria-label="Days to extend poll"
                                    className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-[11px] font-bold cursor-pointer focus:outline-none focus:border-indigo-400"
                                 >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => {
                                       const maxExtendable = getRemainingExtendableDays(poll);
                                       const isDisabled = d > maxExtendable;
                                       return (
                                          <option
                                             key={d}
                                             value={d}
                                             disabled={isDisabled}
                                             className="bg-gray-900 text-gray-200 disabled:text-gray-600"
                                          >
                                             +{d} {d === 1 ? "Day" : "Days"}
                                          </option>
                                       );
                                    })}
                                 </select>
                              )}
                              <button
                                 type="button"
                                 disabled={!extCheck.allowed || extendingId === poll.id}
                                 onClick={(e) => void handleExtend(e, poll)}
                                 title={
                                    extCheck.reason ||
                                    `Extend poll lifetime by +${extendDaysByPoll[poll.id] ?? 1} ${(extendDaysByPoll[poll.id] ?? 1) === 1 ? "day" : "days"}`
                                 }
                                 className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition-all border ${
                                    extCheck.allowed
                                       ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 cursor-pointer"
                                       : "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed"
                                 }`}
                              >
                                 <CalendarPlus size={12} />
                                 <span>
                                    {extendingId === poll.id
                                       ? "Extending..."
                                       : extCheck.allowed
                                       ? `Extend +${extendDaysByPoll[poll.id] ?? 1}d`
                                       : extCheck.reason}
                                 </span>
                              </button>

                              <button
                                 type="button"
                                 disabled={actionLoadingId === poll.id}
                                 onClick={() => void handleTogglePin(poll)}
                                 className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                 <Pin size={12} />
                                 <span>{poll.is_pinned ? "Unpin" : "Pin"}</span>
                              </button>

                              <button
                                 type="button"
                                 disabled={actionLoadingId === poll.id}
                                 onClick={() => void handleEndEarly(poll.id)}
                                 className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer ml-auto"
                              >
                                 <StopCircle size={12} />
                                 <span>End Now</span>
                              </button>
                           </div>
                        )}
                     </div>
                  );
               })}
            </div>
         )}
      </div>
   );
};

