import { describe, it, expect, beforeEach, vi } from "vitest";
import {
   sendClientNotification,
   flushNotificationQueue,
   sendWordUpInviteNotification,
   sendWordUpTurnNotification,
   sendWordGridTurnNotification,
} from "../lib/clientPush";
import { supabase } from "../lib/supabaseClient";

vi.mock("../lib/supabaseClient", () => ({
   supabase: {
      from: vi.fn(),
   },
}));

describe("Client Push Notification Manager", () => {
   const STORAGE_KEY = "variant_client_push_queue_v1";
   const mockUserId = "123e4567-e89b-12d3-a456-426614174000";

   beforeEach(() => {
      localStorage.clear();
      vi.clearAllMocks();
   });

   it("queues notification in localStorage and deletes it on successful delivery", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const res = await sendClientNotification({
         user_id: mockUserId,
         type: "CHALLENGE_INVITE",
         title: "Test Challenge",
         message: "You have been challenged!",
         data: { mode: "wordup_async", matchId: "match-123" },
      });

      expect(res).toBe(true);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it("retries up to 3 times on failure and keeps item in localStorage on total failure", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { message: "Network timeout" } });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const res = await sendClientNotification({
         user_id: mockUserId,
         type: "CHALLENGE_INVITE",
         title: "Failed Challenge",
         message: "Will fail 3 times",
      });

      expect(res).toBe(false);
      expect(mockInsert).toHaveBeenCalledTimes(3);

      const rawQueue = localStorage.getItem(STORAGE_KEY);
      expect(rawQueue).not.toBeNull();
      const queue = JSON.parse(rawQueue!);
      expect(queue.length).toBe(1);
      expect(queue[0].title).toBe("Failed Challenge");
   });

   it("flushes pending notifications in localStorage when flushNotificationQueue is invoked", async () => {
      // Manually populate localStorage queue
      const pendingNotif = {
         id: "test-id-999",
         user_id: mockUserId,
         type: "CHALLENGE_INVITE",
         title: "Pending Retry Notification",
         message: "Retry message",
         data: { mode: "wordgrid" },
         created_at: new Date().toISOString(),
         retryCount: 1,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([pendingNotif]));

      // Mock successful insert on flush
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await flushNotificationQueue();

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it("helper sendWordUpInviteNotification formats payload correctly", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const res = await sendWordUpInviteNotification(mockUserId, "Alice", "science_tech", "match-abc");
      expect(res).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
         expect.objectContaining({
            user_id: mockUserId,
            type: "CHALLENGE_INVITE",
            title: "WordUp Battle Challenge! ⚔️",
            message: "Alice challenged you to a WordUp match in science tech!",
         })
      );
   });

   it("helper sendWordUpTurnNotification formats payload correctly", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const res = await sendWordUpTurnNotification(mockUserId, "Bob", "history", "match-xyz");
      expect(res).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
         expect.objectContaining({
            user_id: mockUserId,
            type: "CHALLENGE_INVITE",
            title: "Your Turn in WordUp! ⚔️",
            message: "Bob completed their turn in history! It is now your turn.",
         })
      );
   });

   it("helper sendWordGridTurnNotification formats payload correctly", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const res = await sendWordGridTurnNotification(mockUserId, "Charlie", "grid-123", false, false);
      expect(res).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
         expect.objectContaining({
            user_id: mockUserId,
            type: "CHALLENGE_INVITE",
            title: "Your Turn in WordGrid! 🔠",
            message: "Charlie played a word! It is now your turn.",
         })
      );
   });
});
