/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef } from "react";
import { loadWordLists } from "../../data/words";
import {
   checkGuess,
   getLetterStatuses,
   isHintDisabled,
   getHint,
   updateStats,
   obfuscateWord,
   calculateSkillIndex,
} from "../../lib/game-logic";
import { generateRoast } from "../../utils/roastEngine";
import returnAnimationTime from "../../utils/returnAnimationTime";
import { TOAST_DURATION, ANIMATION_DURATION } from "../../constants/ui";
import { ANIMATION, DEFAULT_WORD_LENGTH } from "../../constants/game";
import { getLocalSalt, saveGameWithBackup } from "./utils";
import { safeSessionStorage } from "@/utils/storage";
import { recordSocialActivity } from "../../services/socialActivityService";

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
}: UseActionsProps) => {
   const isSubmittingRef = useRef(false);

   const onChar = useCallback(
      (char: string) => {
         dispatch({
            type: "ADD_LETTER",
            char,
            maxLength: config?.length || DEFAULT_WORD_LENGTH,
         });
      },
      [dispatch, config?.length],
   );

   const onDelete = useCallback(() => {
      dispatch({ type: "DELETE_LETTER" });
   }, [dispatch]);

   const onClearRow = useCallback(() => {
      dispatch({ type: "RESET_CURRENT_GUESS" });
   }, [dispatch]);

   const onSetCursor = useCallback(
      (index: number) => {
         dispatch({ type: "SET_CURSOR", index });
      },
      [dispatch],
   );

   const onSetEditIndex = useCallback(
      (index: number | null) => {
         dispatch({ type: "SET_EDIT_INDEX", index });
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
      if (state.isGameOver || state.currentGuess.length !== config?.length)
         return;

      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      try {
         const upperGuess = state.currentGuess.toUpperCase();
         const { valid } = await loadWordLists(config.length);

         if (!valid.has(upperGuess)) {
            triggerToast("Not in word list.");
            dispatch({ type: "SHAKE_GUESS" });
            setTimeout(
               () => dispatch({ type: "STOP_SHAKE" }),
               ANIMATION_DURATION.SHAKE,
            );
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

         const submitTimestamp = Date.now();
         const result = checkGuess(upperGuess, config.word);
         const won = upperGuess === config.word;
         const lost = state.guesses.length + 1 === config.maxAttempts;

         const newGuesses = [...state.guesses, result];
         const newTimestamps = [
            ...(state.guessTimestamps || []),
            submitTimestamp,
         ];
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
            guessTimestamps: newTimestamps,
            guess_timestamps: newTimestamps,
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
         saveGameWithBackup(date, savedPayload);

         // 2. Update UI immediately (flips row) — show result instantly
         dispatch({
            type: "SUBMIT_GUESS",
            result,
            isWon: won,
            isLost: lost,
            message,
            timestamp: submitTimestamp,
         });

         // 3. Update local stats immediately on game over
         if (won || lost) {
            const updatedStats = updateStats(won, newGuesses.length);
            updateOptimistically(updatedStats);
            refresh();

            // Clear cached leaderboard in sessionStorage so today's leaderboard refreshes immediately
            try {
               safeSessionStorage.removeItem(
                  `wordle_global_leaderboard_today_${date}`,
               );
               safeSessionStorage.removeItem(
                  `wordle_global_leaderboard_yesterday_${date}`,
               );
               safeSessionStorage.removeItem(
                  `wordle_global_leaderboard_weekly_${date}`,
               );
               safeSessionStorage.removeItem(
                  `wordle_global_leaderboard_monthly_${date}`,
               );
            } catch (e) {
               console.warn("Session cache clear failed:", e);
            }

            // Immediately notify leaderboard snapshots & stats modal to refresh without waiting for cloud sync
            window.dispatchEvent(
               new CustomEvent("global-scores-updated", {
                  detail: { isBackground: false, isGameOver: true },
               }),
            );

            try {
               // Record game completion in daily telemetry
               import("../../lib/telemetry").then(({ trackGameCompleted }) => {
                  trackGameCompleted("main_daily");
               });
            } catch (e) {
               console.warn("Telemetry game completion tracking skipped:", e);
            }
         }

         // 4. Sync to cloud in background (not awaited) and emit real-time social activity
         if (user) {
            performSync(payload).then((success) => {
               if (!success) {
                  triggerToast(
                     "Cloud sync failed after 3 attempts. Progress saved locally.",
                     TOAST_DURATION.LONG + ANIMATION.SYNC_FAIL_TOAST_EXTRA,
                  );
               }
            });

            // Record real-time guess or game_started activity
            const guessIdx = newGuesses.length - 1;
            if (guessIdx === 0) {
               recordSocialActivity({
                  userId: user.id,
                  gameDate: date,
                  category: "daily_game",
                  activityType: "game_started",
                  guessIndex: 0,
                  payload: {
                     guess_result: result,
                     all_guesses: newGuesses,
                     guess_number: 1,
                     total_attempts: config.maxAttempts || 6,
                     status: "playing",
                  },
                  metadata: {
                     word_length: config.length,
                  },
               });
            }

            // If won or lost, record game completion activity (with real calculated score and attached guesses)
            if (won || lost) {
               const calculatedScore = calculateSkillIndex({
                  attempts: newGuesses.length,
                  maxAttempts: config.maxAttempts || 6,
                  usedHint: state.usedHint,
                  guesses: newGuesses,
                  gameDate: date,
                  hintRecord: state.hintRecord,
               }).finalScore;

               recordSocialActivity({
                  userId: user.id,
                  gameDate: date,
                  category: "daily_game",
                  activityType: won ? "game_won" : "game_lost",
                  guessIndex: guessIdx,
                  payload: {
                     guess_result: result,
                     attempts: newGuesses.length,
                     all_guesses: newGuesses,
                     hints_used: state.usedHint,
                     total_score: calculatedScore,
                     skill_score: calculatedScore,
                     status: newStatus,
                  },
                  metadata: {
                     word_length: config.length,
                  },
               });
            }
         }

         // 5. Handle reveal timing (GameOverModal sunsetted - user stays on the rich Play screen)
         const revealDelay =
            returnAnimationTime(config.length) + ANIMATION.REVEAL_BUFFER;

         if (won || lost) {
            if (lost) {
               triggerToast(
                  `The word is: ${config.word}`,
                  TOAST_DURATION.EXTRA_LONG + ANIMATION.SYNC_FAIL_TOAST_EXTRA,
               );
            }

            setTimeout(() => {
               dispatch({ type: "STOP_REVEALING" });

               if (won) {
                  triggerToast(
                     message || state.gameMessage,
                     TOAST_DURATION.EXTRA_LONG +
                        ANIMATION.SYNC_FAIL_TOAST_EXTRA,
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
      dispatch,
   ]);

   const handleHint = useCallback(async () => {
      if (
         state.guesses.length < ANIMATION.HINT_MIN_GUESSES ||
         state.isGameOver ||
         state.usedHint
      )
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
         saveGameWithBackup(date, savedPayload);

         dispatch({ type: "SET_HINT", hint: hintWithRow });

         if (user) {
            performSync(payload).then((success) => {
               if (!success) {
                  triggerToast(
                     "Sync failed after 3 attempts. Hint saved locally.",
                  );
               }
            });

            // Record real-time hint activity with letter and position
            recordSocialActivity({
               userId: user.id,
               gameDate: date,
               category: "daily_game",
               activityType: "hint_used",
               guessIndex: null,
               payload: {
                  hint_record: hintWithRow,
                  letter: hint.letter,
                  position: hint.index + 1,
               },
               metadata: {
                  word_length: config.length,
               },
            });
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

   const loadState = useCallback(
      (payload: any) => {
         dispatch({ type: "LOAD_STATE", payload });
      },
      [dispatch],
   );

   return {
      onChar,
      onDelete,
      onClearRow,
      onEnter,
      handleHint,
      loadState,
      onSetCursor,
      onSetEditIndex,
      onCursorLeft,
      onCursorRight,
   };
};
