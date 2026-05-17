import { supabase } from "./supabaseClient";

/**
 * Metadata object returned by getServerDate.
 */
export interface ServerTimeResponse {
  raw: Date;
  formatted: string;
}

/**
 * Fetches the current authoritative game date.
 * 
 * @why Client-side clocks are unreliable and easily manipulated by users 
 * to play future games. This function prioritizes server time to ensure 
 * everyone is playing the same daily word.
 * 
 * @what Operates in two steps:
 * 1. Returns an immediate "Optimistic" response using the client's current clock.
 * 2. Triggers a background RPC call to Supabase to verify the true date.
 * 
 * @returns {ServerTimeResponse} object containing the raw Date and formatted YYYY-MM-DD string.
 */
export const getServerDate = async (): Promise<ServerTimeResponse> => {

  // 1. Immediately assume client is right (Optimistic UI)
  const clientTime = new Date();
  const optimisticResponse: ServerTimeResponse = {
    raw: clientTime,
    formatted: formatDate(clientTime),
  };

  // 2. Trigger background verification
  // We wrap this in a promise that will eventually update our storage
  verifyAndSyncTime().catch((err) => {
    // 3. If verification fails, we throw the error as requested
    console.error("Critical Sync Error:", err);
    throw new Error("Time synchronization failed. Please check your connection.");
  });

  return optimisticResponse;
};

/**
 * Background worker to fetch from Supabase.
 * Uses a Postgres function 'get_server_time' to bypass client clock spoofing.
 */
const verifyAndSyncTime = async () => {
  const { data, error } = await supabase.rpc("get_server_time");
  
  if (error || !data) {
    throw error || new Error("No data returned from server");
  }

  const serverTime = new Date(data);
  
  return serverTime;
};

/**
 * Helper to ensure consistent Africa/Lagos formatting.
 * 
 * @why The game cycles based on Nigerian time (WAT). Using a fixed locale 
 * ensure that users in New York and Lagos see the same "Daily" word 
 * at the exact same moment.
 * 
 * @param date - Date to format.
 * @returns ISO string fragment (YYYY-MM-DD).
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};
