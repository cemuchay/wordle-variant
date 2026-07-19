/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { networkGate } from '../../lib/networkGate';
import { syncWithRetry, getLetterStatuses } from '../../lib/game-logic';
import { logger } from '../../lib/logger';
import { TOAST_DURATION } from '../../constants/ui';
import { safeLocalStorage } from '../../utils/storage';
import { saveGameWithBackup } from './utils';

interface UsePersistenceProps {
   user: any;
   date: string;
   dispatch: React.Dispatch<any>;
   config: any;
   triggerToast: (msg: string, duration?: number) => void;
}

export const usePersistence = ({ user, date, dispatch, config, triggerToast }: UsePersistenceProps) => {
   const performSync = useCallback(
      async (gamePayload: { status: string; guesses?: any[]; usedHint?: boolean; hintRecord?: any }) => {
         if (!user || !date) return false;
         dispatch({ type: "SET_SYNC_STATUS", status: "syncing" });

         // Lightweight pre-sync check: only push if local is ahead of cloud
         try {
            const cloudData = await networkGate.enqueue(
               'pre_sync_check',
               {
                  type: 'supabase',
                  table: 'scores',
                  operation: 'select',
                  payload: { select: 'guesses, hints_used, hint_record' },
                  query: {
                     eq: { user_id: user.id, game_date: date },
                     maybeSingle: true
                  }
               },
               true // blocking
            );

            if (cloudData?.guesses && gamePayload.guesses) {
               const cloudCount = cloudData.guesses.length;
               const localCount = gamePayload.guesses.length;

               const cloudAhead = cloudCount > localCount || (
                  cloudCount === localCount &&
                  cloudData.hints_used === gamePayload.usedHint &&
                  JSON.stringify(cloudData.hint_record) === JSON.stringify(gamePayload.hintRecord)
               );

               if (cloudAhead) {
                  dispatch({ type: "SET_SYNC_STATUS", status: "synced" });
                  setTimeout(
                     () => dispatch({ type: "SET_SYNC_STATUS", status: "idle" }),
                     TOAST_DURATION.DEFAULT,
                  );
                  return true;
               }
            }
         } catch (e) {
            console.warn("Pre-sync check failed, proceeding with sync:", e);
         }

         try {
            await syncWithRetry(user.id, date, gamePayload);
            dispatch({ type: "SET_SYNC_STATUS", status: "synced" });

            // Clear needsSync flag in localStorage
            const saved = safeLocalStorage.getItem(`wordle-${date}`);
            if (saved) {
               const current = JSON.parse(saved);
               if (current.needsSync) {
                  delete current.needsSync;
                  saveGameWithBackup(date, current);
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
               saveGameWithBackup(date, current);
            }
            return false;
         }
      },
      [user, date, dispatch],
   );

   const loadFromCloud = useCallback(async () => {
      if (!user || !date) return null;
      try {
         const data = await networkGate.enqueue(
            'load_from_cloud',
            {
               type: 'supabase',
               table: 'scores',
               operation: 'select',
               payload: { select: 'guesses, status, hints_used, hint_record, game_message' },
               query: {
                  eq: { user_id: user.id, game_date: date },
                  maybeSingle: true
               }
            },
            true // blocking
         );

         if (data) {
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
