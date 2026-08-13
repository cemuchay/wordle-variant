/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useMemo } from "react";
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

const to2dp = (val: number | undefined | null): string => {
   if (val === undefined || val === null || isNaN(val)) return "0.00";
   return Number(val).toFixed(2);
};

const calculateMean = (numbers: number[]): number => {
   if (numbers.length === 0) return 0;
   const sum = numbers.reduce((acc, curr) => acc + curr, 0);
   return sum / numbers.length;
};

const calculateMedian = (numbers: number[]): number => {
   if (numbers.length === 0) return 0;
   const sorted = [...numbers].sort((a, b) => a - b);
   const middle = Math.floor(sorted.length / 2);
   if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
   }
   return sorted[middle];
};

const formatDuration = (totalSeconds: number): string => {
   if (!totalSeconds || isNaN(totalSeconds)) return "0.00s";
   const m = Math.floor(totalSeconds / 60);
   const s = (totalSeconds % 60).toFixed(2);
   if (m === 0) return `${s}s`;
   return `${m}m ${s}s`;
};

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

   // Overall App Opens Metrics (Mean & Median)
   const appOpensMetrics = useMemo(() => {
      const arr = rawLogs.map((l) => Number(l.app_opens) || 0);
      const mean = arr.length > 0 ? calculateMean(arr) : Number(summary?.avg_app_opens_per_user) || 0;
      const median = arr.length > 0 ? calculateMedian(arr) : 0;
      return { mean, median };
   }, [rawLogs, summary]);

   // Overall Time Spent Metrics (Mean & Median)
   const timeSpentMetrics = useMemo(() => {
      const arr = rawLogs.map((l) => Number(l.time_spent_seconds) || 0);
      const mean = arr.length > 0 ? calculateMean(arr) : Number(summary?.avg_time_spent_seconds) || 0;
      const median = arr.length > 0 ? calculateMedian(arr) : 0;
      return { mean, median };
   }, [rawLogs, summary]);

   // Section Clicks Stats (Total, Mean, Median per Section)
   const sectionClicksStats = useMemo(() => {
      const sectionMap: Record<string, number[]> = {};

      if (summary?.top_clicks) {
         Object.keys(summary.top_clicks).forEach((sec) => {
            sectionMap[sec] = [];
         });
      }

      rawLogs.forEach((log) => {
         const clicks = log.clicks_per_section || {};
         Object.keys(clicks).forEach((sec) => {
            if (!sectionMap[sec]) sectionMap[sec] = [];
         });
      });

      rawLogs.forEach((log) => {
         const clicks = log.clicks_per_section || {};
         Object.keys(sectionMap).forEach((sec) => {
            sectionMap[sec].push(Number(clicks[sec]) || 0);
         });
      });

      const result = Object.entries(sectionMap).map(([section, counts]) => {
         const total = counts.length > 0
            ? counts.reduce((a, b) => a + b, 0)
            : Number(summary?.top_clicks?.[section]) || 0;
         const mean = counts.length > 0
            ? calculateMean(counts)
            : (Number(summary?.top_clicks?.[section]) || 0) / Math.max(1, summary?.total_active_devices || 1);
         const median = counts.length > 0 ? calculateMedian(counts) : 0;
         return { section, total, mean, median };
      });

      return result.sort((a, b) => b.total - a.total);
   }, [rawLogs, summary]);

   const maxClicks = sectionClicksStats.length > 0 ? sectionClicksStats[0].total : 1;

   // Section Time Spent Stats (Total, Mean, Median per Section)
   const sectionTimeStats = useMemo(() => {
      const sectionMap: Record<string, number[]> = {};

      if (summary?.top_time_spent) {
         Object.keys(summary.top_time_spent).forEach((sec) => {
            sectionMap[sec] = [];
         });
      }

      rawLogs.forEach((log) => {
         const times = log.time_spent_per_section || {};
         Object.keys(times).forEach((sec) => {
            if (!sectionMap[sec]) sectionMap[sec] = [];
         });
      });

      rawLogs.forEach((log) => {
         const times = log.time_spent_per_section || {};
         Object.keys(sectionMap).forEach((sec) => {
            sectionMap[sec].push(Number(times[sec]) || 0);
         });
      });

      const result = Object.entries(sectionMap).map(([section, times]) => {
         const total = times.length > 0
            ? times.reduce((a, b) => a + b, 0)
            : Number(summary?.top_time_spent?.[section]) || 0;
         const mean = times.length > 0
            ? calculateMean(times)
            : (Number(summary?.top_time_spent?.[section]) || 0) / Math.max(1, summary?.total_active_devices || 1);
         const median = times.length > 0 ? calculateMedian(times) : 0;
         return { section, total, mean, median };
      });

      return result.sort((a, b) => b.total - a.total);
   }, [rawLogs, summary]);

   const maxTime = sectionTimeStats.length > 0 ? sectionTimeStats[0].total : 1;

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
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Active Devices
                  </span>
                  <Smartphone className="text-indigo-400" size={18} />
               </div>
               <div className="mt-3">
                  <span className="text-2xl font-black tracking-tight text-white font-mono">
                     {to2dp(summary?.total_active_devices ?? rawLogs.length)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-2">
                     Clients
                  </span>
               </div>
            </div>

            {/* Total App Opens */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between space-y-2">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Daily App Opens
                  </span>
                  <BarChart3 className="text-correct" size={18} />
               </div>
               <div className="mt-1 space-y-1">
                  <div className="flex items-baseline justify-between">
                     <span className="text-2xl font-black tracking-tight text-white font-mono">
                        {to2dp(summary?.total_app_opens ?? rawLogs.reduce((a, b) => a + (b.app_opens || 0), 0))}
                     </span>
                     <span className="text-[10px] font-bold text-gray-500">Total Opens</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/5 font-mono">
                     <span className="text-correct font-bold">
                        Mean: {to2dp(appOpensMetrics.mean)}
                     </span>
                     <span className="text-indigo-400 font-bold">
                        Median: {to2dp(appOpensMetrics.median)}
                     </span>
                  </div>
               </div>
            </div>

            {/* Avg & Median Time Spent */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between space-y-2">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Time Spent
                  </span>
                  <Clock className="text-yellow-400" size={18} />
               </div>
               <div className="mt-1 space-y-1">
                  <div className="flex items-baseline justify-between">
                     <span className="text-2xl font-black tracking-tight text-white font-mono">
                        {formatDuration(summary?.total_time_spent_seconds ?? rawLogs.reduce((a, b) => a + (b.time_spent_seconds || 0), 0))}
                     </span>
                     <span className="text-[10px] font-bold text-gray-500">Total</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/5 font-mono">
                     <span className="text-yellow-400 font-bold">
                        Mean: {formatDuration(timeSpentMetrics.mean)}
                     </span>
                     <span className="text-indigo-400 font-bold">
                        Med: {formatDuration(timeSpentMetrics.median)}
                     </span>
                  </div>
               </div>
            </div>

            {/* Bounce Rate */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                     Bounce Rate
                  </span>
                  <ArrowLeftRight className="text-red-400" size={18} />
               </div>
               <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-black tracking-tight text-white font-mono">
                     {to2dp(summary?.bounce_rate_pct ?? (rawLogs.length ? (rawLogs.filter(l => l.is_bounce).length / rawLogs.length) * 100 : 0))}%
                  </span>
                  <span
                     className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border font-mono ${
                        (summary?.bounce_rate_pct || 0) <= 25
                           ? "bg-correct/10 border-correct/20 text-correct"
                           : (summary?.bounce_rate_pct || 0) <= 50
                           ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                           : "bg-red-500/10 border-red-500/20 text-red-400"
                     }`}
                  >
                     {to2dp(summary?.total_bounces ?? rawLogs.filter(l => l.is_bounce).length)} bounces
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
                     Mean & Median Clicks
                  </span>
               </div>

               {sectionClicksStats.length === 0 ? (
                  <div className="py-10 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
                     No section clicks logged for {selectedDate}
                  </div>
               ) : (
                  <div className="space-y-4">
                     {sectionClicksStats.map((item) => {
                        const pct = maxClicks > 0 ? Math.round((item.total / maxClicks) * 100) : 0;
                        return (
                           <div key={item.section} className="space-y-1.5 bg-black/20 p-3.5 rounded-xl border border-white/5">
                              <div className="flex items-center justify-between text-xs font-bold">
                                 <span className="text-gray-200 capitalize flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-correct shrink-0" />
                                    {item.section.replace(/[-_]/g, " ")}
                                 </span>
                                 <span className="text-correct font-mono">
                                    {to2dp(item.total)} total clicks
                                 </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 px-0.5">
                                 <span>Mean: <strong className="text-white">{to2dp(item.mean)}</strong> / user</span>
                                 <span>Median: <strong className="text-indigo-400">{to2dp(item.median)}</strong> / user</span>
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
                     Mean & Median Duration
                  </span>
               </div>

               {sectionTimeStats.length === 0 ? (
                  <div className="py-10 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border border-dashed border-white/5 rounded-xl">
                     No section duration logged for {selectedDate}
                  </div>
               ) : (
                  <div className="space-y-4">
                     {sectionTimeStats.map((item) => {
                        const pct = maxTime > 0 ? Math.round((item.total / maxTime) * 100) : 0;
                        return (
                           <div key={item.section} className="space-y-1.5 bg-black/20 p-3.5 rounded-xl border border-white/5">
                              <div className="flex items-center justify-between text-xs font-bold">
                                 <span className="text-gray-200 capitalize flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                    {item.section.replace(/[-_]/g, " ")}
                                 </span>
                                 <span className="text-indigo-400 font-mono">
                                    {formatDuration(item.total)} ({to2dp(item.total)}s)
                                 </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 px-0.5">
                                 <span>Mean: <strong className="text-white">{formatDuration(item.mean)}</strong> ({to2dp(item.mean)}s)</span>
                                 <span>Median: <strong className="text-indigo-400">{formatDuration(item.median)}</strong> ({to2dp(item.median)}s)</span>
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
                     className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-correct/50 placeholder-gray-600 font-mono"
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
                     <tbody className="divide-y divide-white/5 font-mono">
                        {filteredLogs.map((log) => {
                           const clickSummary = Object.entries(log.clicks_per_section || {})
                              .map(([sec, cnt]) => `${sec}: ${to2dp(Number(cnt))}`)
                              .slice(0, 2)
                              .join(", ");

                           return (
                              <tr key={log.id} className="hover:bg-white/2 transition-colors">
                                 <td className="py-3 px-4 text-[11px] text-gray-400 font-mono">
                                    {log.client_hash.substring(0, 12)}...
                                 </td>
                                 <td className="py-3 px-4 font-bold text-white">
                                    {to2dp(log.app_opens)}
                                 </td>
                                 <td className="py-3 px-4 font-bold text-indigo-400">
                                    {formatDuration(log.time_spent_seconds)}
                                 </td>
                                 <td className="py-3 px-4 text-gray-400 truncate max-w-[200px] text-[11px]">
                                    {clickSummary || "None"}
                                 </td>
                                 <td className="py-3 px-4 font-sans">
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
                                 <td className="py-3 px-4 text-right text-[10px] text-gray-500">
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
