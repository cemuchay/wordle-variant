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
   Layers,
   TrendingUp,
   TrendingDown,
   Sparkles,
   UserCheck,
   AlertCircle,
   CheckCircle2,
   Zap,
   Bell,
   Trophy,
   Ghost,
   Gamepad2,
   CheckCheck,
   Users
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

interface AnonymizedTelemetrySectionProps {
   triggerToast: (text: string, type?: "success" | "error") => void;
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
   daily_completed?: boolean;
   opens_before_completion?: number;
   opens_after_completion?: number;
   opened_via_notification?: boolean;
   notification_opens_count?: number;
   games_completed?: {
      main_daily?: number;
      wordup?: number;
      challenge?: number;
      marathon?: number;
   };
   is_ghost_suspect?: boolean;
   created_at: string;
}

interface AggregatedPeriodMetrics {
   uniqueDevices: number;
   totalAppOpens: number;
   avgAppOpens: number;
   medianAppOpens: number;
   totalTimeSeconds: number;
   avgTimeSeconds: number;
   medianTimeSeconds: number;
   totalBounces: number;
   bounceRatePct: number;
   sectionClicks: { section: string; total: number; mean: number; median: number }[];
   sectionTimes: { section: string; total: number; mean: number; median: number }[];
   dailyBreakdown: {
      date: string;
      activeDevices: number;
      appOpens: number;
      timeSeconds: number;
      bounces: number;
      bounceRate: number;
   }[];
   // Persona Metrics
   quickCheckinsPct: number; // < 60s
   regularPlayersPct: number; // 60s - 300s
   powerPlayersPct: number; // > 300s
   topSectionByTime: string;
   topSectionByClicks: string;
   // Enhanced Lifecycle & Attribution Breakdown
   completedCohortDevices: number;
   incompleteCohortDevices: number;
   completionRatePct: number;
   totalOpensActivePlay: number; // opens while solving
   totalOpensPostCompletion: number; // returns after having played
   avgOpensActivePlay: number;
   avgOpensPostCompletion: number;
   notificationOpens: number;
   notificationDevices: number;
   notificationConversionPct: number;
   // Cross-mode game completion
   completedAtLeastOneGameDevices: number;
   completedAtLeastOnePct: number;
   gamesCompletedSummary: {
      main_daily: number;
      wordup: number;
      challenge: number;
      marathon: number;
      total: number;
   };
   // Ghost users
   ghostSuspectDevices: number;
   ghostSuspectPct: number;
}

type RangePreset = "7d" | "14d" | "30d" | "single" | "custom";
type CohortFilter = "all" | "completed" | "incomplete";

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
   if (!totalSeconds || isNaN(totalSeconds)) return "0s";
   const totalSecs = Math.round(totalSeconds);
   const hours = Math.floor(totalSecs / 3600);
   const minutes = Math.floor((totalSecs % 3600) / 60);
   const seconds = totalSecs % 60;

   if (hours > 0) {
      if (minutes === 0 && seconds === 0) return `${hours}h`;
      if (seconds === 0) return `${hours}h ${minutes}m`;
      return `${hours}h ${minutes}m ${seconds}s`;
   }
   if (minutes > 0) {
      if (seconds === 0) return `${minutes}m`;
      return `${minutes}m ${seconds}s`;
   }
   return `${seconds}s`;
};

// Compute relative date string offset by days (YYYY-MM-DD)
const getDateOffset = (offsetDaysFromToday: number): string => {
   const d = new Date();
   d.setDate(d.getDate() - offsetDaysFromToday);
   return d.toISOString().split("T")[0];
};

// Calculate days between two ISO date strings inclusive
const getDaysDiff = (startStr: string, endStr: string): number => {
   const start = new Date(startStr);
   const end = new Date(endStr);
   const diffMs = end.getTime() - start.getTime();
   return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
};

