import {
   useCallback,
   useEffect,
   useMemo,
   useReducer,
   useRef,
   useState,
} from "react";
import { useApp } from "../context/AppContext";
import { getWordLists } from "../data/words";
import { useAuth } from "../hooks/useAuth";
import {
   checkGuess,
   getDailyConfig,
   getHint,
   getLetterStatuses,
   isHintDisabled,
   syncWithRetry,
   updateStats,
   obfuscateWord,
   deobfuscateWord,
} from "../lib/game-logic";
import { supabase } from "../lib/supabaseClient";
import { generateRoast } from "../utils/roastEngine";
import { gameReducer, initialState } from "../reducers/gameReducer";
import { useWordleStats } from "./useStats";
import { useConfirmation } from "../context/ConfirmationContext";

import { logger } from "../lib/logger";
import { TOAST_DURATION } from "../constants/ui";
import { safeLocalStorage } from "../utils/storage";

const getLocalSalt = (date: string, userId: string | undefined) => {
   const base = `local_salt_${date}_${userId || "guest"}`;
   let hash = 0;
   for (let i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
   }
   return Math.abs(hash).toString(16);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const areGuessesCoherent = (localGuesses: any[], dbGuesses: any[]) => {
   if (!Array.isArray(localGuesses) || !Array.isArray(dbGuesses)) return false;
   const minLength = Math.min(localGuesses.length, dbGuesses.length);
   for (let i = 0; i < minLength; i++) {
      const localWord = localGuesses[i]
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         .map((c: any) => c.letter)
         .join("")
         .toUpperCase();
      const dbWord = dbGuesses[i]
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         .map((c: any) => c.letter)
         .join("")
         .toUpperCase();
      if (localWord !== dbWord) {
         return false;
      }
   }
   return true;
};

export const useGameEngine = (date: string) => {
   const [state, dispatch] = useReducer(gameReducer, initialState);
   const [isHydrated, setIsHydrated] = useState(false);
   const hydratedUserRef = useRef<string | undefined>(undefined);
   const hydratedDateRef = useRef<string | null>(null);
   const { user, loading: isAuthLoading } = useAuth();
   const { triggerToast, preferences } = useApp();
   const { ask } = useConfirmation();
   const config = useMemo(() => getDailyConfig(!!user, date), [date, user]);

   const { refresh, updateOptimistically } = useWordleStats(user, false, date);

   const performSync = useCallback(
      async (gamePayload: { status: string }) => {
         if (!user || !date) return;
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
      [user, date],
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

   // Hydration & Authentication Swap Logic
   useEffect(() => {
      if (!date || isAuthLoading) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setIsHydrated(false);
         return;
      }

      if (
         isHydrated &&
         hydratedUserRef.current === user?.id &&
         hydratedDateRef.current === date
      ) {
         return;
      }

      setIsHydrated(false);
      hydratedUserRef.current = user?.id;
      hydratedDateRef.current = date;
      const saved = safeLocalStorage.getItem(`wordle-${date}`);

      const hydrate = async () => {
         const cloudPayload = user ? await loadFromCloud() : null;

         if (saved) {
            try {
               const payload = JSON.parse(saved);

               // Deobfuscate target word for local in-memory gameplay state
               if (payload.config && payload.config.word) {
                  const localSalt = getLocalSalt(date, user?.id);
                  payload.config.word = deobfuscateWord(
                     payload.config.word,
                     localSalt,
                  );
               }

               // AUTH SWAP PROTECTION & BACKWARD COMPATIBILITY:
               // Only perform mismatch check once auth state is stable.
               if (payload.config && payload.config.word !== config.word) {
                  console.log(
                     "[Engine] Target word mismatch (Auth status changed), wiping today's progress.",
                  );
                  safeLocalStorage.removeItem(`wordle-${date}`);

                  // If moving from Guest -> Auth (they are logged in now, but previous game was explicitly a guest game)
                  if (user && payload.isGuest) {
                     safeLocalStorage.removeItem("wordle-statistics");
                     triggerToast(
                        "Logged in: Starting today's official word fresh.",
                     );
                  }

                  if (user && cloudPayload) {
                     dispatch({ type: "LOAD_STATE", payload: cloudPayload });
                     const localSalt = getLocalSalt(date, user.id);
                     const savedPayload = {
                        ...cloudPayload,
                        config: {
                           ...cloudPayload.config,
                           word: obfuscateWord(
                              cloudPayload.config.word,
                              localSalt,
                           ),
                        },
                     };
                     safeLocalStorage.setItem(
                        `wordle-${date}`,
                        JSON.stringify(savedPayload),
                     );
                  } else {
                     dispatch({ type: "LOAD_STATE", payload: initialState });
                  }
               } else {
                  // Both local and cloud states exist: check coherence and harmonize
                  if (user && cloudPayload) {
                     const isCoherent = areGuessesCoherent(
                        payload.guesses,
                        cloudPayload.guesses,
                     );
                     if (isCoherent) {
                        if (
                           cloudPayload.guesses.length > payload.guesses.length
                        ) {
                           console.log(
                              "[Engine] Cloud is ahead. Overwriting local state with cloud data.",
                           );
                           dispatch({
                              type: "LOAD_STATE",
                              payload: cloudPayload,
                           });
                           const localSalt = getLocalSalt(date, user.id);
                           const savedPayload = {
                              ...cloudPayload,
                              config: {
                                 ...cloudPayload.config,
                                 word: obfuscateWord(
                                    cloudPayload.config.word,
                                    localSalt,
                                 ),
                              },
                           };
                           safeLocalStorage.setItem(
                              `wordle-${date}`,
                              JSON.stringify(savedPayload),
                           );
                        } else if (
                           payload.guesses.length > cloudPayload.guesses.length
                        ) {
                           console.log(
                              "[Engine] Local is ahead. Syncing local state to cloud.",
                           );
                           dispatch({ type: "LOAD_STATE", payload });
                           performSync(payload);
                        } else {
                           // Equal and coherent
                           dispatch({ type: "LOAD_STATE", payload });
                        }
                     } else {
                        // Conflict/tampering: overwrite local with cloud data (cloud is authoritative)
                        console.log(
                           "[Engine] Guess conflict/tampering detected. Overwriting local state with cloud data.",
                        );
                        dispatch({ type: "LOAD_STATE", payload: cloudPayload });
                        const localSalt = getLocalSalt(date, user.id);
                        const savedPayload = {
                           ...cloudPayload,
                           config: {
                              ...cloudPayload.config,
                              word: obfuscateWord(
                                 cloudPayload.config.word,
                                 localSalt,
                              ),
                           },
                        };
                        safeLocalStorage.setItem(
                           `wordle-${date}`,
                           JSON.stringify(savedPayload),
                        );
                     }
                  } else {
                     // No cloud payload exists (or guest)
                     dispatch({ type: "LOAD_STATE", payload });
                     if (
                        user &&
                        payload.guesses &&
                        payload.guesses.length > 0
                     ) {
                        console.log(
                           "[Engine] Local state exists but no cloud score found. Syncing local state to cloud.",
                        );
                        performSync(payload);
                     }
                  }
               }
            } catch (e) {
               console.error("Failed to hydrate game state:", e);
            }
         } else if (user && cloudPayload) {
            // No local state but authenticated and cloud payload exists
            dispatch({ type: "LOAD_STATE", payload: cloudPayload });
            const localSalt = getLocalSalt(date, user.id);
            const savedPayload = {
               ...cloudPayload,
               config: {
                  ...cloudPayload.config,
                  word: obfuscateWord(cloudPayload.config.word, localSalt),
               },
            };
            safeLocalStorage.setItem(
               `wordle-${date}`,
               JSON.stringify(savedPayload),
            );
         } else {
            // Fresh start
            dispatch({ type: "LOAD_STATE", payload: initialState });
         }

         setIsHydrated(true);
      };

      hydrate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [
      date,
      user,
      isAuthLoading,
      config,
      triggerToast,
      performSync,
      loadFromCloud,
   ]);

   const onChar = useCallback(
      (char: string) => {
         dispatch({ type: "ADD_LETTER", char, maxLength: config.length });
      },
      [config.length],
   );

   const onDelete = useCallback(() => {
      dispatch({ type: "DELETE_LETTER" });
   }, []);

   const onEnter = useCallback(async () => {
      if (state.isGameOver || state.currentGuess.length !== config.length)
         return;

      // Prevent submission if the game is already completed on the cloud (e.g. from another tab/device)
      if (user && date) {
         try {
            const { data: cloudScore } = await supabase
               .from("scores")
               .select("status")
               .eq("user_id", user.id)
               .eq("game_date", date)
               .maybeSingle();

            if (
               cloudScore &&
               (cloudScore.status === "won" || cloudScore.status === "lost")
            ) {
               triggerToast("Game already completed.");

               // Fetch complete cloud state and override local
               const cloudPayload = await loadFromCloud();
               if (cloudPayload) {
                  dispatch({ type: "LOAD_STATE", payload: cloudPayload });
                  const localSalt = getLocalSalt(date, user.id);
                  const savedPayload = {
                     ...cloudPayload,
                     config: {
                        ...cloudPayload.config,
                        word: obfuscateWord(
                           cloudPayload.config.word,
                           localSalt,
                        ),
                     },
                  };
                  safeLocalStorage.setItem(
                     `wordle-${date}`,
                     JSON.stringify(savedPayload),
                  );
               }
               return;
            }
         } catch (e) {
            console.error("Failed to verify cloud score state:", e);
         }
      }

      const upperGuess = state.currentGuess.toUpperCase();
      const { valid } = getWordLists(config.length);

      if (!valid.has(upperGuess)) {
         triggerToast("Not in word list.");
         dispatch({ type: "SHAKE_GUESS" });
         setTimeout(() => dispatch({ type: "STOP_SHAKE" }), 500);
         return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alreadyGuessed = state.guesses.some((guess: any) => {
         const word = guess
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((charObj: any) => charObj.letter)
            .join("")
            .toUpperCase();
         return word === upperGuess;
      });

      if (alreadyGuessed) {
         const confirmSubmit = await ask({
            title: "Duplicate Guess",
            message: `You already guessed "${upperGuess}". Are you sure you want to submit it again?`,
            confirmLabel: "Yes, submit",
            cancelLabel: "No, cancel",
            type: "info",
         });
         if (!confirmSubmit) return;
      }

      const result = checkGuess(upperGuess, config.word);
      const won = upperGuess === config.word;
      const lost = state.guesses.length + 1 === config.maxAttempts;

      const newGuesses = [...state.guesses, result];
      const newStatus = won ? "won" : lost ? "lost" : "playing";

      const message =
         preferences.allowRoasts &&
         (newStatus === "won" || newStatus === "lost")
            ? generateRoast(
                 newGuesses,
                 config.word,
                 state.usedHint,
                 won,
                 newGuesses.length,
              )
            : "";

      const payload = {
         date,
         isGuest: !user,
         guesses: newGuesses,
         letterStatuses: getLetterStatuses(newGuesses),
         status: newStatus,
         usedHint: state.usedHint,
         hintRecord: state.hintRecord,
         config,
         gameMessage: message,
      };

      // 1. Save locally FIRST with obfuscation to ensure data integrity
      const localSalt = getLocalSalt(date, user?.id);
      const savedPayload = {
         ...payload,
         config: {
            ...payload.config,
            word: obfuscateWord(payload.config.word, localSalt),
         },
      };
      safeLocalStorage.setItem(`wordle-${date}`, JSON.stringify(savedPayload));

      if (user) {
         const success = await performSync(payload);
         if (!success) {
            triggerToast(
               "Cloud sync failed after 3 attempts. Progress saved locally.",
               TOAST_DURATION.LONG + 1000,
            );
         }
      }

      // Stabilization Delay: Wait 300ms after sync attempt before triggering reveal
      await new Promise((r) => setTimeout(r, 300));

      // 2. Update UI (flips row)
      dispatch({
         type: "SUBMIT_GUESS",
         result,
         isWon: won,
         isLost: lost,
         message,
      });

      if (won || lost) {
         const updatedStats = updateStats(won, newGuesses.length);
         updateOptimistically(updatedStats);
         await refresh();

         // Only show reveal after sync attempt (successful or failed-but-locally-saved)
         if (lost) {
            triggerToast(
               `The word is: ${config.word}`,
               TOAST_DURATION.LONG + 1000, // 5 seconds
            );
         }

         // Calculate delay: wordLength * 400ms + buffer to ensure all tiles flip
         // Same formula used in Grid.tsx (wordLength * ANIMATION_DURATION.TILE_REVEAL + buffer)
         const revealDelay = config.length * 400 + 1000;

         setTimeout(() => {
            dispatch({ type: "SET_GAME_OVER_MODAL", isOpen: true });

            if (won) {
               triggerToast(
                  message || state.gameMessage,
                  TOAST_DURATION.LONG + 1000,
               );
            }
         }, revealDelay);
      }
   }, [
      state.isGameOver,
      state.currentGuess,
      state.guesses,
      state.usedHint,
      state.hintRecord,
      state.gameMessage,
      config,
      date,
      user,
      preferences.allowRoasts,
      triggerToast,
      updateOptimistically,
      refresh,
      performSync,
      ask,
      loadFromCloud,
   ]);

   const handleHint = useCallback(async () => {
      if (state.guesses.length < 2 || state.isGameOver || state.usedHint)
         return;
      if (state.guesses.length >= config.maxAttempts - 1) {
         triggerToast("Hint locked on last available guess.");
         return;
      }
      if (isHintDisabled(config.word, state.guesses)) {
         triggerToast("Hint disabled: Only one letter remains!");
         return;
      }

      const hint = getHint(config.word, state.guesses);
      if (hint) {
         const hintWithRow = { ...hint, row: state.guesses.length };

         const payload = {
            date,
            isGuest: !user,
            guesses: state.guesses,
            letterStatuses: getLetterStatuses(state.guesses),
            status: "playing",
            usedHint: true,
            hintRecord: hintWithRow,
            config,
         };

         // 1. Save locally FIRST with obfuscation
         const localSalt = getLocalSalt(date, user?.id);
         const savedPayload = {
            ...payload,
            config: {
               ...payload.config,
               word: obfuscateWord(payload.config.word, localSalt),
            },
         };
         safeLocalStorage.setItem(
            `wordle-${date}`,
            JSON.stringify(savedPayload),
         );

         // 2. Update UI
         dispatch({ type: "SET_HINT", hint: hintWithRow });

         if (user) {
            const success = await performSync(payload);
            if (!success) {
               triggerToast(
                  "Sync failed after 3 attempts. Hint saved locally.",
               );
            }
         }
         triggerToast(`Hint: "${hint.letter}" at position ${hint.index + 1}.`);
      }
   }, [
      state.guesses,
      state.isGameOver,
      state.usedHint,
      config,
      date,
      user,
      triggerToast,
      performSync,
   ]);

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

   const setGameOverModalOpen = useCallback((isOpen: boolean) => {
      dispatch({ type: "SET_GAME_OVER_MODAL", isOpen });
   }, []);

   const loadState = useCallback((payload: Partial<typeof initialState>) => {
      dispatch({ type: "LOAD_STATE", payload });
   }, []);

   const letterStatuses = useMemo(
      () => getLetterStatuses(state.guesses),
      [state.guesses],
   );
   const isHintBar1Restricted = useMemo(
      () => isHintDisabled(config.word, state.guesses),
      [config.word, state.guesses],
   );

   return {
      state: { ...state, letterStatuses, isHintDisabled: isHintBar1Restricted },
      actions: {
         onChar,
         onDelete,
         onEnter,
         handleHint,
         retrySync,
         setGameOverModalOpen,
         loadState,
      },
      config,
      isHydrated,
   };
};
