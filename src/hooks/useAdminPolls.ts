import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import {
   fetchAllAdminPollsWithVotes,
   setAdminPollPinned,
   endPollEarly,
   subscribeToLocalPollEvents,
} from "../services/pollService";
import type { Poll, PollVote, PollWithResults, PollOptionResult } from "../types/poll";

export const useAdminPolls = (enabled: boolean, currentUserId?: string) => {
   const [polls, setPolls] = useState<Poll[]>([]);
   const [votesByPollId, setVotesByPollId] = useState<Record<string, PollVote[]>>({});
   const [loading, setLoading] = useState<boolean>(false);
   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
   const [nowMs, setNowMs] = useState<number>(() => Date.now());

   const loadAll = useCallback(async () => {
      if (!enabled) return;
      setLoading(true);
      try {
         const res = await fetchAllAdminPollsWithVotes();
         setPolls(res.polls);
         setVotesByPollId(res.votesByPollId);
         setNowMs(Date.now());
      } finally {
         setLoading(false);
      }
   }, [enabled]);

   useEffect(() => {
      if (enabled) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         void loadAll();
      }
   }, [enabled, loadAll]);

   useEffect(() => {
      if (!enabled) return;

      const unsubLocal = subscribeToLocalPollEvents(() => {
         void loadAll();
      });

      const channelId = `admin_polls_settings_live_${Math.random().toString(36).slice(2, 9)}`;
      const channel = supabase
         .channel(channelId)
         .on("postgres_changes", { event: "*", schema: "public", table: "chat_polls" }, () => {
            void loadAll();
         })
         .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_votes" }, () => {
            void loadAll();
         })
         .subscribe();

      return () => {
         unsubLocal();
         void supabase.removeChannel(channel);
      };
   }, [enabled, loadAll]);

   const enrichedPolls: PollWithResults[] = useMemo(() => {
      return polls.map((poll) => {
         const votes = votesByPollId[poll.id] || [];
         const totalVotes = votes.length;
         const isExpired = new Date(poll.expires_at).getTime() <= nowMs;
         const userVote = currentUserId ? votes.find((v) => v.user_id === currentUserId) : null;

         const optionResults: PollOptionResult[] = poll.options.map((option) => {
            const optVotes = votes.filter((v) => v.option_id === option.id);
            const count = optVotes.length;
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const voters = poll.is_anonymous
               ? []
               : optVotes.map((v) => ({
                    id: v.user_id,
                    username: v.profiles?.username || "Player",
                    avatar_url: v.profiles?.avatar_url || "",
                 }));
            return { option, count, percentage, voters };
         });

         return {
            poll,
            votes,
            totalVotes,
            userVoteOptionId: userVote?.option_id || null,
            isExpired,
            optionResults,
         };
      });
   }, [polls, votesByPollId, currentUserId, nowMs]);

   const activePolls = useMemo(
      () => enrichedPolls.filter((p) => !p.isExpired),
      [enrichedPolls]
   );

   const pastPolls = useMemo(
      () => enrichedPolls.filter((p) => p.isExpired),
      [enrichedPolls]
   );

   const handleTogglePin = useCallback(
      async (poll: Poll) => {
         setActionLoadingId(poll.id);
         try {
            const shouldPin = !poll.is_pinned;
            await setAdminPollPinned(poll.id, poll.group_id, shouldPin);
            await loadAll();
         } finally {
            setActionLoadingId(null);
         }
      },
      [loadAll]
   );

   const handleEndEarly = useCallback(
      async (pollId: string) => {
         setActionLoadingId(pollId);
         try {
            await endPollEarly(pollId);
            await loadAll();
         } finally {
            setActionLoadingId(null);
         }
      },
      [loadAll]
   );

   return {
      enrichedPolls,
      activePolls,
      pastPolls,
      loading,
      actionLoadingId,
      handleTogglePin,
      handleEndEarly,
      refresh: loadAll,
   };
};
