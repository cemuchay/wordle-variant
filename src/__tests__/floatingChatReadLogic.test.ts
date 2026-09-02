import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";
import { isReactionRow } from "../utils/readReceipts";

describe("FloatingChatReadLogic unread calculations and filtering", () => {
   const currentUserId = "00000000-0000-4000-a000-000000000001";
   const room1 = "00000000-0000-4000-a000-000000000010";
   const room2 = "00000000-0000-4000-a000-000000000020";

   beforeEach(() => {
      useAppStore.setState({
         readReceipts: {},
         joinedGroupIds: [room1, room2],
         globalMessages: [],
      });
   });

   it("filters unread messages accurately based on room read receipt timestamp", () => {
      const messages = [
         {
            id: "msg-1",
            group_id: room1,
            user_id: "other-user",
            content: "Hello",
            created_at: "2026-09-01T10:00:00.000Z",
         },
         {
            id: "msg-2",
            group_id: room1,
            user_id: "other-user",
            content: "Newer unread message",
            created_at: "2026-09-01T10:30:00.000Z",
         },
         {
            id: "msg-3",
            group_id: room1,
            user_id: currentUserId, // Own message — should never count as unread
            content: "My own message",
            created_at: "2026-09-01T10:35:00.000Z",
         },
         {
            id: "msg-4",
            group_id: room1,
            user_id: "other-user",
            content: "[reaction:❤️]", // Reaction row — should not count
            created_at: "2026-09-01T10:40:00.000Z",
         },
      ];

      useAppStore.setState({
         readReceipts: {
            [room1]: "2026-09-01T10:15:00.000Z", // read after msg-1, before msg-2
         },
         globalMessages: messages,
      });

      const store = useAppStore.getState();
      const joinedSet = new Set(store.joinedGroupIds);

      const unreadList = store.globalMessages.filter((m) => {
         if (!currentUserId || m.user_id === currentUserId) return false;
         if (!joinedSet.has(m.group_id)) return false;
         if (isReactionRow(m.content)) return false;
         const lastSeen = store.readReceipts[m.group_id] || new Date(0).toISOString();
         return new Date(m.created_at).getTime() > new Date(lastSeen).getTime();
      });

      expect(unreadList).toHaveLength(1);
      expect(unreadList[0].id).toBe("msg-2");
   });

   it("calculates per-conversation unread counts correctly across multiple rooms", () => {
      const messages = [
         {
            id: "msg-r1-1",
            group_id: room1,
            user_id: "other-user",
            content: "Room 1 Msg 1",
            created_at: "2026-09-01T12:00:00.000Z",
         },
         {
            id: "msg-r1-2",
            group_id: room1,
            user_id: "other-user",
            content: "Room 1 Msg 2",
            created_at: "2026-09-01T12:05:00.000Z",
         },
         {
            id: "msg-r2-1",
            group_id: room2,
            user_id: "other-user",
            content: "Room 2 Msg 1",
            created_at: "2026-09-01T12:10:00.000Z",
         },
      ];

      useAppStore.setState({
         readReceipts: {
            [room1]: "2026-09-01T12:02:00.000Z", // Covers msg-r1-1, leaves msg-r1-2
            [room2]: "2026-09-01T12:00:00.000Z", // Leaves msg-r2-1
         },
         globalMessages: messages,
      });

      const store = useAppStore.getState();
      const counts: Record<string, number> = {};

      store.joinedGroupIds.forEach((gid) => {
         counts[gid] = store.globalMessages.filter((m) => {
            if (m.group_id !== gid) return false;
            if (m.user_id === currentUserId) return false;
            if (isReactionRow(m.content)) return false;
            const lastSeen = store.readReceipts[gid] || new Date(0).toISOString();
            return new Date(m.created_at).getTime() > new Date(lastSeen).getTime();
         }).length;
      });

      expect(counts[room1]).toBe(1);
      expect(counts[room2]).toBe(1);

      // Advance room1 receipt timestamp
      store.updateReadReceipt(room1, "2026-09-01T12:06:00.000Z");

      const updatedStore = useAppStore.getState();
      const updatedRoom1Count = updatedStore.globalMessages.filter((m) => {
         if (m.group_id !== room1) return false;
         if (m.user_id === currentUserId) return false;
         if (isReactionRow(m.content)) return false;
         const lastSeen = updatedStore.readReceipts[room1] || new Date(0).toISOString();
         return new Date(m.created_at).getTime() > new Date(lastSeen).getTime();
      }).length;

      expect(updatedRoom1Count).toBe(0);
   });
});
