/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export type SignalLevel = 0 | 1 | 2 | 3 | 4;

function rttToLevel(rtt: number): SignalLevel {
   if (rtt < 100) return 4;
   if (rtt < 300) return 3;
   if (rtt < 600) return 2;
   if (rtt < 1000) return 1;
   return 0;
}

export function useSignalStrength(): SignalLevel {
   const [level, setLevel] = useState<SignalLevel>(3);
   const intervalRef = useRef<number | null>(null);

   useEffect(() => {
      const measure = async () => {
         try {
            // Layer 1: navigator.connection (Chromium only)
            const conn = (navigator as any).connection;
            if (conn) {
               if (conn.effectiveType === '4g' || conn.effectiveType === '5g') {
                  setLevel(4);
                  return;
               }
               if (conn.effectiveType === '3g') { setLevel(3); return; }
               if (conn.effectiveType === '2g') { setLevel(2); return; }
               if (conn.effectiveType === 'slow-2g') { setLevel(1); return; }
               // Fall through to RTT measurement if conn.effectiveType is unknown
               if (typeof conn.rtt === 'number' && conn.rtt >= 0) {
                  setLevel(rttToLevel(conn.rtt));
                  return;
               }
            }
         } catch { /* ignore */ }

         // Layer 2: Periodic RTT measurement via Supabase RPC
         try {
            const start = Date.now();
            await supabase.rpc('get_server_time');
            const rtt = Date.now() - start;
            setLevel(rttToLevel(rtt));
         } catch { /* ignore */ }
      };

      measure();
      intervalRef.current = window.setInterval(measure, 30000);

      // Listen for connection changes (Chromium)
      try {
         const conn = (navigator as any).connection;
         if (conn) {
            const onChange = () => measure();
            conn.addEventListener('change', onChange);
            return () => {
               conn.removeEventListener('change', onChange);
               if (intervalRef.current !== null) clearInterval(intervalRef.current);
            };
         }
      } catch { /* ignore */ }

      return () => {
         if (intervalRef.current !== null) clearInterval(intervalRef.current);
      };
   }, []);

   return level;
}
