import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { GameConfig } from "../../types/game";
import type { User } from "@supabase/supabase-js";
import { useApp } from "../../context/AppContext";
import {
   getDailyConfig,
   getLetterStatuses,
   isHintDisabled,
   obfuscateWord,
   deobfuscateWord,
} from "../../lib/game-logic";
import { gameReducer, initialState } from "../../reducers/gameReducer";
import { useWordleStats } from "../useStats";
import { useConfirmation } from "../../context/ConfirmationContext";

import { safeLocalStorage } from "../../utils/storage";
import { getLocalSalt, areGuessesCoherent } from "./utils";
import { usePersistence } from "./usePersistence";
import { useActions } from "./useActions";

export const useGameEngine = (
   date: string,
   user: User | null,
   isAuthLoading: boolean,
) => {
   const [state, dispatch] = useReducer(gameReducer, initialState, () => {
      if (!date || isAuthLoading) return initialState;
      const saved = safeLocalStorage.getItem(`wordle-${date}`);
      const lastTimestamp = safeLocalStorage.getItem(
         "wordle_last_hydrated_timestamp",
      );
      const isSameDay = date && lastTimestamp?.startsWith(date);
      if (!saved || !isSameDay) return initialState;

      try {
         const payload = JSON.parse(saved);
         if (payload.config?.word) {
            const localSalt = getLocalSalt(date, user?.id);
            payload.config.word = deobfuscateWord(
               payload.config.word,
               localSalt,
            );
         }
         return {
            ...initialState,
            ...payload,
         };
      } catch {
         return initialState;
      }
   });

   const [isHydrated, setIsHydrated] = useState(() => {
      if (!date || isAuthLoading) return false;
      const saved = safeLocalStorage.getItem(`wordle-${date}`);
      const lastTimestamp = safeLocalStorage.getItem(
         "wordle_last_hydrated_timestamp",
      );
      const isSameDay = date && lastTimestamp?.startsWith(date);
      if (saved && isSameDay) {
         return true;
      }
      return false;
   });

   const [config, setConfig] = useState<GameConfig | null>(() => {
      if (!date || isAuthLoading) return null;
      const saved = safeLocalStorage.getItem(`wordle-${date}`);
      const lastTimestamp = safeLocalStorage.getItem(
         "wordle_last_hydrated_timestamp",
      );
      const isSameDay = date && lastTimestamp?.startsWith(date);
      if (saved && isSameDay) {
         try {
            const payload = JSON.parse(saved);
            if (payload.config?.word) {
               const localSalt = getLocalSalt(date, user?.id);
               payload.config.word = deobfuscateWord(
                  payload.config.word,
                  localSalt,
               );
            }
            return payload.config;
         } catch {
            return null;
         }
      }
      return null;
   });

   const [isConfigLoading, setIsConfigLoading] = useState(false);
   const hydratedUserRef = useRef<string | undefined>(user?.id);
   const hydratedDateRef = useRef<string | null>(date);
   const hydratedConfigWordRef = useRef<string | undefined>(
      config?.word || undefined,
   );
   const cachedHydrationDoneRef = useRef(isHydrated);
   const { triggerToast, preferences } = useApp();
   const { ask } = useConfirmation();

   // EARLY: Cache-first hydration — render immediately if saved state exists for today
   useEffect(() => {
      if (!date || isAuthLoading || cachedHydrationDoneRef.current) return;
      const saved = safeLocalStorage.getItem(`wordle-${date}`);
      const lastTimestamp = safeLocalStorage.getItem(
         "wordle_last_hydrated_timestamp",
      );
      const isSameDay = date && lastTimestamp?.startsWith(date);
      if (!saved || !isSameDay) return;

      try {
         const payload = JSON.parse(saved);
         const savedIsGuest = !!payload.isGuest;
         const currentIsGuest = !user;
         if (savedIsGuest !== currentIsGuest) return;

         if (payload.config?.word) {
            const localSalt = getLocalSalt(date, user?.id);
            payload.config.word = deobfuscateWord(
               payload.config.word,
               localSalt,
            );
         }
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setConfig(payload.config);
         dispatch({ type: "LOAD_STATE", payload });
         setIsHydrated(true);
         cachedHydrationDoneRef.current = true;
      } catch {
         // Cache corrupted — fall through to normal hydration
      }
   }, [date, isAuthLoading, user]);

   useEffect(() => {
      if (!date) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsConfigLoading(true);
      getDailyConfig(!!user, date)
         .then((cfg) => {
            setConfig(cfg);
         })
         .catch((err) => {
            console.error("Failed to fetch daily config:", err);
            triggerToast(
               "Connection error: using offline game configuration.",
               4000,
            );
         })
         .finally(() => {
            setIsConfigLoading(false);
         });
   }, [date, user, triggerToast]);

   const { refresh, updateOptimistically } = useWordleStats(user, false, date);

   const { performSync, loadFromCloud, retrySync } = usePersistence({
      user,
      date,
      dispatch,
      config,
      triggerToast,
   });

   const actionsProps = useActions({
      state,
      dispatch,
      config,
      date,
      user,
      preferences,
      triggerToast,
      ask,
      performSync,
      updateOptimistically,
      refresh,
   });

   // Hydration & Authentication Swap Logic
   const [rehydrateTrigger, setRehydrateTrigger] = useState(0);
   const lastProcessedTriggerRef = useRef(0);

   useEffect(() => {
      const handleRehydrate = () => {
         setRehydrateTrigger((prev) => prev + 1);
      };
      window.addEventListener("app-visibility-visible", handleRehydrate);
      return () =>
         window.removeEventListener("app-visibility-visible", handleRehydrate);
   }, []);

   useEffect(() => {
      if (
         !date ||
         (!config && !cachedHydrationDoneRef.current) ||
         isAuthLoading ||
         isConfigLoading
      ) {
         if (!cachedHydrationDoneRef.current) {
            setIsHydrated(false);
         }
         return;
      }

      const isDateChanged =
         hydratedDateRef.current !== null && hydratedDateRef.current !== date;
      const isUserOrConfigChanged =
         hydratedUserRef.current !== user?.id ||
         hydratedConfigWordRef.current !== config?.word;
      const isUserOrDateChanged = isDateChanged || isUserOrConfigChanged;
      const isTriggeredByVisibility =
         rehydrateTrigger !== lastProcessedTriggerRef.current;
      lastProcessedTriggerRef.current = rehydrateTrigger;

      if (isHydrated && !isUserOrDateChanged && !isTriggeredByVisibility) {
         if (!cachedHydrationDoneRef.current) return;
         cachedHydrationDoneRef.current = false;
      }

      if (
         isDateChanged ||
         (isUserOrConfigChanged && !cachedHydrationDoneRef.current) ||
         !isHydrated
      ) {
         setIsHydrated(false);
      }

      hydratedUserRef.current = user?.id;
      hydratedDateRef.current = date;
      hydratedConfigWordRef.current = config?.word;
      const saved = safeLocalStorage.getItem(`wordle-${date}`);

      const hydrate = async () => {
         const currentConfig = config!;
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
               if (
                  payload.config &&
                  payload.config.word !== currentConfig.word
               ) {
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
                           dispatch({ type: "LOAD_STATE", payload });
                           performSync(payload);
                        } else {
                           // Equal and coherent
                           dispatch({ type: "LOAD_STATE", payload });
                        }
                     } else {
                        // Conflict/tampering: overwrite local with cloud data (cloud is authoritative)
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
         safeLocalStorage.setItem(
            "wordle_last_hydrated_timestamp",
            `${date}_${Date.now()}`,
         );
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
      isHydrated,
      rehydrateTrigger,
   ]);

   const letterStatuses = useMemo(
      () => getLetterStatuses(state.guesses),
      [state.guesses],
   );
   const isHintBar1Restricted = useMemo(
      () => (config ? isHintDisabled(config.word, state.guesses) : false),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [config?.word, state.guesses],
   );

   return {
      state: { ...state, letterStatuses, isHintDisabled: isHintBar1Restricted },
      actions: {
         ...actionsProps,
         retrySync,
      },
      config,
      isHydrated,
   };
};
