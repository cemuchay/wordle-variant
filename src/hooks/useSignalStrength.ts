/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export type SignalLevel = 0 | 1 | 2 | 3 | 4;

export function rttToLevel(rtt: number): SignalLevel {
   if (rtt < 120) return 4;
   if (rtt < 280) return 3;
   if (rtt < 550) return 2;
   if (rtt < 1000) return 1;
   return 0;
}

export function useSignalStrength(): SignalLevel {
   const [level, setLevel] = useState<SignalLevel>(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
         return 0;
      }
      return 3;
   });
   const intervalRef = useRef<number | null>(null);

   useEffect(() => {
      const measure = async () => {
         // Immediate offline guard
         if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setLevel(0);
            return;
         }

         try {
            // Layer 1: navigator.connection (Chromium / Android)
            const conn = (navigator as any).connection;
            if (conn) {
               if (conn.effectiveType === '4g' || conn.effectiveType === '5g') {
                  setLevel(4);
                  return;
               }
               if (conn.effectiveType === '3g') { setLevel(3); return; }
               if (conn.effectiveType === '2g') { setLevel(2); return; }
               if (conn.effectiveType === 'slow-2g') { setLevel(1); return; }
               if (typeof conn.rtt === 'number' && conn.rtt >= 0) {
                  setLevel(rttToLevel(conn.rtt));
                  return;
               }
            }
         } catch { /* ignore */ }

         // Layer 2: Periodic RTT measurement via Supabase RPC (when page is visible)
         if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
         }

         try {
            const start = Date.now();
            const { error } = await supabase.rpc('get_server_time');
            if (error) {
               setLevel(1);
               return;
            }
            const rtt = Date.now() - start;
            setLevel(rttToLevel(rtt));
         } catch {
            // Network failure during RPC ping
            setLevel(0);
         }
      };

      measure();
      intervalRef.current = window.setInterval(measure, 30000);

      const handleOnline = () => {
         measure();
      };
      const handleOffline = () => {
         setLevel(0);
      };
      const handleVisibility = () => {
         if (document.visibilityState === 'visible') {
            measure();
         }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('visibilitychange', handleVisibility);

      // Listen for connection changes (Chromium)
      let conn: any = null;
      try {
         conn = (navigator as any).connection;
         if (conn) {
            conn.addEventListener('change', handleOnline);
         }
      } catch { /* ignore */ }

      return () => {
         if (intervalRef.current !== null) clearInterval(intervalRef.current);
         window.removeEventListener('online', handleOnline);
         window.removeEventListener('offline', handleOffline);
         document.removeEventListener('visibilitychange', handleVisibility);
         if (conn) {
            try {
               conn.removeEventListener('change', handleOnline);
            } catch { /* ignore */ }
         }
      };
   }, []);

   return level;
}
