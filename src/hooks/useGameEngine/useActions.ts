/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef } from 'react';
import { getWordLists } from '../../data/words';
import { checkGuess, getLetterStatuses, isHintDisabled, getHint, updateStats, obfuscateWord } from '../../lib/game-logic';
import { generateRoast } from '../../utils/roastEngine';
import returnAnimationTime from '../../utils/returnAnimationTime';
import { TOAST_DURATION, ANIMATION_DURATION } from '../../constants/ui';
import { ANIMATION } from '../../constants/game';
import { safeLocalStorage } from '../../utils/storage';
import { getLocalSalt } from './utils';

interface UseActionsProps {
   state: any;
   dispatch: React.Dispatch<any>;
   config: any;
   date: string;
   user: any;
   preferences: any;
   triggerToast: (msg: string, duration?: number) => void;
   ask: (params: any) => Promise<boolean>;
   performSync: (payload: any) => Promise<boolean>;
   updateOptimistically: (stats: any) => void;
   refresh: () => Promise<void>;
   loadFromCloud: () => Promise<any>;
}

export const useActions = ({
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
   loadFromCloud,
}: UseActionsProps) => {
   const isSubmittingRef = useRef(false);

   const onChar = useCallback(
      (char: string) => {
         dispatch({ type: "ADD_LETTER", char, maxLength: config.length });
      },
      [dispatch, config.length],
   );

    const onDelete = useCallback(() => {
      dispatch({ type: "DELETE_LETTER" });
    }, [dispatch]);

    const onSetCursor = useCallback(
      (index: number) => {
        dispatch({ type: "SET_CURSOR", index });
      },
      [dispatch],
    );

    const onCursorLeft = useCallback(() => {
      const newIdx = Math.max(0, state.cursorIndex - 1);
      dispatch({ type: "SET_CURSOR", index: newIdx });
    }, [state.cursorIndex, dispatch]);

    const onCursorRight = useCallback(() => {
      const newIdx = Math.min(state.currentGuess.length, state.cursorIndex + 1);
      dispatch({ type: "SET_CURSOR", index: newIdx });
    }, [state.cursorIndex, state.currentGuess.length, dispatch]);

   const onEnter = useCallback(async () => {
      if (state.isGameOver || state.currentGuess.length !== config.length)
         return;

      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      try {
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
            setTimeout(() => dispatch({ type: "STOP_SHAKE" }), ANIMATION_DURATION.SHAKE);
            return;
         }

         const alreadyGuessed = state.guesses.some((guess: any) => {
            const word = guess
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
                  TOAST_DURATION.LONG + ANIMATION.SYNC_FAIL_TOAST_EXTRA,
               );
            }
         }

         // Stabilization Delay: Wait after sync attempt before triggering reveal
         await new Promise((r) => setTimeout(r, ANIMATION.STABILIZATION_DELAY));

         // Calculate delay: use returnAnimationTime + extra buffer for safety
          const revealDelay = returnAnimationTime(config.length) + ANIMATION.REVEAL_BUFFER;

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

            if (lost) {
               triggerToast(
                  `The word is: ${config.word}`,
                  TOAST_DURATION.LONG + ANIMATION.SYNC_FAIL_TOAST_EXTRA,
               );
            }

            setTimeout(() => {
               dispatch({ type: "STOP_REVEALING" });
               dispatch({ type: "SET_GAME_OVER_MODAL", isOpen: true });

               if (won) {
                  triggerToast(
                     message || state.gameMessage,
                     TOAST_DURATION.LONG + ANIMATION.SYNC_FAIL_TOAST_EXTRA,
                  );
               }
            }, revealDelay);
         } else {
            setTimeout(() => {
               dispatch({ type: "STOP_REVEALING" });
            }, revealDelay);
         }
      } finally {
         isSubmittingRef.current = false;
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
      dispatch,
   ]);

   const handleHint = useCallback(async () => {
      if (state.guesses.length < ANIMATION.HINT_MIN_GUESSES || state.isGameOver || state.usedHint)
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
      dispatch,
   ]);

   const setGameOverModalOpen = useCallback((isOpen: boolean) => {
      dispatch({ type: "SET_GAME_OVER_MODAL", isOpen });
   }, [dispatch]);

   const loadState = useCallback((payload: any) => {
      dispatch({ type: "LOAD_STATE", payload });
   }, [dispatch]);

    return {
      onChar,
      onDelete,
      onEnter,
      handleHint,
      setGameOverModalOpen,
      loadState,
      onSetCursor,
      onCursorLeft,
      onCursorRight,
    };
};

import { supabase } from '../../lib/supabaseClient';
