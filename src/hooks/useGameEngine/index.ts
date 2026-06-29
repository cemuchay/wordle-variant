/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { GameConfig } from "../../types/game";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../useAuth";
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

export const useGameEngine = (date: string) => {
   const [state, dispatch] = useReducer(gameReducer, initialState);
   const [isHydrated, setIsHydrated] = useState(false);
   const [config, setConfig] = useState<GameConfig | null>(null);
   const [isConfigLoading, setIsConfigLoading] = useState(false);
   const hydratedUserRef = useRef<string | undefined>(undefined);
   const hydratedDateRef = useRef<string | null>(null);
   const hydratedConfigWordRef = useRef<string | undefined>(undefined);
   const { user, loading: isAuthLoading } = useAuth();
   const { triggerToast, preferences } = useApp();
   const { ask } = useConfirmation();

   useEffect(() => {
      if (!date) return;
      setIsConfigLoading(true);
      getDailyConfig(!!user, date).then((cfg) => {
         setConfig(cfg);
         setIsConfigLoading(false);
      });
   }, [date, user]);

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
      if (!date || !config || isAuthLoading || isConfigLoading) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setIsHydrated(false);
         return;
      }

      const isUserOrDateChanged =
         hydratedUserRef.current !== user?.id ||
         hydratedDateRef.current !== date ||
         hydratedConfigWordRef.current !== config?.word;
      const isTriggeredByVisibility =
         rehydrateTrigger !== lastProcessedTriggerRef.current;
      lastProcessedTriggerRef.current = rehydrateTrigger;

      if (isHydrated && !isUserOrDateChanged && !isTriggeredByVisibility) {
         return;
      }

      if (isUserOrDateChanged || !isHydrated) {
         setIsHydrated(false);
      }

      hydratedUserRef.current = user?.id;
      hydratedDateRef.current = date;
      hydratedConfigWordRef.current = config?.word;
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
      () => config ? isHintDisabled(config.word, state.guesses) : false,
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
