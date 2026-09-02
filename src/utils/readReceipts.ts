import { supabase } from "../lib/supabaseClient";
import { useAppStore } from "../store/useAppStore";

/** Reaction-sync rows are signals, not messages — never counted anywhere. */
export const isReactionRow = (content?: string | null): boolean =>
   !!content?.startsWith("[reaction:");

export type TickState = "sending" | "failed" | "sent" | "read";

/**
 * WhatsApp-style tick resolution for own messages:
 *   status wins first (⌛/⚠️), then peer receipts vs created_at (blue),
 *   falling back to the legacy is_read flag when receipt reads are blocked.
 */
export function resolveTickState(
   msg: { user_id?: string; created_at: string; status?: string; is_read?: boolean },
   viewerId: string | undefined,
   peerReceipts?: Record<string, string>,
): TickState {
   if (msg.status === "sending") return "sending";
   if (msg.status === "failed") return "failed";
   if (viewerId && msg.user_id !== viewerId) return "sent";
   if (msg.is_read) return "read";
   if (peerReceipts) {
      const sentAt = new Date(msg.created_at).getTime();
      for (const lastSeen of Object.values(peerReceipts)) {
         if (new Date(lastSeen).getTime() >= sentAt) return "read";
      }
   }
   return "sent";
}

export interface SeenEntry {
   userId: string;
   at: string;
}

/** Peer receipts that cover a given message, earliest reader first. */
export function getSeenBy(msgCreatedAt: string, peerReceipts: Record<string, string>): SeenEntry[] {
   const sentAt = new Date(msgCreatedAt).getTime();
   return Object.entries(peerReceipts)
      .filter(([, at]) => new Date(at).getTime() >= sentAt)
      .map(([userId, at]) => ({ userId, at }))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/**
 * Safely merges incoming read receipts with existing local receipts,
 * ensuring timestamps only move forward monotonically.
 */
export function mergeReadReceipts(
   current: Record<string, string>,
   incoming: Record<string, string>,
): Record<string, string> {
   const merged = { ...current };
   for (const [groupId, incomingTs] of Object.entries(incoming)) {
      if (!incomingTs) continue;
      const currentTs = merged[groupId];
      if (!currentTs || new Date(incomingTs).getTime() > new Date(currentTs).getTime()) {
         merged[groupId] = incomingTs;
      }
   }
   return merged;
}

/**
 * Marks groups as read with a server-anchored timestamp (the newest known
 * non-reaction message per group, or current time) so device-clock skew can never make read
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
      // Never regress below an already-known receipt or current time when messages exist
      const existingTs = new Date(state.readReceipts[groupId] || 0).getTime();
      const anchorMs = Math.max(latestMessageTs, existingTs, Date.now());
      const iso = new Date(anchorMs).toISOString();
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
