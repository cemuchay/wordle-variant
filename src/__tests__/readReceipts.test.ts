import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   mergeReadReceipts,
   markGroupsRead,
   resolveTickState,
   getSeenBy,
   isReactionRow,
} from "../utils/readReceipts";
import { useAppStore } from "../store/useAppStore";

// Mock supabase client
vi.mock("../lib/supabaseClient", () => {
   const upsertMock = vi.fn().mockResolvedValue({ error: null });
   return {
      supabase: {
         from: vi.fn(() => ({
            upsert: upsertMock,
         })),
      },
   };
});

describe("readReceipts utils", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      useAppStore.setState({
         readReceipts: {},
         pendingReadReceipts: {},
         globalMessages: [],
      });
   });

   describe("mergeReadReceipts", () => {
      it("merges incoming receipts into empty current receipts", () => {
         const current = {};
         const incoming = {
            "group-1": "2026-09-01T12:00:00.000Z",
            "group-2": "2026-09-01T13:00:00.000Z",
         };
         const result = mergeReadReceipts(current, incoming);
         expect(result).toEqual(incoming);
      });

      it("only advances timestamps forward and never regresses", () => {
         const current = {
            "group-1": "2026-09-01T15:00:00.000Z",
            "group-2": "2026-09-01T10:00:00.000Z",
         };
         const incoming = {
            "group-1": "2026-09-01T12:00:00.000Z", // Older timestamp from server
            "group-2": "2026-09-01T14:00:00.000Z", // Newer timestamp from server
            "group-3": "2026-09-01T08:00:00.000Z", // New group
         };
         const result = mergeReadReceipts(current, incoming);
         expect(result["group-1"]).toBe("2026-09-01T15:00:00.000Z"); // Retained local newer
         expect(result["group-2"]).toBe("2026-09-01T14:00:00.000Z"); // Updated to incoming newer
         expect(result["group-3"]).toBe("2026-09-01T08:00:00.000Z"); // Added
      });

      it("handles null or undefined incoming values gracefully", () => {
         const current = { "group-1": "2026-09-01T15:00:00.000Z" };
         const incoming = { "group-1": "", "group-2": undefined as any };
         const result = mergeReadReceipts(current, incoming);
         expect(result["group-1"]).toBe("2026-09-01T15:00:00.000Z");
      });
   });

   describe("isReactionRow", () => {
      it("identifies reaction signal rows", () => {
         expect(isReactionRow("[reaction:❤️]")).toBe(true);
         expect(isReactionRow("[reaction:None]")).toBe(true);
         expect(isReactionRow("Hello world")).toBe(false);
         expect(isReactionRow(null)).toBe(false);
         expect(isReactionRow(undefined)).toBe(false);
      });
   });

   describe("resolveTickState", () => {
      const viewerId = "user-me";

      it("returns sending or failed when status indicates in-flight", () => {
         expect(resolveTickState({ user_id: viewerId, created_at: "2026-09-01T12:00:00.000Z", status: "sending" }, viewerId)).toBe("sending");
         expect(resolveTickState({ user_id: viewerId, created_at: "2026-09-01T12:00:00.000Z", status: "failed" }, viewerId)).toBe("failed");
      });

      it("returns sent for other users messages", () => {
         expect(resolveTickState({ user_id: "other-user", created_at: "2026-09-01T12:00:00.000Z" }, viewerId)).toBe("sent");
      });

      it("returns read if msg.is_read is true", () => {
         expect(resolveTickState({ user_id: viewerId, created_at: "2026-09-01T12:00:00.000Z", is_read: true }, viewerId)).toBe("read");
      });

      it("returns read if covered by peerReceipts timestamp", () => {
         const msg = { user_id: viewerId, created_at: "2026-09-01T12:00:00.000Z" };
         const peerReceipts = {
            "peer-1": "2026-09-01T12:05:00.000Z", // Read after sent
         };
         expect(resolveTickState(msg, viewerId, peerReceipts)).toBe("read");
      });

      it("returns sent if peerReceipts timestamp is older than message", () => {
         const msg = { user_id: viewerId, created_at: "2026-09-01T12:00:00.000Z" };
         const peerReceipts = {
            "peer-1": "2026-09-01T11:55:00.000Z", // Read before sent
         };
         expect(resolveTickState(msg, viewerId, peerReceipts)).toBe("sent");
      });
   });

   describe("getSeenBy", () => {
      it("filters and orders readers by seen timestamp", () => {
         const sentAt = "2026-09-01T12:00:00.000Z";
         const peerReceipts = {
            "user-1": "2026-09-01T12:10:00.000Z",
            "user-2": "2026-09-01T11:50:00.000Z", // Before send time, not seen
            "user-3": "2026-09-01T12:02:00.000Z",
         };
         const seen = getSeenBy(sentAt, peerReceipts);
         expect(seen).toHaveLength(2);
         expect(seen[0].userId).toBe("user-3"); // Earliest first
         expect(seen[1].userId).toBe("user-1");
      });
   });

   describe("markGroupsRead", () => {
      it("updates zustand store with anchored timestamp and sends upsert to Supabase", () => {
         const userId = "user-123";
         const groupId = "group-abc";

         useAppStore.setState({
            globalMessages: [
               {
                  id: "msg-1",
                  group_id: groupId,
                  user_id: "other-user",
                  content: "Hello",
                  created_at: "2026-09-01T12:00:00.000Z",
               },
               {
                  id: "msg-2",
                  group_id: groupId,
                  user_id: "other-user",
                  content: "Latest message",
                  created_at: "2026-09-01T12:30:00.000Z",
               },
            ],
         });

         markGroupsRead(userId, [groupId]);

         const updatedReceipts = useAppStore.getState().readReceipts;
         expect(updatedReceipts[groupId]).toBeDefined();
         expect(new Date(updatedReceipts[groupId]).getTime()).toBeGreaterThanOrEqual(
            new Date("2026-09-01T12:30:00.000Z").getTime(),
         );
      });
   });
});
