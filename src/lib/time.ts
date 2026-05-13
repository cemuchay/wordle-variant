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

// Global sync status
let hasSyncedAtLeastOnce = false;

/**
 * Gets the current date, adjusted for any detected drift and 
 * immune to system clock changes within a session using performance.now().
 * 
 * @param forceSync If true, waits for a fresh server check before returning
 */
export const getServerDate = async (forceSync: boolean = false): Promise<ServerTimeResponse> => {
  // 1. If we haven't synced yet or forceSync is requested, wait for it
  if (forceSync || !hasSyncedAtLeastOnce) {
    try {
      await verifyAndSyncTime();
    } catch (err) {
      console.warn("Sync failed, falling back to local/cached drift:", err);
    }
  }

  // Use performance.now() to measure true elapsed time since our base was set
  const elapsedMs = performance.now() - syncData.basePerfTime;
  const adjustedNow = new Date(syncData.baseServerTime + elapsedMs);

  const response: ServerTimeResponse = {
    raw: adjustedNow,
    formatted: formatDate(adjustedNow),
  };

  // Trigger background verification if not already forced
  if (!forceSync) {
    verifyAndSyncTime().catch((err) => {
      console.error("Background sync verification failed:", err);
    });
  }

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

  hasSyncedAtLeastOnce = true;
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