import { supabase } from "../lib/supabaseClient";
import { safeLocalStorage } from "../utils/storage";
import {
   sendAdminPollCreatedPush,
   sendAdminPollExpiredPush,
} from "../lib/clientPush";
import {
   type Poll,
   type PollVote,
   type CreatePollInput,
   type PollOption,
   MAX_POLL_DURATION_HOURS,
   MIN_POLL_OPTIONS,
   MAX_POLL_OPTIONS,
} from "../types/poll";

const LOCAL_POLLS_KEY = "chat_polls_local_cache_v1";
const LOCAL_VOTES_KEY = "chat_poll_votes_local_cache_v1";

const getLocalPolls = (): Record<string, Poll> => {
   try {
      const raw = safeLocalStorage.getItem(LOCAL_POLLS_KEY);
      return raw ? JSON.parse(raw) : {};
   } catch {
      return {};
   }
};

const saveLocalPoll = (poll: Poll) => {
   try {
      const map = getLocalPolls();
      if (poll.is_pinned && poll.is_admin_poll) {
         // Ensure max 1 pinned admin poll in local cache too
         Object.values(map).forEach((p) => {
            if (p.group_id === poll.group_id && p.is_admin_poll && p.is_pinned && p.id !== poll.id) {
               map[p.id] = { ...p, is_pinned: false, pinned_at: null };
            }
         });
      }
      map[poll.id] = poll;
      safeLocalStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(map));
   } catch {
      // ignore storage errors
   }
};

const getLocalVotes = (pollId: string): PollVote[] => {
   try {
      const raw = safeLocalStorage.getItem(LOCAL_VOTES_KEY);
      const map: Record<string, PollVote[]> = raw ? JSON.parse(raw) : {};
      return map[pollId] || [];
   } catch {
      return [];
   }
};

const saveLocalVotes = (pollId: string, votes: PollVote[]) => {
   try {
      const raw = safeLocalStorage.getItem(LOCAL_VOTES_KEY);
      const map: Record<string, PollVote[]> = raw ? JSON.parse(raw) : {};
      map[pollId] = votes;
      safeLocalStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(map));
   } catch {
      // ignore storage errors
   }
};

// Event bus for instant cross-component reactivity (e.g. pinned banner <-> message card)
type PollEventListener = (pollId?: string) => void;
const listeners = new Set<PollEventListener>();

export const subscribeToLocalPollEvents = (listener: PollEventListener) => {
   listeners.add(listener);
   return () => {
      listeners.delete(listener);
   };
};

export const notifyPollUpdated = (pollId?: string) => {
   listeners.forEach((fn) => fn(pollId));
};

/**
 * Unpins any currently pinned admin poll in the specified group
 * to enforce max 1 pinned admin poll at a time.
 */
export const unpinActiveAdminPolls = async (groupId: string): Promise<void> => {
   try {
      await supabase
         .from("chat_polls")
         .update({ is_pinned: false, pinned_at: null })
         .eq("group_id", groupId)
         .eq("is_admin_poll", true)
         .eq("is_pinned", true);
   } catch {
      // fallback handled locally
   }

   const localMap = getLocalPolls();
   let changed = false;
   Object.values(localMap).forEach((p) => {
      if (p.group_id === groupId && p.is_admin_poll && p.is_pinned) {
         localMap[p.id] = { ...p, is_pinned: false, pinned_at: null };
         changed = true;
      }
   });
   if (changed) {
      safeLocalStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(localMap));
   }
};

/**
 * Creates a new poll in the database (with local cache fallback)
 */