// Aggregate raw logs for a period with backward-compatible fallbacks
const aggregateLogs = (logs: RawTelemetryLog[], startDate: string, endDate: string): AggregatedPeriodMetrics => {
   const deviceSet = new Set<string>();
   const completedDevicesSet = new Set<string>();
   const incompleteDevicesSet = new Set<string>();
   const atLeastOneGameSet = new Set<string>();
   const notifDevicesSet = new Set<string>();
   const ghostDevicesSet = new Set<string>();

   const opensArr: number[] = [];
   const timeArr: number[] = [];
   const activePlayOpensArr: number[] = [];
   const postCompletionOpensArr: number[] = [];

   let bouncesCount = 0;
   let totalOpens = 0;
   let totalTime = 0;
   let totalOpensActivePlay = 0;
   let totalOpensPostCompletion = 0;
   let notificationOpens = 0;

   const gamesSummary = {
      main_daily: 0,
      wordup: 0,
      challenge: 0,
      marathon: 0,
      total: 0,
   };

   const clicksMap: Record<string, number[]> = {};
   const timesMap: Record<string, number[]> = {};
   const dailyMap: Record<string, { devices: Set<string>; opens: number; time: number; bounces: number; total: number }> = {};

   // Initialize dates in range to guarantee daily time series continuous points
   const cur = new Date(startDate);
   const stop = new Date(endDate);
   while (cur <= stop) {
      const dStr = cur.toISOString().split("T")[0];
      dailyMap[dStr] = { devices: new Set<string>(), opens: 0, time: 0, bounces: 0, total: 0 };
      cur.setDate(cur.getDate() + 1);
   }

   logs.forEach((log) => {
      deviceSet.add(log.client_hash);
      const opens = Number(log.app_opens) || 0;
      const time = Number(log.time_spent_seconds) || 0;
      opensArr.push(opens);
      timeArr.push(time);
      totalOpens += opens;
      totalTime += time;
      if (log.is_bounce) bouncesCount += 1;

      // Completion Cohort Detection
      const isDailyCompleted = Boolean(log.daily_completed);
      if (isDailyCompleted) {
         completedDevicesSet.add(log.client_hash);
      } else {
         incompleteDevicesSet.add(log.client_hash);
      }

      // Lifecycle Open Splitting (Active Play vs Post-Completion Returns)
      const opensBefore = log.opens_before_completion !== undefined ? Number(log.opens_before_completion) : (isDailyCompleted ? 1 : opens);
      const opensAfter = log.opens_after_completion !== undefined ? Number(log.opens_after_completion) : (isDailyCompleted ? Math.max(0, opens - 1) : 0);
      totalOpensActivePlay += opensBefore;
      totalOpensPostCompletion += opensAfter;
      activePlayOpensArr.push(opensBefore);
      if (isDailyCompleted) {
         postCompletionOpensArr.push(opensAfter);
      }

      // Notification Attribution
      const isNotif = Boolean(log.opened_via_notification);
      const notifOpens = Number(log.notification_opens_count) || (isNotif ? 1 : 0);
      if (isNotif || notifOpens > 0) {
         notifDevicesSet.add(log.client_hash);
         notificationOpens += notifOpens;
      }

      // Cross-Mode Games Completed
      const gc = log.games_completed || {};
      const mainDailyCount = Number(gc.main_daily) || (isDailyCompleted ? 1 : 0);
      const wordupCount = Number(gc.wordup) || 0;
      const challengeCount = Number(gc.challenge) || 0;
      const marathonCount = Number(gc.marathon) || 0;
      const totalGamesForLog = mainDailyCount + wordupCount + challengeCount + marathonCount;

      gamesSummary.main_daily += mainDailyCount;
      gamesSummary.wordup += wordupCount;
      gamesSummary.challenge += challengeCount;
      gamesSummary.marathon += marathonCount;
      gamesSummary.total += totalGamesForLog;

      if (totalGamesForLog > 0) {
         atLeastOneGameSet.add(log.client_hash);
      }

      // Ghost Suspect
      const totalInteractions = Object.values(log.clicks_per_section || {}).reduce((a, b) => a + Number(b), 0);
      const isGhost = log.is_ghost_suspect !== undefined ? Boolean(log.is_ghost_suspect) : (time < 3 && totalInteractions === 0);
      if (isGhost) {
         ghostDevicesSet.add(log.client_hash);
      }

      // Group per section clicks
      const clicks = log.clicks_per_section || {};
      Object.keys(clicks).forEach((sec) => {
         if (!clicksMap[sec]) clicksMap[sec] = [];
      });

      // Group per section times
      const times = log.time_spent_per_section || {};
      Object.keys(times).forEach((sec) => {
         if (!timesMap[sec]) timesMap[sec] = [];
      });

      // Daily bucket
      const day = log.date;
      if (!dailyMap[day]) {
         dailyMap[day] = { devices: new Set<string>(), opens: 0, time: 0, bounces: 0, total: 0 };
      }
      dailyMap[day].devices.add(log.client_hash);
      dailyMap[day].opens += opens;
      dailyMap[day].time += time;
      if (log.is_bounce) dailyMap[day].bounces += 1;
      dailyMap[day].total += 1;
   });

   // Populate all sections
   logs.forEach((log) => {
      const clicks = log.clicks_per_section || {};
      Object.keys(clicksMap).forEach((sec) => {
         clicksMap[sec].push(Number(clicks[sec]) || 0);
      });
      const times = log.time_spent_per_section || {};
      Object.keys(timesMap).forEach((sec) => {
         timesMap[sec].push(Number(times[sec]) || 0);
      });
   });

   const sectionClicks = Object.entries(clicksMap).map(([section, counts]) => ({
      section,
      total: counts.reduce((a, b) => a + b, 0),
      mean: calculateMean(counts),
      median: calculateMedian(counts),
   })).sort((a, b) => b.total - a.total);

   const sectionTimes = Object.entries(timesMap).map(([section, times]) => ({
      section,
      total: times.reduce((a, b) => a + b, 0),
      mean: calculateMean(times),
      median: calculateMedian(times),
   })).sort((a, b) => b.total - a.total);

   const dailyBreakdown = Object.keys(dailyMap)
      .sort()
      .map((dStr) => {
         const item = dailyMap[dStr];
         return {
            date: dStr,
            activeDevices: item.devices.size,
            appOpens: item.opens,
            timeSeconds: item.time,
            bounces: item.bounces,
            bounceRate: item.total > 0 ? (item.bounces / item.total) * 100 : 0,
         };
      });

   // Persona breakdown
   const totalLogs = logs.length || 1;
   const quickCheckins = logs.filter((l) => (l.time_spent_seconds || 0) < 60).length;
   const regularPlayers = logs.filter((l) => (l.time_spent_seconds || 0) >= 60 && (l.time_spent_seconds || 0) <= 300).length;
   const powerPlayers = logs.filter((l) => (l.time_spent_seconds || 0) > 300).length;

   const uniqueDevCount = deviceSet.size || 1;
   const notifConvertedDevs = logs.filter((l) => (l.opened_via_notification || (l.notification_opens_count || 0) > 0) && l.daily_completed).length;

   return {
      uniqueDevices: deviceSet.size,
      totalAppOpens: totalOpens,
      avgAppOpens: calculateMean(opensArr),
      medianAppOpens: calculateMedian(opensArr),
      totalTimeSeconds: totalTime,
      avgTimeSeconds: calculateMean(timeArr),
      medianTimeSeconds: calculateMedian(timeArr),
      totalBounces: bouncesCount,
      bounceRatePct: logs.length > 0 ? (bouncesCount / logs.length) * 100 : 0,
      sectionClicks,
      sectionTimes,
      dailyBreakdown,
      quickCheckinsPct: (quickCheckins / totalLogs) * 100,
      regularPlayersPct: (regularPlayers / totalLogs) * 100,
      powerPlayersPct: (powerPlayers / totalLogs) * 100,
      topSectionByTime: sectionTimes.length > 0 ? sectionTimes[0].section : "None",
      topSectionByClicks: sectionClicks.length > 0 ? sectionClicks[0].section : "None",
      // Lifecycle & Attribution
      completedCohortDevices: completedDevicesSet.size,
      incompleteCohortDevices: incompleteDevicesSet.size,
      completionRatePct: deviceSet.size > 0 ? (completedDevicesSet.size / deviceSet.size) * 100 : 0,
      totalOpensActivePlay,
      totalOpensPostCompletion,
      avgOpensActivePlay: calculateMean(activePlayOpensArr),
      avgOpensPostCompletion: calculateMean(postCompletionOpensArr),
      notificationOpens,
      notificationDevices: notifDevicesSet.size,
      notificationConversionPct: notifDevicesSet.size > 0 ? (notifConvertedDevs / notifDevicesSet.size) * 100 : 0,
      completedAtLeastOneGameDevices: atLeastOneGameSet.size,
      completedAtLeastOnePct: (atLeastOneGameSet.size / uniqueDevCount) * 100,
      gamesCompletedSummary: gamesSummary,
      ghostSuspectDevices: ghostDevicesSet.size,
      ghostSuspectPct: (ghostDevicesSet.size / uniqueDevCount) * 100,
   };
};

