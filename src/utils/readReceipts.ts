import { supabase } from "../lib/supabaseClient";
import { useAppStore } from "../store/useAppStore";

/** Reaction-sync rows are signals, not messages — never counted anywhere. */
export const isReactionRow = (content?: string | null): boolean =>
   !!content?.startsWith("[reaction:");

/**
 * Marks groups as read with a server-anchored timestamp (the newest known
 * non-reaction message per group) so device-clock skew can never make read
 * messages reappear as unread after a refresh. Optimistic locally, persisted
 * in the background; failed upserts fall back to the persisted
 * pendingReadReceipts queue which is flushed on reconnect/startup.
 */
export function markGroupsRead(userId: string, groupIds: string[]): void {
   if (!userId || groupIds.length === 0) return;

   const state = useAppStore.getState();
   const anchors: Record<string, string> = {};

   for (const groupId of groupIds) {
      let latestMessageTs = 0;
      for (const m of state.globalMessages) {
         if (m.group_id !== groupId || isReactionRow(m.content)) continue;
         const t = new Date(m.created_at).getTime();
         if (t > latestMessageTs) latestMessageTs = t;
      }
      // Never regress below an already-known receipt
      const existingTs = new Date(state.readReceipts[groupId] || 0).getTime();
      const anchorMs = Math.max(latestMessageTs, existingTs);
      const iso = new Date(anchorMs > 0 ? anchorMs : Date.now()).toISOString();
      anchors[groupId] = iso;
      state.updateReadReceipt(groupId, iso);
   }

   for (const groupId of groupIds) {
      supabase
         .from("chat_read_receipts")
         .upsert(
            {
               user_id: userId,
               group_id: groupId,
               last_seen_at: anchors[groupId],
            },
            { onConflict: "user_id,group_id" },
         )
         .then(({ error }) => {
            if (error) {
               useAppStore.getState().updatePendingReadReceipt(groupId, anchors[groupId]);
            } else {
               useAppStore.getState().removePendingReadReceipt(groupId);
            }
         });
   }
}
