import { supabase } from "./supabaseClient";

export interface ServerTimeResponse {
  raw: Date;
  formatted: string;
}

const SESSION_KEY = "app_synced_date";

export const getServerDate = async (): Promise<ServerTimeResponse> => {
  // 1. Check Session Storage first (Already verified this session)
  const cachedDate = sessionStorage.getItem(SESSION_KEY);
  if (cachedDate) {
    const dateObj = new Date(cachedDate);
    return {
      raw: dateObj,
      formatted: formatDate(dateObj),
    };
  }

  // 2. Immediately assume client is right (Optimistic UI)
  const clientTime = new Date();
  const optimisticResponse: ServerTimeResponse = {
    raw: clientTime,
    formatted: formatDate(clientTime),
  };

  // 3. Trigger background verification
  // We wrap this in a promise that will eventually update our storage
  verifyAndSyncTime().catch((err) => {
    // 4. If verification fails, we throw the error as requested
    console.error("Critical Sync Error:", err);
    throw new Error("Time synchronization failed. Please check your connection.");
  });

  return optimisticResponse;
};

/**
 * Background worker to fetch from Supabase and update SessionStorage
 */
const verifyAndSyncTime = async () => {
  const { data, error } = await supabase.rpc("get_server_time");
  
  if (error || !data) {
    throw error || new Error("No data returned from server");
  }

  const serverTime = new Date(data);
  // Store the ISO string in session storage for the next call
  sessionStorage.setItem(SESSION_KEY, serverTime.toISOString());
  
  return serverTime;
};

/**
 * Helper to ensure consistent Africa/Lagos formatting
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};