export const AnonymizedTelemetrySection: React.FC<AnonymizedTelemetrySectionProps> = ({
   triggerToast,
}) => {
   // Default to 7 days ending 2 days prior (e.g. T-8 to T-2)
   const [preset, setPreset] = useState<RangePreset>("7d");
   const [startDate, setStartDate] = useState<string>(() => getDateOffset(8));
   const [endDate, setEndDate] = useState<string>(() => getDateOffset(2));

   // Period-over-period comparison mode
   const [compareEnabled, setCompareEnabled] = useState<boolean>(true);

   // Cohort Split Filter & Ghost Toggle
   const [cohortFilter, setCohortFilter] = useState<CohortFilter>("all");
   const [excludeGhosts, setExcludeGhosts] = useState<boolean>(false);

   const [loading, setLoading] = useState(false);
   const [primaryLogs, setPrimaryLogs] = useState<RawTelemetryLog[]>([]);
   const [compareLogs, setCompareLogs] = useState<RawTelemetryLog[]>([]);
   const [searchQuery, setSearchQuery] = useState("");
   const [activeChartMetric, setActiveChartMetric] = useState<"devices" | "opens" | "time" | "bounces">("devices");

   // Calculate previous comparison date range matching the duration
   const compareRange = useMemo(() => {
      const days = getDaysDiff(startDate, endDate);
      const curStart = new Date(startDate);
      const compEnd = new Date(curStart);
      compEnd.setDate(compEnd.getDate() - 1);
      const compStart = new Date(compEnd);
      compStart.setDate(compStart.getDate() - (days - 1));

      return {
         start: compStart.toISOString().split("T")[0],
         end: compEnd.toISOString().split("T")[0],
         days,
      };
   }, [startDate, endDate]);

   // Handle preset selection
   const handlePresetSelect = (newPreset: RangePreset) => {
      setPreset(newPreset);
      if (newPreset === "single") {
         const singleD = getDateOffset(2);
         setStartDate(singleD);
         setEndDate(singleD);
      } else if (newPreset === "7d") {
         setStartDate(getDateOffset(8));
         setEndDate(getDateOffset(2));
      } else if (newPreset === "14d") {
         setStartDate(getDateOffset(15));
         setEndDate(getDateOffset(2));
      } else if (newPreset === "30d") {
         setStartDate(getDateOffset(31));
         setEndDate(getDateOffset(2));
      }
   };

   // Fetch Telemetry Data
   const fetchTelemetry = useCallback(
      async (start: string, end: string, compStart: string, compEnd: string, shouldCompare: boolean) => {
         setLoading(true);
         try {
            // 1. Fetch primary logs
            const { data: priData, error: priErr } = await supabase
               .from("daily_telemetry")
               .select("*")
               .gte("date", start)
               .lte("date", end)
               .order("date", { ascending: true });

            if (priErr) throw priErr;
            setPrimaryLogs(priData || []);

            // 2. Fetch comparison logs if comparison is enabled
            if (shouldCompare) {
               const { data: compData, error: compErr } = await supabase
                  .from("daily_telemetry")
                  .select("*")
                  .gte("date", compStart)
                  .lte("date", compEnd)
                  .order("date", { ascending: true });

               if (compErr) throw compErr;
               setCompareLogs(compData || []);
            } else {
               setCompareLogs([]);
            }
         } catch (err: any) {
            triggerToast(err.message || "Failed to load telemetry data", "error");
         } finally {
            setLoading(false);
         }
      },
      [triggerToast]
   );

   useEffect(() => {
      fetchTelemetry(startDate, endDate, compareRange.start, compareRange.end, compareEnabled);
   }, [startDate, endDate, compareRange.start, compareRange.end, compareEnabled, fetchTelemetry]);

   // Filter logs by Cohort and Ghost Setting
   const filterLogsByCohortAndGhosts = useCallback((logs: RawTelemetryLog[]) => {
      return logs.filter((log) => {
         if (excludeGhosts) {
            const totalClicks = Object.values(log.clicks_per_section || {}).reduce((a, b) => a + Number(b), 0);
            const isGhost = log.is_ghost_suspect !== undefined ? log.is_ghost_suspect : (log.time_spent_seconds < 3 && totalClicks === 0);
            if (isGhost) return false;
         }
         if (cohortFilter === "completed") return Boolean(log.daily_completed);
         if (cohortFilter === "incomplete") return !log.daily_completed;
         return true;
      });
   }, [cohortFilter, excludeGhosts]);

   const activePrimaryLogs = useMemo(() => filterLogsByCohortAndGhosts(primaryLogs), [primaryLogs, filterLogsByCohortAndGhosts]);
   const activeCompareLogs = useMemo(() => filterLogsByCohortAndGhosts(compareLogs), [compareLogs, filterLogsByCohortAndGhosts]);

   // Raw Unfiltered Metrics for Cohort Comparison overview
   const baselineMetrics = useMemo(() => aggregateLogs(primaryLogs, startDate, endDate), [primaryLogs, startDate, endDate]);

   // Aggregations
   const primaryMetrics = useMemo(() => aggregateLogs(activePrimaryLogs, startDate, endDate), [activePrimaryLogs, startDate, endDate]);
   const compareMetrics = useMemo(() => aggregateLogs(activeCompareLogs, compareRange.start, compareRange.end), [activeCompareLogs, compareRange]);

   // Delta percentage helper
   const calcDelta = (curr: number, prev: number, invertSentiment = false) => {
      if (!compareEnabled || prev === 0) {
         if (curr > 0 && prev === 0 && compareEnabled) {
            return { pct: "+100%", isPositive: !invertSentiment, raw: 100 };
         }
         return null;
      }
      const change = ((curr - prev) / prev) * 100;
      const isPositive = invertSentiment ? change < 0 : change > 0;
      const sign = change >= 0 ? "+" : "";
      return {
         pct: `${sign}${change.toFixed(1)}%`,
         isPositive,
         raw: change,
      };
   };

   const devicesDelta = useMemo(() => calcDelta(primaryMetrics.uniqueDevices, compareMetrics.uniqueDevices), [primaryMetrics.uniqueDevices, compareMetrics.uniqueDevices, compareEnabled]);

   // Intelligent Summary Insights Generator
   const intelligentInsights = useMemo(() => {
      const insights: { type: "positive" | "warning" | "neutral" | "hotspot"; title: string; desc: string }[] = [];

      // 1. Overall Retention & Volume Assessment
      if (devicesDelta && devicesDelta.raw !== 0) {
         if (devicesDelta.raw > 0) {
            insights.push({
               type: "positive",
               title: "Audience Expansion",
               desc: `Active unique devices grew by ${devicesDelta.pct} compared to the previous period (${primaryMetrics.uniqueDevices} vs ${compareMetrics.uniqueDevices}).`,
            });
         } else {
            insights.push({
               type: "warning",
               title: "Device Contraction",
               desc: `Active unique devices dropped by ${devicesDelta.pct} vs previous period (${primaryMetrics.uniqueDevices} vs ${compareMetrics.uniqueDevices}).`,
            });
         }
      } else if (primaryMetrics.uniqueDevices > 0) {
         insights.push({
            type: "neutral",
            title: "Audience Volume",
            desc: `Logged ${primaryMetrics.uniqueDevices} unique active devices across ${primaryMetrics.dailyBreakdown.length} day(s).`,
         });
      }

      // 2. Daily Completion Lifecycle Insights
      if (baselineMetrics.uniqueDevices > 0) {
         if (baselineMetrics.completionRatePct >= 50) {
            insights.push({
               type: "positive",
               title: "Strong Daily Completion Rate",
               desc: `${baselineMetrics.completionRatePct.toFixed(1)}% of active devices (${baselineMetrics.completedCohortDevices} users) completed the daily game. Users return an average of ${baselineMetrics.avgOpensPostCompletion.toFixed(1)} times after finishing!`,
            });
         } else {
            insights.push({
               type: "warning",
               title: "Daily Drop-off Opportunity",
               desc: `${baselineMetrics.incompleteCohortDevices} devices launched without finishing the daily game (${(100 - baselineMetrics.completionRatePct).toFixed(1)}% incomplete rate). Average active play opens: ${baselineMetrics.avgOpensActivePlay.toFixed(1)}.`,
            });
         }
      }

      // 3. Notification Attribution
      if (baselineMetrics.notificationDevices > 0) {
         insights.push({
            type: "positive",
            title: "Push Notification Impact",
            desc: `Attributed ${baselineMetrics.notificationOpens} opens from ${baselineMetrics.notificationDevices} devices via web push, converting at ${baselineMetrics.notificationConversionPct.toFixed(0)}% into daily completions.`,
         });
      }

      // 4. Ghost User Diagnostic Alert
      if (baselineMetrics.ghostSuspectPct > 15) {
         insights.push({
            type: "warning",
            title: "Ghost Activity Detected",
            desc: `${baselineMetrics.ghostSuspectDevices} devices (${baselineMetrics.ghostSuspectPct.toFixed(1)}% of traffic) exhibited ghost behavior (<3s duration, 0 clicks). Use the "Filter Ghost Traffic" toggle for clean human analytics.`,
         });
      }

      // 5. Engagement & Session Depth
      if (primaryMetrics.medianTimeSeconds > 180) {
         insights.push({
            type: "positive",
            title: "Deep Player Engagement",
            desc: `Median session duration is strong at ${formatDuration(primaryMetrics.medianTimeSeconds)} with ${primaryMetrics.powerPlayersPct.toFixed(0)}% of sessions exceeding 5 minutes.`,
         });
      } else if (primaryMetrics.medianTimeSeconds < 45 && primaryMetrics.totalAppOpens > 0) {
         insights.push({
            type: "warning",
            title: "Short Session Dwell",
            desc: `Median session duration is brief (${formatDuration(primaryMetrics.medianTimeSeconds)}). Players are predominantly making quick check-ins.`,
         });
      }

      return insights;
   }, [primaryMetrics, compareMetrics, devicesDelta, baselineMetrics]);

   // Filter Raw Logs
   const filteredLogs = useMemo(() => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return activePrimaryLogs;
      return activePrimaryLogs.filter(
         (log) =>
            log.client_hash.toLowerCase().includes(q) ||
            log.id.toLowerCase().includes(q) ||
            log.date.includes(q)
      );
   }, [activePrimaryLogs, searchQuery]);

   // Render SVG Daily Trend Visualizer
   const renderTrendChart = () => {
      const data = primaryMetrics.dailyBreakdown;
      const compData = compareMetrics.dailyBreakdown;
      if (data.length === 0) return null;

      const chartHeight = 160;
      const chartWidth = 700;
      const padX = 40;
      const padY = 24;

      const getMetricVal = (item: any, metric: typeof activeChartMetric) => {
         if (!item) return 0;
         if (metric === "devices") return item.activeDevices || 0;
         if (metric === "opens") return item.appOpens || 0;
         if (metric === "time") return Math.round((item.timeSeconds || 0) / 60); // minutes
         if (metric === "bounces") return Number(item.bounceRate || 0);
         return 0;
      };

      const primaryValues = data.map((d) => getMetricVal(d, activeChartMetric));
      const compValues = compData.map((d) => getMetricVal(d, activeChartMetric));
      const maxVal = Math.max(...primaryValues, ...(compareEnabled ? compValues : [0]), 1);

      const usableWidth = chartWidth - padX * 2;
      const usableHeight = chartHeight - padY * 2;
      const stepX = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth / 2;

      // Generate SVG path for primary data
      const primaryPoints = data.map((d, i) => {
         const val = getMetricVal(d, activeChartMetric);
         const x = padX + (data.length === 1 ? usableWidth / 2 : i * stepX);
         const y = chartHeight - padY - (val / maxVal) * usableHeight;
         return { x, y, val, date: d.date };
      });

      const primaryPath = primaryPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");
      const primaryArea = primaryPoints.length > 0
         ? `${primaryPath} L ${primaryPoints[primaryPoints.length - 1].x},${chartHeight - padY} L ${primaryPoints[0].x},${chartHeight - padY} Z`
         : "";

      // Generate SVG path for comparison data
      let compPath = "";
      if (compareEnabled && compData.length > 0) {
         const compStepX = compData.length > 1 ? usableWidth / (compData.length - 1) : usableWidth / 2;
         const compPoints = compData.map((d, i) => {
            const val = getMetricVal(d, activeChartMetric);
            const x = padX + (compData.length === 1 ? usableWidth / 2 : i * compStepX);
            const y = chartHeight - padY - (val / maxVal) * usableHeight;
            return { x, y };
         });
         compPath = compPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");
      }

      return (
         <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 overflow-visible">
               <defs>
                  <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor="#538d4e" stopOpacity="0.35" />
                     <stop offset="100%" stopColor="#538d4e" stopOpacity="0.0" />
                  </linearGradient>
               </defs>

               {/* Y-axis Guideline Grid */}
               {[0, 0.5, 1].map((pct, idx) => {
                  const y = chartHeight - padY - pct * usableHeight;
                  const labelVal = Math.round(pct * maxVal);
                  return (
                     <g key={idx}>
                        <line x1={padX} y1={y} x2={chartWidth - padX} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
                        <text x={padX - 8} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="monospace" fontWeight="bold">
                           {activeChartMetric === "time" ? `${labelVal}m` : activeChartMetric === "bounces" ? `${labelVal}%` : labelVal}
                        </text>
                     </g>
                  );
               })}

               {/* Comparison Area / Line (Dashed Indigo) */}
               {compareEnabled && compPath && (
                  <path d={compPath} fill="none" stroke="#818cf8" strokeWidth="2" strokeDasharray="4,4" opacity="0.8" />
               )}

               {/* Primary Area Fill & Smooth Line (Green) */}
               {primaryArea && <path d={primaryArea} fill="url(#primaryAreaGrad)" />}
               {primaryPath && <path d={primaryPath} fill="none" stroke="#538d4e" strokeWidth="3" strokeLinecap="round" />}

               {/* Primary Data Points with Interactive Value Tooltips */}
               {primaryPoints.map((p, i) => (
                  <g key={i} className="group cursor-pointer">
                     <circle cx={p.x} cy={p.y} r="4" fill="#538d4e" stroke="#ffffff" strokeWidth="1.5" />
                     {/* X-axis date label */}
                     <text
                        x={p.x}
                        y={chartHeight - 6}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.8)"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                     >
                        {p.date.slice(5)}
                     </text>
                     {/* Value tooltip */}
                     <title>{`${p.date}: ${p.val} ${activeChartMetric === "time" ? "mins" : activeChartMetric === "bounces" ? "%" : ""}`}</title>
                  </g>
               ))}
            </svg>
         </div>
      );
   };

   return (
      <div className="space-y-6 text-white">
         {/* Top Header & Range/Comparison Controls */}
         <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
            <div className="space-y-1.5">
               <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
                     <Activity className="text-correct" size={24} /> Anonymized Telemetry & Analytics
                  </h3>
                  <span className="bg-correct/10 text-correct text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-correct/20">
                     v2.5 Intelligence
                  </span>
               </div>
               <p className="text-sm text-gray-300 font-bold uppercase tracking-wider">
                  Lifecycle cohorts, push attribution, multi-game completion funnel & ghost detection
               </p>
            </div>

            {/* Range Preset Pills & Comparison Switch */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
               {/* Preset Pills */}
               <div className="flex items-center bg-black/40 p-1.5 rounded-xl border border-white/10 text-sm font-black uppercase">
                  {(["7d", "14d", "30d", "single", "custom"] as RangePreset[]).map((p) => {
                     const labels: Record<RangePreset, string> = {
                        "7d": "7 Days",
                        "14d": "14 Days",
                        "30d": "30 Days",
                        single: "Single Day",
                        custom: "Custom",
                     };
                     return (
                        <button
                           key={p}
                           onClick={() => handlePresetSelect(p)}
                           className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                              preset === p
                                 ? "bg-correct text-black font-black shadow"
                                 : "text-gray-300 hover:text-white"
                           }`}
                        >
                           {labels[p]}
                        </button>
                     );
                  })}
               </div>

               {/* Date Inputs */}
               <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2">
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <input
                     type="date"
                     value={startDate}
                     onChange={(e) => {
                        setStartDate(e.target.value);
                        setPreset("custom");
                     }}
                     className="bg-transparent text-sm text-white focus:outline-none font-mono font-bold w-32"
                  />
                  <span className="text-gray-400 text-sm font-bold">to</span>
                  <input
                     type="date"
                     value={endDate}
                     onChange={(e) => {
                        setEndDate(e.target.value);
                        setPreset("custom");
                     }}
                     className="bg-transparent text-sm text-white focus:outline-none font-mono font-bold w-32"
                  />
               </div>

               {/* Comparison Toggle Button */}
               <button
                  onClick={() => setCompareEnabled(!compareEnabled)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all border cursor-pointer ${
                     compareEnabled
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-sm"
                        : "bg-white/5 border-white/10 text-gray-300 hover:text-white"
                  }`}
                  title="Compare to preceding period of equal duration"
               >
                  <ArrowLeftRight size={15} />
                  <span>Compare</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${compareEnabled ? "bg-indigo-400 animate-pulse" : "bg-gray-500"}`} />
               </button>

               {/* Refresh Button */}
               <button
                  onClick={() => fetchTelemetry(startDate, endDate, compareRange.start, compareRange.end, compareEnabled)}
                  disabled={loading}
                  className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Telemetry"
               >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
               </button>
            </div>
         </div>

         {/* Cohort Segmentation & Ghost Diagnostic Filter Bar */}
         <div className="bg-gray-900/90 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Cohort Tabs */}
            <div className="flex flex-wrap items-center gap-2">
               <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-400" /> Player Cohort:
               </span>
               <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10 text-xs font-black uppercase font-mono">
                  <button
                     onClick={() => setCohortFilter("all")}
                     className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        cohortFilter === "all" ? "bg-white text-black font-black" : "text-gray-400 hover:text-white"
                     }`}
                  >
                     All Users ({baselineMetrics.uniqueDevices})
                  </button>
                  <button
                     onClick={() => setCohortFilter("completed")}
                     className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        cohortFilter === "completed" ? "bg-correct text-black font-black" : "text-gray-400 hover:text-white"
                     }`}
                  >
                     <CheckCheck size={13} /> Completed Daily ({baselineMetrics.completedCohortDevices})
                  </button>
                  <button
                     onClick={() => setCohortFilter("incomplete")}
                     className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        cohortFilter === "incomplete" ? "bg-yellow-400 text-black font-black" : "text-gray-400 hover:text-white"
                     }`}
                  >
                     <Clock size={13} /> Incomplete / Playing ({baselineMetrics.incompleteCohortDevices})
                  </button>
               </div>
            </div>

            {/* Ghost Activity Filter Toggle */}
            <div className="flex items-center gap-3">
               <button
                  onClick={() => setExcludeGhosts(!excludeGhosts)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                     excludeGhosts
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                        : "bg-black/40 border-white/10 text-gray-400 hover:text-gray-200"
                  }`}
                  title="Filter out suspected bots and instant <3s bounces with 0 interactions"
               >
                  <Ghost size={14} className={excludeGhosts ? "text-purple-400" : "text-gray-500"} />
                  <span>Filter Ghost Traffic</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300">
                     {baselineMetrics.ghostSuspectDevices} ghosts ({baselineMetrics.ghostSuspectPct.toFixed(0)}%)
                  </span>
               </button>
            </div>
         </div>

         {/* Period Range Context Banner */}
         {compareEnabled && (
            <div className="flex flex-wrap items-center justify-between text-sm bg-black/35 border border-white/10 px-5 py-3 rounded-xl font-mono text-gray-200">
               <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-correct" />
                  <span>Active Period: <strong className="text-white font-bold">{startDate}</strong> to <strong className="text-white font-bold">{endDate}</strong> ({getDaysDiff(startDate, endDate)} days)</span>
               </div>
               <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span>Comparing With: <strong className="text-indigo-200 font-bold">{compareRange.start}</strong> to <strong className="text-indigo-200 font-bold">{compareRange.end}</strong></span>
               </div>
            </div>
         )}

         {/* Intelligent Summary / AI Diagnostic Banner */}
         <div className="bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
               <h4 className="text-sm font-black uppercase tracking-widest text-indigo-300 flex items-center gap-2.5">
                  <Sparkles size={18} className="text-yellow-400" /> Automated Telemetry Insights & Diagnostics
               </h4>
               <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">
                  Heuristic Analysis Engine
               </span>
            </div>

            {intelligentInsights.length === 0 ? (
               <p className="text-sm text-gray-300 italic">Insufficient telemetry events in selected period to compute insights.</p>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {intelligentInsights.map((ins, idx) => (
                     <div
                        key={idx}
                        className={`flex items-start gap-3.5 p-4 rounded-xl border text-sm ${
                           ins.type === "positive"
                              ? "bg-correct/10 border-correct/30 text-white"
                              : ins.type === "warning"
                              ? "bg-yellow-400/10 border-yellow-400/30 text-white"
                              : ins.type === "hotspot"
                              ? "bg-indigo-500/10 border-indigo-500/30 text-white"
                              : "bg-white/5 border-white/15 text-white"
                        }`}
                     >
                        {ins.type === "positive" && <CheckCircle2 size={18} className="text-correct shrink-0 mt-0.5" />}
                        {ins.type === "warning" && <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />}
                        {ins.type === "hotspot" && <Zap size={18} className="text-indigo-400 shrink-0 mt-0.5" />}
                        {ins.type === "neutral" && <Activity size={18} className="text-gray-300 shrink-0 mt-0.5" />}
                        <div className="space-y-1">
                           <strong className="font-black text-white block text-sm capitalize tracking-wide">{ins.title}</strong>
                           <span className="text-xs text-gray-200 leading-relaxed block">{ins.desc}</span>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>

         {/* 4 Enhanced Lifecycle Intelligence KPI Cards */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Daily Puzzle Completion Split */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-300">
                     Daily Completion Cohort
                  </span>
                  <CheckCheck className="text-correct" size={20} />
               </div>
               <div>
                  <div className="flex items-baseline justify-between">
                     <span className="text-4xl font-black tracking-tight text-white font-mono">
                        {baselineMetrics.completionRatePct.toFixed(1)}%
                     </span>
                     <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-correct/20 text-correct border border-correct/30">
                        {baselineMetrics.completedCohortDevices} completed
                     </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-white/10 font-mono text-gray-300 mt-2">
                     <span>Incomplete: <strong className="text-yellow-400">{baselineMetrics.incompleteCohortDevices}</strong> devs</span>
                     <span>Total: <strong className="text-white">{baselineMetrics.uniqueDevices}</strong> devs</span>
                  </div>
               </div>
            </div>

            {/* 2. Active Play Opens vs Post-Completion Returns */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-300">
                     Opens & Returns Split
                  </span>
                  <BarChart3 className="text-indigo-400" size={20} />
               </div>
               <div>
                  <div className="flex items-baseline justify-between">
                     <span className="text-3xl font-black tracking-tight text-white font-mono">
                        {primaryMetrics.totalOpensActivePlay} <span className="text-sm text-gray-400 font-normal">play</span> / {primaryMetrics.totalOpensPostCompletion} <span className="text-sm text-indigo-400 font-normal">ret</span>
                     </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-white/10 font-mono text-gray-300 mt-2">
                     <span>Avg In-Play: <strong className="text-white">{to2dp(primaryMetrics.avgOpensActivePlay)}</strong></span>
                     <span>Avg Post-Play: <strong className="text-indigo-300">{to2dp(primaryMetrics.avgOpensPostCompletion)}</strong></span>
                  </div>
               </div>
            </div>

            {/* 3. Notification Attribution */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-300">
                     Push Notification Impact
                  </span>
                  <Bell className="text-yellow-400" size={20} />
               </div>
               <div>
                  <div className="flex items-baseline justify-between">
                     <span className="text-4xl font-black tracking-tight text-white font-mono">
                        {baselineMetrics.notificationOpens}
                     </span>
                     <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                        {baselineMetrics.notificationDevices} devices
                     </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-white/10 font-mono text-gray-300 mt-2">
                     <span>Conv. to Game: <strong className="text-correct">{baselineMetrics.notificationConversionPct.toFixed(0)}%</strong></span>
                     <span>Organic: <strong className="text-white">{Math.max(0, baselineMetrics.totalAppOpens - baselineMetrics.notificationOpens)}</strong></span>
                  </div>
               </div>
            </div>

            {/* 4. Cross-Mode Multi-Game Completion */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between space-y-3">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-300">
                     Completed &ge;1 Game
                  </span>
                  <Trophy className="text-correct" size={20} />
               </div>
               <div>
                  <div className="flex items-baseline justify-between">
                     <span className="text-4xl font-black tracking-tight text-white font-mono">
                        {baselineMetrics.completedAtLeastOneGameDevices} <span className="text-lg text-gray-400 font-normal">devs</span>
                     </span>
                     <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-correct/20 text-correct border border-correct/30">
                        {baselineMetrics.completedAtLeastOnePct.toFixed(0)}%
                     </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-white/10 font-mono text-gray-300 mt-2">
                     <span>Total Games: <strong className="text-white">{baselineMetrics.gamesCompletedSummary.total}</strong></span>
                     <span>WordUp: <strong className="text-indigo-300">{baselineMetrics.gamesCompletedSummary.wordup}</strong></span>
                  </div>
               </div>
            </div>
         </div>

         {/* Cross-Mode Completion Breakdown Funnel */}
         <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
               <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Gamepad2 className="text-indigo-400" size={18} /> Cross-Mode Game Completion Volume
               </h4>
               <span className="text-xs text-gray-300 font-bold uppercase tracking-wider font-mono">
                  {baselineMetrics.completedAtLeastOneGameDevices} / {baselineMetrics.uniqueDevices} Active Devices Finished &ge;1 Game
               </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
               <div className="bg-black/30 border border-white/10 p-4 rounded-xl space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-400">Main Daily Wordle</span>
                  <div className="text-2xl font-black text-correct font-mono">{baselineMetrics.gamesCompletedSummary.main_daily}</div>
                  <span className="text-[11px] text-gray-400 block">puzzles finished</span>
               </div>
               <div className="bg-black/30 border border-white/10 p-4 rounded-xl space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-400">WordUp / WordGrid</span>
                  <div className="text-2xl font-black text-indigo-400 font-mono">{baselineMetrics.gamesCompletedSummary.wordup}</div>
                  <span className="text-[11px] text-gray-400 block">trivia rounds played</span>
               </div>
               <div className="bg-black/30 border border-white/10 p-4 rounded-xl space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-400">1v1 Challenges</span>
                  <div className="text-2xl font-black text-yellow-400 font-mono">{baselineMetrics.gamesCompletedSummary.challenge}</div>
                  <span className="text-[11px] text-gray-400 block">matches settled</span>
               </div>
               <div className="bg-black/30 border border-white/10 p-4 rounded-xl space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-400">Bot Marathon</span>
                  <div className="text-2xl font-black text-red-400 font-mono">{baselineMetrics.gamesCompletedSummary.marathon}</div>
                  <span className="text-[11px] text-gray-400 block">runs recorded</span>
               </div>
            </div>
         </div>

         {/* SVG Trendlines & Average User Persona Card */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG Visualizer (2 Cols) */}
            <div className="lg:col-span-2 bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                     <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <TrendingUp className="text-correct" size={18} /> Daily Activity Progression
                     </h4>
                     <p className="text-xs text-gray-300 font-bold uppercase tracking-wider mt-1">
                        Interactive daily trend with period-over-period comparison curve
                     </p>
                  </div>

                  {/* Metric Switcher */}
                  <div className="flex items-center bg-black/40 p-1.5 rounded-xl border border-white/10 text-xs font-mono font-bold uppercase">
                     {(["devices", "opens", "time", "bounces"] as const).map((m) => (
                        <button
                           key={m}
                           onClick={() => setActiveChartMetric(m)}
                           className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                              activeChartMetric === m
                                 ? "bg-correct text-black font-black"
                                 : "text-gray-300 hover:text-white"
                           }`}
                        >
                           {m === "devices" ? "Devices" : m === "opens" ? "Opens" : m === "time" ? "Duration" : "Bounce %"}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Chart Rendering */}
               {renderTrendChart()}

               {/* Chart Legend */}
               <div className="flex items-center justify-end gap-6 text-xs font-mono text-gray-200 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                     <span className="w-3.5 h-1.5 bg-correct rounded-full" />
                     <span>Active Period ({startDate} - {endDate})</span>
                  </div>
                  {compareEnabled && (
                     <div className="flex items-center gap-2">
                        <span className="w-3.5 h-1.5 border-b-2 border-indigo-400 border-dashed" />
                        <span>Comparison Period ({compareRange.start} - {compareRange.end})</span>
                     </div>
                  )}
               </div>
            </div>

            {/* "Who the Average User Is" Persona Profile Card (1 Col) */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5">
               <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <UserCheck className="text-yellow-400" size={18} /> Average User Persona
                     </h4>
                     <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                        Archetype
                     </span>
                  </div>

                  <p className="text-xs text-gray-200 mt-3.5 leading-relaxed font-medium">
                     Synthesized behavioral profile of a typical player during this period:
                  </p>

                  <div className="mt-4 space-y-3 font-mono text-sm">
                     <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-gray-300">Daily Frequency:</span>
                        <strong className="text-white font-bold">{to2dp(primaryMetrics.medianAppOpens)} opens / day</strong>
                     </div>

                     <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-gray-300">Typical Session:</span>
                        <strong className="text-indigo-300 font-bold">{formatDuration(primaryMetrics.medianTimeSeconds)} dwell</strong>
                     </div>

                     <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-gray-300">Top Destination:</span>
                        <strong className="text-correct capitalize truncate max-w-[140px] font-bold">
                           {primaryMetrics.topSectionByTime.replace(/[-_]/g, " ")}
                        </strong>
                     </div>
                  </div>
               </div>

               {/* Player Engagement Cohorts */}
               <div className="space-y-2.5 pt-3.5 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs uppercase font-bold text-gray-300">
                     <span>Player Cohort Breakdown</span>
                  </div>

                  {/* Multi-segment distribution bar */}
                  <div className="w-full bg-black/40 h-3.5 rounded-full flex overflow-hidden border border-white/15">
                     <div
                        style={{ width: `${primaryMetrics.quickCheckinsPct}%` }}
                        className="bg-yellow-400 h-full"
                        title={`Quick Check-ins (<1m): ${primaryMetrics.quickCheckinsPct.toFixed(1)}%`}
                     />
                     <div
                        style={{ width: `${primaryMetrics.regularPlayersPct}%` }}
                        className="bg-correct h-full"
                        title={`Regular Players (1-5m): ${primaryMetrics.regularPlayersPct.toFixed(1)}%`}
                     />
                     <div
                        style={{ width: `${primaryMetrics.powerPlayersPct}%` }}
                        className="bg-indigo-500 h-full"
                        title={`Power Players (>5m): ${primaryMetrics.powerPlayersPct.toFixed(1)}%`}
                     />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-gray-200 pt-1">
                     <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        &lt;1m ({primaryMetrics.quickCheckinsPct.toFixed(0)}%)
                     </span>
                     <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-correct" />
                        1-5m ({primaryMetrics.regularPlayersPct.toFixed(0)}%)
                     </span>
                     <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        &gt;5m ({primaryMetrics.powerPlayersPct.toFixed(0)}%)
                     </span>
                  </div>
               </div>
            </div>
         </div>

         {/* Most Clicked & Most Time Spent Section Rankings */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Clicked Sections */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-4">
               <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                  <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                     <MousePointerClick className="text-correct" size={18} /> Most Clicked Sections & Modals
                  </h4>
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                     Mean & Median Clicks
                  </span>
               </div>

               {primaryMetrics.sectionClicks.length === 0 ? (
                  <div className="py-12 text-center text-sm font-bold text-gray-300 uppercase tracking-wider border border-dashed border-white/10 rounded-xl">
                     No section clicks logged for {startDate} to {endDate}
                  </div>
               ) : (
                  <div className="space-y-4">
                     {primaryMetrics.sectionClicks.map((item) => {
                        const pct = maxClicks > 0 ? Math.round((item.total / maxClicks) * 100) : 0;
                        return (
                           <div key={item.section} className="space-y-2 bg-black/30 p-4 rounded-xl border border-white/10">
                              <div className="flex items-center justify-between text-sm font-bold">
                                 <span className="text-white capitalize flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-correct shrink-0" />
                                    {item.section.replace(/[-_]/g, " ")}
                                 </span>
                                 <span className="text-correct font-mono font-black">
                                    {item.total} total clicks
                                 </span>
                              </div>

                              <div className="flex items-center justify-between text-xs font-mono text-gray-300 px-0.5">
                                 <span>Mean: <strong className="text-white">{to2dp(item.mean)}</strong> / log</span>
                                 <span>Median: <strong className="text-indigo-300">{to2dp(item.median)}</strong> / log</span>
                              </div>

                              <div className="w-full bg-black/50 h-2.5 rounded-full overflow-hidden border border-white/10">
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
               <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                  <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                     <Clock className="text-indigo-400" size={18} /> Most Time Spent per Section
                  </h4>
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                     Mean & Median Duration
                  </span>
               </div>

               {primaryMetrics.sectionTimes.length === 0 ? (
                  <div className="py-12 text-center text-sm font-bold text-gray-300 uppercase tracking-wider border border-dashed border-white/10 rounded-xl">
                     No section duration logged for {startDate} to {endDate}
                  </div>
               ) : (
                  <div className="space-y-4">
                     {primaryMetrics.sectionTimes.map((item) => {
                        const pct = maxTime > 0 ? Math.round((item.total / maxTime) * 100) : 0;
                        return (
                           <div key={item.section} className="space-y-2 bg-black/30 p-4 rounded-xl border border-white/10">
                              <div className="flex items-center justify-between text-sm font-bold">
                                 <span className="text-white capitalize flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                                    {item.section.replace(/[-_]/g, " ")}
                                 </span>
                                 <span className="text-indigo-300 font-mono font-black">
                                    {formatDuration(item.total)}
                                 </span>
                              </div>

                              <div className="flex items-center justify-between text-xs font-mono text-gray-300 px-0.5">
                                 <span>Mean: <strong className="text-white">{formatDuration(item.mean)}</strong></span>
                                 <span>Median: <strong className="text-indigo-300">{formatDuration(item.median)}</strong></span>
                              </div>

                              <div className="w-full bg-black/50 h-2.5 rounded-full overflow-hidden border border-white/10">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
               <div>
                  <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                     <Layers className="text-yellow-400" size={18} /> Raw Anonymous Client Logs ({filteredLogs.length})
                  </h4>
                  <p className="text-xs text-gray-300 font-bold uppercase tracking-wider mt-1">
                     Individual anonymized payloads submitted between {startDate} and {endDate}
                  </p>
               </div>

               <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                     type="text"
                     placeholder="Search client hash or date..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white focus:outline-none focus:border-correct/50 placeholder-gray-500 font-mono"
                  />
               </div>
            </div>

            {loading ? (
               <div className="py-14 text-center text-sm font-bold text-gray-300 uppercase tracking-widest flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-correct" />
                  Loading telemetry logs...
               </div>
            ) : filteredLogs.length === 0 ? (
               <div className="py-14 border border-dashed border-white/10 rounded-xl text-center text-sm font-bold text-gray-300 uppercase tracking-widest">
                  No telemetry logs found for {startDate} to {endDate}
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-200">
                     <thead className="bg-black/40 text-xs uppercase tracking-wider text-white border-b border-white/10">
                        <tr>
                           <th className="py-3.5 px-4 font-black">Date</th>
                           <th className="py-3.5 px-4 font-black">Client Hash</th>
                           <th className="py-3.5 px-4 font-black">App Opens</th>
                           <th className="py-3.5 px-4 font-black">Daily Status</th>
                           <th className="py-3.5 px-4 font-black">Time Spent</th>
                           <th className="py-3.5 px-4 font-black">Source</th>
                           <th className="py-3.5 px-4 font-black">Bounce?</th>
                           <th className="py-3.5 px-4 text-right font-black">Submitted At</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5 font-mono">
                        {filteredLogs.slice(0, 100).map((log) => {
                           const isDailyDone = Boolean(log.daily_completed);
                           const isNotif = Boolean(log.opened_via_notification || (log.notification_opens_count || 0) > 0);
                           const isGhost = Boolean(log.is_ghost_suspect);

                           return (
                              <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                 <td className="py-3.5 px-4 text-white text-xs font-bold">
                                    {log.date}
                                 </td>
                                 <td className="py-3.5 px-4 text-xs text-gray-200 font-mono">
                                    <div className="flex items-center gap-1.5">
                                       <span>{log.client_hash.substring(0, 10)}...</span>
                                       {isGhost && (
                                          <span className="text-[10px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                                             <Ghost size={11} /> Ghost
                                          </span>
                                       )}
                                    </div>
                                 </td>
                                 <td className="py-3.5 px-4 font-black text-white text-sm">
                                    {log.app_opens}
                                    {log.opens_after_completion ? (
                                       <span className="text-[11px] text-indigo-300 ml-1 font-normal" title="Post-completion returns">
                                          (+{log.opens_after_completion} ret)
                                       </span>
                                    ) : null}
                                 </td>
                                 <td className="py-3.5 px-4 font-sans">
                                    {isDailyDone ? (
                                       <span className="text-xs font-black uppercase tracking-wider text-correct bg-correct/20 px-2 py-0.5 rounded border border-correct/30 flex items-center gap-1 w-max">
                                          <CheckCheck size={12} /> Finished
                                       </span>
                                    ) : (
                                       <span className="text-xs font-black uppercase tracking-wider text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded border border-yellow-400/30 w-max block">
                                          Incomplete
                                       </span>
                                    )}
                                 </td>
                                 <td className="py-3.5 px-4 font-bold text-indigo-300 text-sm">
                                    {formatDuration(log.time_spent_seconds)}
                                 </td>
                                 <td className="py-3.5 px-4 font-sans">
                                    {isNotif ? (
                                       <span className="text-xs font-black text-yellow-300 bg-yellow-400/20 px-2 py-0.5 rounded border border-yellow-400/30 flex items-center gap-1 w-max">
                                          <Bell size={12} /> Push ({log.notification_opens_count || 1})
                                       </span>
                                    ) : (
                                       <span className="text-xs text-gray-400 font-mono">
                                          Direct / App
                                       </span>
                                    )}
                                 </td>
                                 <td className="py-3.5 px-4 font-sans">
                                    {log.is_bounce ? (
                                       <span className="text-xs font-black uppercase tracking-wider text-red-400 bg-red-500/20 px-2.5 py-1 rounded border border-red-500/30">
                                          Yes (Bounce)
                                       </span>
                                    ) : (
                                       <span className="text-xs font-black uppercase tracking-wider text-correct bg-correct/20 px-2.5 py-1 rounded border border-correct/30">
                                          Engaged
                                       </span>
                                    )}
                                 </td>
                                 <td className="py-3.5 px-4 text-right text-xs text-gray-300">
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
                  {filteredLogs.length > 100 && (
                     <div className="p-3.5 text-center text-xs text-gray-300 font-mono border-t border-white/10">
                        Showing first 100 logs out of {filteredLogs.length} total entries.
                     </div>
                  )}
               </div>
            )}
         </div>
      </div>
   );
};

export default AnonymizedTelemetrySection;