export const createPoll = async (
   input: CreatePollInput,
   creatorProfile?: { id: string; username: string; avatar_url: string }
): Promise<Poll> => {
   const cleanQuestion = input.question.trim();
   if (!cleanQuestion) {
      throw new Error("Poll question cannot be empty.");
   }

   const cleanOptions: PollOption[] = input.options
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
      .slice(0, MAX_POLL_OPTIONS)
      .map((text, idx) => ({
         id: `opt_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
         text,
      }));

   if (cleanOptions.length < MIN_POLL_OPTIONS) {
      throw new Error(`A poll must have at least ${MIN_POLL_OPTIONS} options.`);
   }

   const clampedHours = Math.min(Math.max(0.1, input.durationHours), MAX_POLL_DURATION_HOURS);
   const now = new Date();
   const expiresAt = new Date(now.getTime() + clampedHours * 60 * 60 * 1000).toISOString();

   const shouldPin = Boolean(input.isAdminPoll && input.isPinned);

   if (shouldPin) {
      await unpinActiveAdminPolls(input.groupId);
   }

   const pollId = crypto.randomUUID();
   const newPollPayload = {
      id: pollId,
      group_id: input.groupId,
      creator_id: input.creatorId,
      question: cleanQuestion,
      options: cleanOptions,
      allow_change_vote: input.allowChangeVote,
      is_anonymous: input.isAnonymous,
      is_admin_poll: input.isAdminPoll,
      is_pinned: shouldPin,
      pinned_at: shouldPin ? now.toISOString() : null,
      expires_at: expiresAt,
      created_at: now.toISOString(),
   };

   const fullPoll: Poll = {
      ...newPollPayload,
      profiles: creatorProfile || null,
   };

   // Save optimistically to local cache
   saveLocalPoll(fullPoll);

   try {
      const { data, error } = await supabase
         .from("chat_polls")
         .insert([newPollPayload])
         .select("*, profiles:creator_id(id, username, avatar_url)")
         .maybeSingle();

      if (!error && data) {
         const normalized: Poll = {
            ...data,
            options: Array.isArray(data.options) ? data.options : cleanOptions,
         };
         saveLocalPoll(normalized);
         notifyPollUpdated(normalized.id);

         // Trigger client-side push notification broadcast if this is an Admin Poll
         if (normalized.is_admin_poll) {
            void sendAdminPollCreatedPush({
               pollId: normalized.id,
               question: normalized.question,
               creatorId: normalized.creator_id,
            });
         }

         return normalized;
      }
   } catch (err) {
      console.warn("Supabase chat_polls insert fallback to local storage:", err);
   }

   notifyPollUpdated(fullPoll.id);

   if (fullPoll.is_admin_poll) {
      void sendAdminPollCreatedPush({
         pollId: fullPoll.id,
         question: fullPoll.question,
         creatorId: fullPoll.creator_id,
      });
   }

   return fullPoll;
};

/**
 * Fetches a single poll and its votes
 */
export const fetchPollWithVotes = async (
   pollId: string
): Promise<{ poll: Poll | null; votes: PollVote[] }> => {
   let poll: Poll | null = getLocalPolls()[pollId] || null;
   let votes: PollVote[] = getLocalVotes(pollId);

   try {
      const [pollRes, votesRes] = await Promise.all([
         supabase
            .from("chat_polls")
            .select("*, profiles:creator_id(id, username, avatar_url)")
            .eq("id", pollId)
            .maybeSingle(),
         supabase
            .from("chat_poll_votes")
            .select("*, profiles:user_id(id, username, avatar_url)")
            .eq("poll_id", pollId)
            .order("created_at", { ascending: true }),
      ]);

      if (!pollRes.error && pollRes.data) {
         const fetchedPoll: Poll = {
            ...pollRes.data,
            options: Array.isArray(pollRes.data.options) ? pollRes.data.options : [],
         };
         poll = fetchedPoll;
         saveLocalPoll(fetchedPoll);
      }

      if (!votesRes.error && votesRes.data) {
         votes = votesRes.data as PollVote[];
         saveLocalVotes(pollId, votes);
      }
   } catch {
      // Fallback to cached local poll & votes
   }

   // Auto-unpin if expired
   if (poll && poll.is_pinned && new Date(poll.expires_at).getTime() <= Date.now()) {
      poll = { ...poll, is_pinned: false };
      saveLocalPoll(poll);
   }

   return { poll, votes };
};

/**
 * Casts or changes a user's vote on a poll
 */
export const submitPollVote = async (
   pollId: string,
   userId: string,
   optionId: string,
   userProfile?: { id: string; username: string; avatar_url: string }
): Promise<PollVote[]> => {
   const { poll, votes } = await fetchPollWithVotes(pollId);
   if (!poll) {
      throw new Error("Poll not found.");
   }

   if (new Date(poll.expires_at).getTime() <= Date.now()) {
      throw new Error("This poll has ended.");
   }

   const validOption = poll.options.some((o) => o.id === optionId);
   if (!validOption) {
      throw new Error("Invalid poll option.");
   }

   const existingVote = votes.find((v) => v.user_id === userId);
   if (existingVote) {
      if (existingVote.option_id === optionId) {
         return votes; // Already voted for this option
      }
      if (!poll.allow_change_vote) {
         throw new Error("Changing votes is disabled for this poll.");
      }

      // Update existing vote
      const nowIso = new Date().toISOString();
      const updatedVote: PollVote = {
         ...existingVote,
         option_id: optionId,
         updated_at: nowIso,
         profiles: userProfile || existingVote.profiles || null,
      };
      const nextVotes = votes.map((v) => (v.user_id === userId ? updatedVote : v));
      saveLocalVotes(pollId, nextVotes);

      try {
         const { error } = await supabase
            .from("chat_poll_votes")
            .update({ option_id: optionId, updated_at: nowIso })
            .eq("poll_id", pollId)
            .eq("user_id", userId);

         if (error) {
            console.warn("Supabase vote update warning:", error);
         }
      } catch {
         // local state updated
      }

      notifyPollUpdated(pollId);
      return nextVotes;
   }

   // Insert new vote
   const nowIso = new Date().toISOString();
   const newVote: PollVote = {
      id: crypto.randomUUID(),
      poll_id: pollId,
      user_id: userId,
      option_id: optionId,
      created_at: nowIso,
      updated_at: nowIso,
      profiles: userProfile || null,
   };

   const nextVotes = [...votes, newVote];
   saveLocalVotes(pollId, nextVotes);

   try {
      const { data, error } = await supabase
         .from("chat_poll_votes")
         .insert([
            {
               id: newVote.id,
               poll_id: pollId,
               user_id: userId,
               option_id: optionId,
            },
         ])
         .select("*, profiles:user_id(id, username, avatar_url)")
         .maybeSingle();

      if (!error && data) {
         const syncedVotes = nextVotes.map((v) => (v.user_id === userId ? (data as PollVote) : v));
         saveLocalVotes(pollId, syncedVotes);
         notifyPollUpdated(pollId);
         return syncedVotes;
      }
   } catch {
      // local state updated
   }

   notifyPollUpdated(pollId);
   return nextVotes;
};

/**
 * Fetches the currently active pinned admin poll for a group (max 1)
 */
export const fetchActivePinnedPoll = async (groupId: string): Promise<Poll | null> => {
   const nowIso = new Date().toISOString();
   try {
      const { data, error } = await supabase
         .from("chat_polls")
         .select("*, profiles:creator_id(id, username, avatar_url)")
         .eq("group_id", groupId)
         .eq("is_admin_poll", true)
         .eq("is_pinned", true)
         .gt("expires_at", nowIso)
         .order("created_at", { ascending: false })
         .limit(1)
         .maybeSingle();

      if (!error && data) {
         const normalized: Poll = {
            ...data,
            options: Array.isArray(data.options) ? data.options : [],
         };
         saveLocalPoll(normalized);
         return normalized;
      }
   } catch {
      // fallback to local
   }

   const localPolls = Object.values(getLocalPolls());
   const activePinned = localPolls.find(
      (p) =>
         p.group_id === groupId &&
         p.is_admin_poll &&
         p.is_pinned &&
         new Date(p.expires_at).getTime() > Date.now()
   );
   return activePinned || null;
};

/**
 * Toggle pin state of an admin poll (enforces max 1 pinned poll at a time)
 */
export const setAdminPollPinned = async (
   pollId: string,
   groupId: string,
   pin: boolean
): Promise<Poll | null> => {
   if (pin) {
      await unpinActiveAdminPolls(groupId);
   }

   const nowIso = pin ? new Date().toISOString() : null;
   const localMap = getLocalPolls();
   if (localMap[pollId]) {
      localMap[pollId] = {
         ...localMap[pollId],
         is_pinned: pin,
         pinned_at: nowIso,
      };
      safeLocalStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(localMap));
   }

   try {
      const { data, error } = await supabase
         .from("chat_polls")
         .update({ is_pinned: pin, pinned_at: nowIso })
         .eq("id", pollId)
         .select("*, profiles:creator_id(id, username, avatar_url)")
         .maybeSingle();

      if (!error && data) {
         const normalized: Poll = {
            ...data,
            options: Array.isArray(data.options) ? data.options : [],
         };
         saveLocalPoll(normalized);
         notifyPollUpdated(pollId);
         return normalized;
      }
   } catch {
      // fallback
   }

   notifyPollUpdated(pollId);
   return localMap[pollId] || null;
};

/**
 * Evaluates votes on an expired admin poll and dispatches an expiration push notification exactly once.
 */
export const checkAndNotifyAdminPollExpired = async (
   pollId: string
): Promise<boolean> => {
   const { poll, votes } = await fetchPollWithVotes(pollId);
   if (!poll || !poll.is_admin_poll || poll.notified_expired_at) {
      return false;
   }

   const nowIso = new Date().toISOString();

   // Mark notified_expired_at locally and on server first to prevent race conditions
   const localMap = getLocalPolls();
   if (localMap[pollId]) {
      localMap[pollId] = {
         ...localMap[pollId],
         notified_expired_at: nowIso,
      };
      safeLocalStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(localMap));
   }

   try {
      await supabase
         .from("chat_polls")
         .update({ notified_expired_at: nowIso })
         .eq("id", pollId);
   } catch (err) {
      console.warn("[PollService] Could not update notified_expired_at in Supabase:", err);
   }

   // Calculate winning option & percentage
   const totalVotes = votes.length;
   let winningText = "";
   let winningPercentage = 0;

   if (totalVotes > 0 && poll.options && poll.options.length > 0) {
      let maxCount = -1;
      let winningOpt = poll.options[0];

      poll.options.forEach((opt) => {
         const count = votes.filter((v) => v.option_id === opt.id).length;
         if (count > maxCount) {
            maxCount = count;
            winningOpt = opt;
         }
      });

      winningText = winningOpt.text;
      winningPercentage = Math.round((maxCount / totalVotes) * 100);
   }

   void sendAdminPollExpiredPush({
      pollId: poll.id,
      question: poll.question,
      winningOptionText: winningText || null,
      winningPercentage,
      totalVotes,
   });

   return true;
};

/**
 * Ends an admin poll early by setting expires_at to now() and unpinning it
 */
export const endPollEarly = async (pollId: string): Promise<Poll | null> => {
   const nowIso = new Date().toISOString();
   const localMap = getLocalPolls();
   if (localMap[pollId]) {
      localMap[pollId] = {
         ...localMap[pollId],
         expires_at: nowIso,
         is_pinned: false,
         pinned_at: null,
      };
      safeLocalStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(localMap));
   }

   let endedPoll: Poll | null = null;

   try {
      const { data, error } = await supabase
         .from("chat_polls")
         .update({ expires_at: nowIso, is_pinned: false, pinned_at: null })
         .eq("id", pollId)
         .select("*, profiles:creator_id(id, username, avatar_url)")
         .maybeSingle();

      if (!error && data) {
         const normalized: Poll = {
            ...data,
            options: Array.isArray(data.options) ? data.options : [],
         };
         saveLocalPoll(normalized);
         endedPoll = normalized;
      }
   } catch {
      // fallback
   }

   if (!endedPoll && localMap[pollId]) {
      endedPoll = localMap[pollId];
   }

   notifyPollUpdated(pollId);

   // Dispatch expired results push notification
   void checkAndNotifyAdminPollExpired(pollId);

   return endedPoll;
};

/**
 * Fetches all admin polls (both active and past) with their votes for Settings Modal
 */
export const fetchAllAdminPollsWithVotes = async (): Promise<{
   polls: Poll[];
   votesByPollId: Record<string, PollVote[]>;
}> => {
   let polls: Poll[] = Object.values(getLocalPolls()).filter((p) => p.is_admin_poll);
   const votesByPollId: Record<string, PollVote[]> = {};

   polls.forEach((p) => {
      votesByPollId[p.id] = getLocalVotes(p.id);
   });

   try {
      const { data: dbPolls, error } = await supabase
         .from("chat_polls")
         .select("*, profiles:creator_id(id, username, avatar_url)")
         .eq("is_admin_poll", true)
         .order("created_at", { ascending: false });

      if (!error && dbPolls) {
         const mergedMap = new Map<string, Poll>();
         polls.forEach((p) => mergedMap.set(p.id, p));
         (dbPolls as Poll[]).forEach((p) => {
            const norm: Poll = {
               ...p,
               options: Array.isArray(p.options) ? p.options : [],
            };
            mergedMap.set(norm.id, norm);
            saveLocalPoll(norm);
         });
         polls = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
         );

         if (polls.length > 0) {
            const pollIds = polls.map((p) => p.id);
            const { data: dbVotes, error: votesErr } = await supabase
               .from("chat_poll_votes")
               .select("*, profiles:user_id(id, username, avatar_url)")
               .in("poll_id", pollIds)
               .order("created_at", { ascending: true });

            if (!votesErr && dbVotes) {
               pollIds.forEach((id) => {
                  votesByPollId[id] = [];
               });
               (dbVotes as PollVote[]).forEach((v) => {
                  if (!votesByPollId[v.poll_id]) votesByPollId[v.poll_id] = [];
                  votesByPollId[v.poll_id].push(v);
               });
               Object.entries(votesByPollId).forEach(([pid, vList]) => {
                  saveLocalVotes(pid, vList);
               });
            }
         }
      }
   } catch {
      // use local fallback
   }

   return { polls, votesByPollId };
};
