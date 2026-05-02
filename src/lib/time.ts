import { supabase } from "./supabaseClient";

export interface ServerTimeResponse {
   raw: Date; // Used for calculations/offsets
   formatted: string; // Used for game state (YYYY-MM-DD)
}

export const getServerDate = async (): Promise<ServerTimeResponse> => {
   try {
      const { data, error } = await supabase.rpc("get_server_time");
      if (error) throw error;
      
      const serverTime = new Date(data);

      return {
         raw: serverTime,
         formatted: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Lagos",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
         }).format(serverTime),
      };
   } catch (err) {
      console.error("Failed to fetch server time:", err);
      const fallback = new Date();
      return {
         raw: fallback,
         formatted: fallback.toISOString().split("T")[0],
      };
   }
};
