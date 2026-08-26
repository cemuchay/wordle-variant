import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Reads other members' last-seen timestamps for one conversation, with live
 * updates. Powers blue read-ticks and "Seen by" info panels.
 *
 * If RLS denies cross-user reads the map simply stays empty — consumers fall
 * back to messages.is_read so ticks still work without seen times.
 */
export function usePeerReceipts(
   groupId: string | null,
   selfId: string | undefined,
   enabled: boolean,
) {
   const [receipts, setReceipts] = useState<Record<string, string>>({});

   useEffect(() => {
      if (!groupId || !selfId || !enabled) return;
      let alive = true;

      supabase
         .from("chat_read_receipts")
         .select("user_id, last_seen_at")
         .eq("group_id", groupId)
         .neq("user_id", selfId)
         .then(({ data }: { data: { user_id: string; last_seen_at: string }[] | null }) => {
            if (!alive || !data) return;
            const map: Record<string, string> = {};
            data.forEach((r) => {
               map[r.user_id] = r.last_seen_at;
            });
            setReceipts(map);
         });

      const channel = supabase
         .channel(`peer_receipts_${groupId}`)
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "chat_read_receipts", filter: `group_id=eq.${groupId}` },
            (payload) => {
               const row = (payload as unknown as { new: { user_id: string; last_seen_at: string } | null }).new;
               if (!row || row.user_id === selfId) return;
               setReceipts((prev) => ({ ...prev, [row.user_id]: row.last_seen_at }));
            },
         )
         .subscribe();

      return () => {
         alive = false;
         supabase.removeChannel(channel);
      };
   }, [groupId, selfId, enabled]);

   return receipts;
}
