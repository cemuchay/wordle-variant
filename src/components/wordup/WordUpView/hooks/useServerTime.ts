import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";

export const useServerTime = () => {
   const clockOffset = useRef(0);

   useEffect(() => {
      const getOffset = async () => {
         const start = Date.now();
         const { data } = await supabase.rpc("get_server_time");
         const end = Date.now();
         if (data) {
            const serverTime = new Date(data).getTime();
            const rtt = end - start;
            clockOffset.current = (serverTime - rtt / 2) - start;
         }
      };
      getOffset();
   }, []);

   const getSyncedNow = useCallback(() => Date.now() + clockOffset.current, []);

   return { getSyncedNow };
};
