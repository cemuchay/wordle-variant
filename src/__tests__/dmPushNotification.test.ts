import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
   sendDirectMessagePushNotification,
   pruneQueueForUser,
} from "../lib/clientPush";

// Mock Supabase
vi.mock("../lib/supabaseClient", () => ({
   supabase: {
      from: vi.fn(() => ({
         insert: vi.fn().mockResolvedValue({ error: null }),
      })),
   },
}));

describe("Client-Side DM Push Notifications", () => {
   const senderId = "00000000-0000-4000-a000-000000000001";
   const recipientId = "00000000-0000-4000-a000-000000000002";
   const groupId = "00000000-0000-4000-a000-000000000003";

   beforeEach(() => {
      localStorage.clear();
      vi.clearAllMocks();
   });

   afterEach(() => {
      localStorage.clear();
   });

   it("skips push notification when recipient is currently active/online", async () => {
      const result = await sendDirectMessagePushNotification({
         senderId,
         senderName: "Alice",
         recipientId,
         isRecipientOnline: true,
         recipientLastSeenAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
         messageSnippet: "Hey there!",
         groupId,
      });

      expect(result).toBe(false);
      expect(localStorage.getItem("variant_client_push_queue_v1")).toBeNull();
   });

   it("sends push notification immediately when recipient is not currently online (even if active moments ago)", async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
      const result = await sendDirectMessagePushNotification({
         senderId,
         senderName: "Alice",
         recipientId,
         isRecipientOnline: false,
         recipientLastSeenAt: thirtySecondsAgo,
         messageSnippet: "Are you there?",
         groupId,
      });

      expect(result).toBe(true);
   });

   it("sends ONLY one notification for a burst / string of messages (deduplication)", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // First message in sequence -> Triggers notification
      const firstResult = await sendDirectMessagePushNotification({
         senderId,
         senderName: "Alice",
         recipientId,
         isRecipientOnline: false,
         recipientLastSeenAt: tenMinutesAgo,
         messageSnippet: "Message 1",
         groupId,
      });
      expect(firstResult).toBe(true);

      // Second message sent 10 seconds later -> Skipped (aggregated in burst)
      const secondResult = await sendDirectMessagePushNotification({
         senderId,
         senderName: "Alice",
         recipientId,
         isRecipientOnline: false,
         recipientLastSeenAt: tenMinutesAgo,
         messageSnippet: "Message 2",
         groupId,
      });
      expect(secondResult).toBe(false);

      // Third message sent 30 seconds later -> Skipped
      const thirdResult = await sendDirectMessagePushNotification({
         senderId,
         senderName: "Alice",
         recipientId,
         isRecipientOnline: false,
         recipientLastSeenAt: tenMinutesAgo,
         messageSnippet: "Message 3",
         groupId,
      });
      expect(thirdResult).toBe(false);
   });

   it("prunes queued notifications and resets burst tracker when user comes online", () => {
      localStorage.setItem(
         "variant_client_push_queue_v1",
         JSON.stringify([
            { id: "1", user_id: recipientId, title: "DM", message: "Hello" },
            { id: "2", user_id: "other-user", title: "DM", message: "Hi" },
         ])
      );

      pruneQueueForUser(recipientId);

      const queue = JSON.parse(
         localStorage.getItem("variant_client_push_queue_v1") || "[]"
      );
      expect(queue).toHaveLength(1);
      expect(queue[0].user_id).toBe("other-user");
   });

   it("sends DM_REMINDER notification type with correct parameters when recipient qualifies", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const { supabase } = await import("../lib/supabaseClient");
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const result = await sendDirectMessagePushNotification({
         senderId,
         senderName: "Bob",
         recipientId,
         isRecipientOnline: false,
         recipientLastSeenAt: tenMinutesAgo,
         messageSnippet: "Hey Bob checking in!",
         groupId,
      });

      expect(result).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
         expect.objectContaining({
            user_id: recipientId,
            type: "DM_REMINDER",
            title: "Message from Bob",
            message: "Hey Bob checking in!",
            data: expect.objectContaining({
               mode: "chat_dm",
               group_id: groupId,
               senderId,
               senderName: "Bob",
            }),
         })
      );
   });
});
