/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import {
   BarChart3,
   Clock,
   MousePointerClick,
   Smartphone,
   RefreshCw,
   ArrowLeftRight,
   Activity,
   Calendar,
   Search,
   Layers
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface AnonymizedTelemetrySectionProps {
   triggerToast: (text: string, type?: "success" | "error") => void;
}

interface TelemetrySummary {
   target_date: string;
   total_active_devices: number;
   total_app_opens: number;
   avg_app_opens_per_user: number;
   total_time_spent_seconds: number;
   avg_time_spent_seconds: number;
   total_bounces: number;
   bounce_rate_pct: number;
   top_clicks: Record<string, number>;
   top_time_spent: Record<string, number>;
}

interface RawTelemetryLog {
   id: string;
   date: string;
   client_hash: string;
   app_opens: number;
   time_spent_seconds: number;
   clicks_per_section: Record<string, number>;
   time_spent_per_section: Record<string, number>;
   is_bounce: boolean;
   created_at: string;
}

export const AnonymizedTelemetrySection: React.FC<AnonymizedTelemetrySectionProps> = ({
   triggerToast,
}) => {
   const [selectedDate, setSelectedDate] = useState<string>(
      () => new Date().toISOString().split("T")[0]
   );
   const [loading, setLoading] = useState(false);
   const [summary, setSummary] = useState<TelemetrySummary | null>(null);
   const [rawLogs, setRawLogs] = useState<RawTelemetryLog[]>([]);
   const [searchQuery, setSearchQuery] = useState("");

   const fetchTelemetry = useCallback(
      async (dateStr: string) => {
         setLoading(true);
         try {
            // 1. Fetch Aggregated Summary via RPC
            const { data: summaryData, error: summaryErr } = await supabase.rpc(
               "get_daily_telemetry_summary",
               { p_target_date: dateStr }
            );
            if (summaryErr) throw summaryErr;
            if (summaryData && summaryData.length > 0) {
               setSummary(summaryData[0]);
            } else {
               setSummary(null);
            }

            // 2. Fetch Raw Device Logs
            const { data: logsData, error: logsErr } = await supabase
               .from("daily_telemetry")
               .select("*")
               .eq("date", dateStr)
               .order("created_at", { ascending: false });

            if (logsErr) throw logsErr;
            setRawLogs(logsData || []);
         } catch (err: any) {
            triggerToast(err.message || "Failed to load telemetry data", "error");
         } finally {
            setLoading(false);
         }
      },
      [triggerToast]
   );

   useEffect(() => {
      fetchTelemetry(selectedDate);
   }, [selectedDate, fetchTelemetry]);

   const formatDuration = (totalSeconds: number): string => {
      if (!totalSeconds || isNaN(totalSeconds)) return "0s";
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      if (m === 0) return `${s}s`;
      return `${m}m ${s}s`;
   };

   // Sort Top Clicks
   const sortedClicks = summary?.top_clicks
      ? Object.entries(summary.top_clicks).sort((a, b) => b[1] - a[1])
      : [];

   const maxClicks = sortedClicks.length > 0 ? sortedClicks[0][1] : 1;

   // Sort Top Time Spent
   const sortedTime = summary?.top_time_spent
      ? Object.entries(summary.top_time_spent).sort((a, b) => b[1] - a[1])
      : [];

   const maxTime = sortedTime.length > 0 ? sortedTime[0][1] : 1;

   // Filter Raw Logs
   const filteredLogs = rawLogs.filter((log) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
         log.client_hash.toLowerCase().includes(q) ||
         log.id.toLowerCase().includes(q)
      );
   });

   return (
      <div className="space-y-6">
         {/* Top Header & Controls */}
         <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
               <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Activity className="text-correct" size={20} /> Anonymized Telemetry Dashboard
               </h3>
               <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                  Client usage metrics, app opens, active durations & bounce analytics
               </p>
            </div>

            {/* Date Quick Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
               <button
                  onClick={() =>
                     setSelectedDate(new Date().toISOString().split("T")[0])
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                     selectedDate === new Date().toISOString().split("T")[0]
                        ? "bg-correct text-black shadow-md"
                        : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                  }`}
               >
                  Today
               </button>
               <button
                  onClick={() => {
                     const y = new Date();
                     y.setDate(y.getDate() - 1);
                     setSelectedDate(y.toISOString().split("T")[0]);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                     selectedDate ===
                     new Date(Date.now() - 86400000).toISOString().split("T")[0]
                        ? "bg-correct text-black shadow-md"
                        : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                  }`}
               >
                  Yesterday
               </button>

               <div className="relative flex items-center">
                  <Calendar size={14} className="absolute left-3 text-gray-500" />
                  <input
                     type="date"
                     value={selectedDate}
                     onChange={(e) => setSelectedDate(e.target.value)}
                     className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-correct/50 font-bold"
                  />
               </div>

               <button
                  onClick={() => fetchTelemetry(selectedDate)}
                  disabled={loading}
                  className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Telemetry"
               >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
               </button>
            </div>
         </div>

         {/* Summary KPI Cards Grid */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Devices */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Active Devices
                  </span>
                  <Smartphone className="text-indigo-400" size={18} />
               </div>
               <div className="mt-3">
                  <span className="text-2xl font-black tracking-tight text-white">
                     {summary?.total_active_devices || 0}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-2">
                     Anonymous Clients
                  </span>
               </div>
            </div>

            {/* Total App Opens */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Daily App Opens
                  </span>
                  <BarChart3 className="text-correct" size={18} />
               </div>
               <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-black tracking-tight text-white">
                     {summary?.total_app_opens || 0}
                  </span>
                  <span className="text-xs font-bold text-correct bg-correct/10 px-2 py-0.5 rounded-lg border border-correct/20">
                     {summary?.avg_app_opens_per_user || 0} / user
                  </span>
               </div>
            </div>

            {/* Avg Time Spent */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Avg Time Spent
                  </span>
                  <Clock className="text-yellow-400" size={18} />
               </div>
               <div className="mt-3">
                  <span className="text-2xl font-black tracking-tight text-white">
                     {formatDuration(summary?.avg_time_spent_seconds || 0)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-2">
                     Active session duration
                  </span>
               </div>
            </div>

            {/* Bounce Rate */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Bounce Rate
                  </span>
                  <ArrowLeftRight className="text-red-400" size={18} />
               </div>
               <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-black tracking-tight text-white">
                     {summary?.bounce_rate_pct || 0}%
                  </span>
                  <span
                     className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                        (summary?.bounce_rate_pct || 0) <= 25
                           ? "bg-correct/10 border-correct/20 text-correct"
                           : (summary?.bounce_rate_pct || 0) <= 50
                           ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                           : "bg-red-500/10 border-red-500/20 text-red-400"
                     }`}
                  >
                     {summary?.total_bounces || 0} bounces
                  </span>
               </div>
            </div>
         </div>

         {/* Most Clicked & Most Time Spent Section Rankings */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Clicked Sections */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
               <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h4 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                     <MousePointerClick className="text-correct" size={16} /> Most Clicked Sections & Modals
                  </h4>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                     Top Interactions
                  </span>
               </div>

               {sortedClicks.length === 0 ? (
                  <div className="py-10 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
                     No section clicks logged for {selectedDate}
                  </div>
               ) : (
                  <div className="space-y-3">
                     {sortedClicks.map(([section, count]) => {
                        const pct = Math.round((count / maxClicks) * 100);
                        return (
                           <div key={section} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold">
                                 <span className="text-gray-200 capitalize">
                                    {section.replace(/[-_]/g, " ")}
                                 </span>
                                 <span className="text-correct font-mono">
                                    {count} clicks
                                 </span>
                              </div>
                              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                                 <div
                                    className="bg-correct h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                 />
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>

            {/* Most Time Spent Sections */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
               <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h4 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                     <Clock className="text-indigo-400" size={16} /> Most Time Spent per Section
                  </h4>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                     Duration Breakdown
                  </span>
               </div>

               {sortedTime.length === 0 ? (
                  <div className="py-10 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
                     No section duration logged for {selectedDate}
                  </div>
               ) : (
                  <div className="space-y-3">
                     {sortedTime.map(([section, seconds]) => {
                        const pct = Math.round((seconds / maxTime) * 100);
                        return (
                           <div key={section} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold">
                                 <span className="text-gray-200 capitalize">
                                    {section.replace(/[-_]/g, " ")}
                                 </span>
                                 <span className="text-indigo-400 font-mono">
                                    {formatDuration(seconds)}
                                 </span>
                              </div>
                              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                                 <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                 />
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </div>

         {/* Raw Anonymized Logs Data Table */}
         <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
               <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                     <Layers className="text-yellow-400" size={16} /> Raw Anonymous Client Logs ({filteredLogs.length})
                  </h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                     Individual anonymized payloads submitted for {selectedDate}
                  </p>
               </div>

               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                     type="text"
                     placeholder="Search client hash..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-correct/50 placeholder-gray-600"
                  />
               </div>
            </div>

            {loading ? (
               <div className="py-12 text-center text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-correct" />
                  Loading telemetry logs...
               </div>
            ) : filteredLogs.length === 0 ? (
               <div className="py-12 border border-dashed border-white/5 rounded-xl text-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                  No telemetry logs submitted for {selectedDate}
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                     <thead className="bg-black/40 text-[9px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                        <tr>
                           <th className="py-3 px-4">Client Hash</th>
                           <th className="py-3 px-4">App Opens</th>
                           <th className="py-3 px-4">Time Spent</th>
                           <th className="py-3 px-4">Top Clicks</th>
                           <th className="py-3 px-4">Bounce?</th>
                           <th className="py-3 px-4 text-right">Submitted At</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                        {filteredLogs.map((log) => {
                           const clickSummary = Object.entries(log.clicks_per_section || {})
                              .map(([sec, cnt]) => `${sec}: ${cnt}`)
                              .slice(0, 2)
                              .join(", ");

                           return (
                              <tr key={log.id} className="hover:bg-white/2 transition-colors">
                                 <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                                    {log.client_hash.substring(0, 12)}...
                                 </td>
                                 <td className="py-3 px-4 font-bold text-white">
                                    {log.app_opens}
                                 </td>
                                 <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                                    {formatDuration(log.time_spent_seconds)}
                                 </td>
                                 <td className="py-3 px-4 text-gray-400 truncate max-w-[200px]">
                                    {clickSummary || "None"}
                                 </td>
                                 <td className="py-3 px-4">
                                    {log.is_bounce ? (
                                       <span className="text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                          Yes (Bounce)
                                       </span>
                                    ) : (
                                       <span className="text-[9px] font-black uppercase tracking-wider text-correct bg-correct/10 px-2 py-0.5 rounded border border-correct/20">
                                          Engaged
                                       </span>
                                    )}
                                 </td>
                                 <td className="py-3 px-4 text-right font-mono text-[10px] text-gray-500">
                                    {new Date(log.created_at).toLocaleTimeString([], {
                                       hour: "2-digit",
                                       minute: "2-digit",
                                    })}
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      </div>
   );
};

export default AnonymizedTelemetrySection;
