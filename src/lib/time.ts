import { supabase } from "./supabaseClient";

export interface ServerTimeResponse {
  raw: Date;
  formatted: string;
}

// Persist drift across sessions to catch persistent cheats
const STORAGE_KEY = "server_time_drift";
let serverDriftMs = parseInt(localStorage.getItem(STORAGE_KEY) || "0");

// Monotonic reference to prevent mid-session clock changes
let syncData = {
  baseServerTime: Date.now() + serverDriftMs,
  basePerfTime: performance.now()
};

/**
 * Gets the current date, adjusted for any detected drift and 
 * immune to system clock changes within a session using performance.now().
 */
export const getServerDate = async (): Promise<ServerTimeResponse> => {
  // Use performance.now() to measure true elapsed time since our base was set
  const elapsedMs = performance.now() - syncData.basePerfTime;
  const adjustedNow = new Date(syncData.baseServerTime + elapsedMs);
  
  const response: ServerTimeResponse = {
    raw: adjustedNow,
    formatted: formatDate(adjustedNow),
  };

  // Trigger background verification to update drift
  verifyAndSyncTime().catch((err) => {
    console.error("Sync verification failed:", err);
  });

  return response;
};

/**
 * Background worker to fetch from Supabase and calculate drift
 */
const verifyAndSyncTime = async () => {
  const start = performance.now();
  const { data, error } = await supabase.rpc("get_server_time");
  const end = performance.now();
  
  if (error || !data) {
    throw error || new Error("No data returned from server");
  }

  // Account for network latency (roughly half the round trip)
  const latency = (end - start) / 2;
  const serverTime = new Date(data).getTime() + latency;
  
  // Update drift and monotonic base
  serverDriftMs = serverTime - Date.now();
  localStorage.setItem(STORAGE_KEY, serverDriftMs.toString());
  
  syncData = {
    baseServerTime: serverTime,
    basePerfTime: performance.now()
  };
  
  return new Date(serverTime);
};

/**
 * Helper to format date based on the user's LOCAL timezone.
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};
