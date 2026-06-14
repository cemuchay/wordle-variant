/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { syncWithRetry, getLetterStatuses } from '../../lib/game-logic';
import { logger } from '../../lib/logger';
import { TOAST_DURATION } from '../../constants/ui';
import { safeLocalStorage } from '../../utils/storage';

interface UsePersistenceProps {
   user: any;
   date: string;
   dispatch: React.Dispatch<any>;
   config: any;
   triggerToast: (msg: string, duration?: number) => void;
}

export const usePersistence = ({ user, date, dispatch, config, triggerToast }: UsePersistenceProps) => {
   const performSync = useCallback(
      async (gamePayload: { status: string }) => {
         if (!user || !date) return false;
         dispatch({ type: "SET_SYNC_STATUS", status: "syncing" });
         try {
            await syncWithRetry(user.id, date, gamePayload);
            dispatch({ type: "SET_SYNC_STATUS", status: "synced" });

            // Clear needsSync flag in localStorage
            const saved = safeLocalStorage.getItem(`wordle-${date}`);
            if (saved) {
               const current = JSON.parse(saved);
               if (current.needsSync) {
                  delete current.needsSync;
                  safeLocalStorage.setItem(
                     `wordle-${date}`,
                     JSON.stringify(current),
                  );
               }
            }

            // Notify open StatsModal on this client immediately on every sync
            const isGameOver =
               gamePayload?.status === "won" || gamePayload?.status === "lost";
            window.dispatchEvent(
               new CustomEvent("global-scores-updated", {
                  detail: { isBackground: true, isGameOver },
               }),
            );

            // Broadcast score update to other active players on every sync
            const syncChannel = supabase.channel(
               "global_scores_leaderboard_sync",
            );
            let channelRemoved = false;
            const removeSyncChannel = () => {
               if (!channelRemoved) {
                  channelRemoved = true;
                  supabase.removeChannel(syncChannel);
               }
            };
            syncChannel.subscribe((status) => {
               if (status === "SUBSCRIBED") {
                  syncChannel.send({
                     type: "broadcast",
                     event: "score_submitted",
                     payload: {
                        userId: user.id,
                        date,
                        status: gamePayload.status,
                     },
                  });
                  // Cleanup channel after a short delay to ensure broadcast is sent
                  setTimeout(removeSyncChannel, 1000);
               }
            });
            // Also clean up if status is not SUBSCRIBED (error/closed/timeout)
            setTimeout(removeSyncChannel, 5000);

            // Invalidate Redis server cache on completion (Hybrid Optimization)
            if (isGameOver) {
               supabase.functions
                  .invoke("redis-cache", {
                     body: { action: "invalidate", key: "leaderboard:weekly" },
                  })
                  .catch((e) => {
                     console.error(
                        "Failed to invalidate Redis weekly cache on server:",
                        e,
                     );
                  });
               supabase.functions
                  .invoke("redis-cache", {
                     body: { action: "invalidate", key: "leaderboard:monthly" },
                  })
                  .catch((e) => {
                     console.error(
                        "Failed to invalidate Redis monthly cache on server:",
                        e,
                     );
                  });
            }

            setTimeout(
               () => dispatch({ type: "SET_SYNC_STATUS", status: "idle" }),
               TOAST_DURATION.DEFAULT,
            );
            return true;
         } catch (error: unknown) {
            const err = error as Error;
            dispatch({ type: "SET_SYNC_STATUS", status: "error", error: err });
            logger.error("Cloud Sync Failure", {
               date,
               userId: user.id,
               error: err?.message || err,
               payload: gamePayload,
            });
            // Ensure needsSync flag is set in localStorage
            const saved = safeLocalStorage.getItem(`wordle-${date}`);
            if (saved) {
               const current = JSON.parse(saved);
               current.needsSync = true;
               safeLocalStorage.setItem(
                  `wordle-${date}`,
                  JSON.stringify(current),
               );
            }
            return false;
         }
      },
      [user, date, dispatch],
   );

   const loadFromCloud = useCallback(async () => {
      if (!user || !date) return null;
      try {
         const { data, error } = await supabase
            .from("scores")
            .select("*")
            .eq("user_id", user.id)
            .eq("game_date", date)
            .maybeSingle();

         if (!error && data) {
            return {
               guesses: data.guesses,
               letterStatuses: getLetterStatuses(data.guesses),
               status: data.status,
               usedHint: data.hints_used,
               hintRecord: data.hint_record,
               config: { ...config, word: config.word }, // Use current config
               gameMessage: data.game_message,
            };
         }
      } catch (e) {
         console.error("Cloud fetch failed:", e);
      }
      return null;
   }, [user, date, config]);

   const retrySync = useCallback(async () => {
      const saved = safeLocalStorage.getItem(`wordle-${date}`);
      if (!saved || !user) return;

      try {
         const payload = JSON.parse(saved);
         const success = await performSync(payload);
         if (success) {
            triggerToast("Sync successful!");
         } else {
            triggerToast("Sync failed again. Please check your connection.");
         }
      } catch (e) {
         console.error("Failed to parse local state for retry:", e);
      }
   }, [date, user, performSync, triggerToast]);

   return { performSync, loadFromCloud, retrySync };
};
