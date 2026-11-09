import { describe, it, expect, beforeEach, vi } from "vitest";
import {
   createPoll,
   submitPollVote,
   fetchPollWithVotes,
   fetchActivePinnedPoll,
   setAdminPollPinned,
   endPollEarly,
} from "../services/pollService";
import { safeLocalStorage } from "../utils/storage";
import { GENERAL_GROUP_ID, MAX_POLL_DURATION_HOURS } from "../types/poll";

vi.mock("../lib/supabaseClient", () => ({
   supabase: {
      from: () => ({
         select: () => ({
            eq: () => ({
               maybeSingle: async () => ({ data: null, error: null }),
               order: () => ({ data: null, error: null }),
               eq: () => ({
                  eq: () => ({
                     gt: () => ({
                        order: () => ({
                           limit: () => ({
                              maybeSingle: async () => ({ data: null, error: null }),
                           }),
                        }),
                     }),
                  }),
               }),
            }),
            in: () => ({
               order: async () => ({ data: null, error: null }),
            }),
         }),
         insert: () => ({
            select: () => ({
               maybeSingle: async () => ({ data: null, error: null }),
            }),
         }),
         update: () => ({
            eq: () => ({
               eq: () => ({
                  eq: async () => ({ data: null, error: null }),
               }),
               select: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
               }),
            }),
         }),
      }),
   },
}));

describe("pollService", () => {
   let counter = 0;

   beforeEach(() => {
      safeLocalStorage.clear();
      vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
         counter++;
         return `00000000-0000-0000-0000-${String(counter).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`;
      });
   });

   it("creates a poll and caps duration at 7 days (168 hours)", async () => {
      const poll = await createPoll({
         groupId: GENERAL_GROUP_ID,
         creatorId: "user-1",
         question: "Best starting word?",
         options: ["SLATE", "CRANE", "ADIEU"],
         durationHours: 500, // exceeds 168h
         allowChangeVote: true,
         isAnonymous: false,
         isAdminPoll: false,
         isPinned: false,
      });

      expect(poll.question).toBe("Best starting word?");
      expect(poll.options).toHaveLength(3);
      const createdMs = new Date(poll.created_at).getTime();
      const expiresMs = new Date(poll.expires_at).getTime();
      const diffHours = Math.round((expiresMs - createdMs) / (1000 * 60 * 60));
      expect(diffHours).toBe(MAX_POLL_DURATION_HOURS);
   });

   it("enforces 1 vote per user and allows changing vote when allowChangeVote is true", async () => {
      const poll = await createPoll({
         groupId: GENERAL_GROUP_ID,
         creatorId: "user-1",
         question: "Favorite mode?",
         options: ["Daily", "Challenge"],
         durationHours: 24,
         allowChangeVote: true,
         isAnonymous: false,
         isAdminPoll: false,
         isPinned: false,
      });

      const opt1 = poll.options[0].id;
      const opt2 = poll.options[1].id;

      const votes1 = await submitPollVote(poll.id, "voter-1", opt1);
      expect(votes1).toHaveLength(1);
      expect(votes1[0].option_id).toBe(opt1);

      // Switch vote to option 2
      const votes2 = await submitPollVote(poll.id, "voter-1", opt2);
      expect(votes2).toHaveLength(1); // still 1 vote for voter-1
      expect(votes2[0].option_id).toBe(opt2);
   });

   it("blocks changing vote when allowChangeVote is false", async () => {
      const poll = await createPoll({
         groupId: GENERAL_GROUP_ID,
         creatorId: "user-1",
         question: "Strict vote?",
         options: ["Yes", "No"],
         durationHours: 24,
         allowChangeVote: false,
         isAnonymous: true,
         isAdminPoll: false,
         isPinned: false,
      });

      const opt1 = poll.options[0].id;
      const opt2 = poll.options[1].id;

      await submitPollVote(poll.id, "voter-1", opt1);

      await expect(submitPollVote(poll.id, "voter-1", opt2)).rejects.toThrow(
         "Changing votes is disabled for this poll."
      );
   });

   it("enforces max 1 pinned admin poll at a time and unpins on early end", async () => {
      const adminPoll1 = await createPoll({
         groupId: GENERAL_GROUP_ID,
         creatorId: "admin-1",
         question: "Admin Poll 1",
         options: ["A", "B"],
         durationHours: 24,
         allowChangeVote: true,
         isAnonymous: false,
         isAdminPoll: true,
         isPinned: true,
      });

      let activePinned = await fetchActivePinnedPoll(GENERAL_GROUP_ID);
      expect(activePinned?.id).toBe(adminPoll1.id);

      // Creating a second pinned admin poll automatically unpins the first
      const adminPoll2 = await createPoll({
         groupId: GENERAL_GROUP_ID,
         creatorId: "admin-1",
         question: "Admin Poll 2",
         options: ["C", "D"],
         durationHours: 48,
         allowChangeVote: true,
         isAnonymous: false,
         isAdminPoll: true,
         isPinned: true,
      });

      activePinned = await fetchActivePinnedPoll(GENERAL_GROUP_ID);
      expect(activePinned?.id).toBe(adminPoll2.id);

      const poll1State = await fetchPollWithVotes(adminPoll1.id);
      expect(poll1State.poll?.is_pinned).toBe(false);

      // Ending adminPoll2 early unpins and expires it
      await endPollEarly(adminPoll2.id);
      activePinned = await fetchActivePinnedPoll(GENERAL_GROUP_ID);
      expect(activePinned).toBeNull();

      // Re-pinning poll 1 works
      await setAdminPollPinned(adminPoll1.id, GENERAL_GROUP_ID, true);
      activePinned = await fetchActivePinnedPoll(GENERAL_GROUP_ID);
      expect(activePinned?.id).toBe(adminPoll1.id);
   });
});
