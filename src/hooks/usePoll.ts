import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import {
   fetchPollWithVotes,
   submitPollVote,
   fetchActivePinnedPoll,
   subscribeToLocalPollEvents,
} from "../services/pollService";
import type { Poll, PollVote, PollOptionResult } from "../types/poll";

export const formatPollRemainingTime = (expiresAt: string): { text: string; isExpired: boolean } => {
   const diffMs = new Date(expiresAt).getTime() - Date.now();
   if (diffMs <= 0) {
      return { text: "Poll ended", isExpired: true };
   }

   const totalMinutes = Math.floor(diffMs / (1000 * 60));
   const days = Math.floor(totalMinutes / (60 * 24));
   const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
   const minutes = totalMinutes % 60;

   if (days > 0) {
      return { text: `${days}d ${hours}h left`, isExpired: false };
   }
   if (hours > 0) {
      return { text: `${hours}h ${minutes}m left`, isExpired: false };
   }
   if (minutes > 0) {
      return { text: `${minutes}m left`, isExpired: false };
   }
   return { text: "< 1m left", isExpired: false };
};

export const usePoll = (
   pollId: string | undefined,
   currentUserId?: string,
   currentUserProfile?: { id: string; username: string; avatar_url: string }
) => {
   const [poll, setPoll] = useState<Poll | null>(null);
   const [votes, setVotes] = useState<PollVote[]>([]);
   const [loading, setLoading] = useState<boolean>(true);
   const [voting, setVoting] = useState<boolean>(false);
   const [error, setError] = useState<string | null>(null);
   const [nowTick, setNowTick] = useState<number>(() => Date.now());

   const loadPoll = useCallback(async () => {
      if (!pollId) return;
      try {
         const data = await fetchPollWithVotes(pollId);
         setPoll(data.poll);
         setVotes(data.votes);
      } catch (err: unknown) {
         setError(err instanceof Error ? err.message : "Failed to load poll");
      } finally {
         setLoading(false);
      }
   }, [pollId]);

   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadPoll();
   }, [loadPoll]);

   // Subscribe to local & Supabase real-time updates for this poll
   useEffect(() => {
      if (!pollId) return;

      const unsubLocal = subscribeToLocalPollEvents((updatedId) => {
         if (!updatedId || updatedId === pollId) {
            void loadPoll();
         }
      });

      const channelId = `poll_live_${pollId}_${Math.random().toString(36).slice(2, 9)}`;
      const channel = supabase
         .channel(channelId)
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "chat_polls", filter: `id=eq.${pollId}` },
            () => {
               void loadPoll();
            }
         )
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "chat_poll_votes", filter: `poll_id=eq.${pollId}` },
            () => {
               void loadPoll();
            }
         )
         .subscribe();

      // Tick every 30s to keep countdown & auto-expiration accurate
      const timer = window.setInterval(() => {
         setNowTick(Date.now());
      }, 30000);

      return () => {
         unsubLocal();
         void supabase.removeChannel(channel);
         window.clearInterval(timer);
      };
   }, [pollId, loadPoll]);

   const isExpired = useMemo(() => {
      if (!poll) return false;
      return new Date(poll.expires_at).getTime() <= nowTick;
   }, [poll, nowTick]);

   const timeRemainingText = useMemo(() => {
      if (!poll) return "";
      void nowTick;
      return formatPollRemainingTime(poll.expires_at).text;
   }, [poll, nowTick]);

   const userVote = useMemo(() => {
      if (!currentUserId) return null;
      return votes.find((v) => v.user_id === currentUserId) || null;
   }, [votes, currentUserId]);

   const optionResults: PollOptionResult[] = useMemo(() => {
      if (!poll) return [];
      const total = votes.length;
      return poll.options.map((option) => {
         const optVotes = votes.filter((v) => v.option_id === option.id);
         const count = optVotes.length;
         const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
         const voters = poll.is_anonymous
            ? []
            : optVotes.map((v) => ({
                 id: v.user_id,
                 username: v.profiles?.username || "Player",
                 avatar_url: v.profiles?.avatar_url || "",
              }));
         return {
            option,
            count,
            percentage,
            voters,
         };
      });
   }, [poll, votes]);

   const castVote = useCallback(
      async (optionId: string) => {
         if (!pollId || !currentUserId || voting) return;
         setVoting(true);
         setError(null);
         try {
            const updatedVotes = await submitPollVote(
               pollId,
               currentUserId,
               optionId,
               currentUserProfile
            );
            setVotes(updatedVotes);
         } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not submit vote");
            throw err;
         } finally {
            setVoting(false);
         }
      },
      [pollId, currentUserId, currentUserProfile, voting]
   );

   return {
      poll,
      votes,
      totalVotes: votes.length,
      userVoteOptionId: userVote?.option_id || null,
      isExpired,
      timeRemainingText,
      optionResults,
      loading,
      voting,
      error,
      castVote,
      refresh: loadPoll,
   };
};

export const usePinnedPoll = (groupId: string | null | undefined, isGeneralGroup: boolean) => {
   const [pinnedPoll, setPinnedPoll] = useState<Poll | null>(null);

   const loadPinned = useCallback(async () => {
      if (!groupId || !isGeneralGroup) {
         setPinnedPoll(null);
         return;
      }
      const active = await fetchActivePinnedPoll(groupId);
      setPinnedPoll(active);
   }, [groupId, isGeneralGroup]);

   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadPinned();
   }, [loadPinned]);

   useEffect(() => {
      if (!groupId || !isGeneralGroup) return;

      const unsubLocal = subscribeToLocalPollEvents(() => {
         void loadPinned();
      });

      const channelId = `pinned_poll_${groupId}_${Math.random().toString(36).slice(2, 9)}`;
      const channel = supabase
         .channel(channelId)
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "chat_polls", filter: `group_id=eq.${groupId}` },
            () => {
               void loadPinned();
            }
         )
         .subscribe();

      // Re-check expiration every 15s so pinned poll unmounts promptly when lifetime ends
      const timer = window.setInterval(() => {
         setPinnedPoll((current) => {
            if (current && new Date(current.expires_at).getTime() <= Date.now()) {
               return null;
            }
            return current;
         });
      }, 15000);

      return () => {
         unsubLocal();
         void supabase.removeChannel(channel);
         window.clearInterval(timer);
      };
   }, [groupId, isGeneralGroup, loadPinned]);

   return { pinnedPoll, refreshPinned: loadPinned };
};
