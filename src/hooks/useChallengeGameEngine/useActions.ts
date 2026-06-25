/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useRef } from "react";
import { getWordLists } from "../../data/words";
import {
   checkGuess,
   getLetterStatuses,
   calculateSkillIndex,
   getShapeShifterFeedbackAndWord,
   isHintDisabled,
   getHint,
} from "../../lib/game-logic";
import { ANIMATION_DURATION } from "../../constants/ui";
import { logger } from "../../lib/logger";
import returnAnimationTime from "../../utils/returnAnimationTime";

interface UseActionsProps {
   state: any;
   dispatch: React.Dispatch<any>;
   isGameOver: boolean;
   isSaving: boolean;
   wordLength: number;
   targetWord: string;
   guesses: any[];
   triggerToast: (msg: string, duration?: number) => void;
   ask: (params: any) => Promise<boolean>;
   challenge: any;
   targetWords: string[];
   setTargetWords: (words: string[]) => void;
   setActiveTargetWord: (word: string) => void;
   initialTargetWord: string;
   maxAttempts: number;
   setIsSaving: (val: boolean) => void;
   setRetryCount: (val: number) => void;
   effectiveMaxTime: number | null;
   isMarathon: boolean;
   gameIndex: number | null | undefined;
   wrappedSubmitResult: (
      payload: any,
      wordLen?: number,
      gIdx?: number,
   ) => Promise<boolean>;
   saveToLocal: (payload: any, needsSync?: boolean) => void;
   onLengthComplete?: () => void;
   onFinish: () => void;
   setSyncFailed: (val: boolean) => void;
   lastPayloadRef: React.MutableRefObject<any>;
   usedHint: boolean;
   hintRecord: any;
   retrySync: () => Promise<void>;
}

export const useActions = ({
   state,
   dispatch,
   isGameOver,
   isSaving,
   wordLength,
   targetWord,
   guesses,
   triggerToast,
   ask,
   challenge,
   targetWords,
   setTargetWords,
   setActiveTargetWord,
   initialTargetWord,
   maxAttempts,
   setIsSaving,
   setRetryCount,
   effectiveMaxTime,
   isMarathon,
   gameIndex,
   wrappedSubmitResult,
   saveToLocal,
   onLengthComplete,
   onFinish,
   setSyncFailed,
   lastPayloadRef,
   usedHint,
   hintRecord,
   retrySync,
}: UseActionsProps) => {
   const isSubmittingRef = useRef(false);

   const onChar = useCallback(
      (char: string) => {
         if (isGameOver) return;
         dispatch({ type: "TYPE_CHAR", char, wordLength });
      },
      [isGameOver, dispatch, wordLength],
   );

   const onDelete = useCallback(() => {
      if (isGameOver) return;
      dispatch({ type: "DELETE_CHAR" });
   }, [isGameOver, dispatch]);

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
      if (isGameOver || isSaving || state.currentGuess.length !== wordLength)
         return;
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      try {
         const upperGuess = state.currentGuess.toUpperCase();

         const { valid } = getWordLists(wordLength);
         if (!valid.has(upperGuess)) {
            triggerToast("Not in word list.");
            dispatch({ type: "SHAKE_GUESS" });
            setTimeout(
               () => dispatch({ type: "STOP_SHAKE" }),
               ANIMATION_DURATION.SHAKE,
            );
            return;
         }

         const alreadyGuessed = guesses.some((guess: any) => {
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

         let result = checkGuess(upperGuess, targetWord);
         let finalTargetWord = targetWord;
         const updatedTargetWords = [...targetWords];

         if (challenge.is_shapeshifter) {
            const shiftResult = getShapeShifterFeedbackAndWord(
               upperGuess,
               targetWord,
               guesses,
               wordLength,
               hintRecord,
            );
            result = shiftResult.feedback;
            finalTargetWord = shiftResult.nextWord;

            if (updatedTargetWords.length === 0) {
               updatedTargetWords.push(initialTargetWord);
            }
            updatedTargetWords.push(finalTargetWord);

            setTargetWords(updatedTargetWords);
            setActiveTargetWord(finalTargetWord);
         }

         const newGuesses = [...guesses, result];
         const newStatuses = getLetterStatuses(newGuesses);
         const won = upperGuess === finalTargetWord;
         const lost = newGuesses.length === maxAttempts;

         dispatch({
            type: "SUBMIT_GUESS",
            newGuesses,
            newStatuses,
            isWon: won,
            isLost: lost,
         });

         setIsSaving(true);
         setRetryCount(0);

         let timeTaken: number | null = null;
         if (
            challenge.mode === "LIVE" &&
            effectiveMaxTime &&
            state.timeLeft !== null
         ) {
            timeTaken = effectiveMaxTime * 60 - state.timeLeft;
         }

         let resultPayload: any;
         if (isMarathon) {
            if (won || lost) {
               const skillScore = calculateSkillIndex({
                  attempts: newGuesses.length,
                  maxAttempts: maxAttempts,
                  usedHint: usedHint,
                  guesses: newGuesses,
                  gameDate: new Date().toISOString().split("T")[0],
                  hintRecord: hintRecord,
               }).finalScore;
               resultPayload = {
                  status: "completed",
                  score: skillScore,
                  attempts: newGuesses.length,
                  guesses: newGuesses,
                  hints_used: usedHint,
                  hint_record: hintRecord,
                  time_taken: timeTaken,
                  ...(challenge.is_shapeshifter
                     ? { target_words: updatedTargetWords }
                     : {}),
               };
            } else {
               resultPayload = {
                  status: "playing",
                  guesses: newGuesses,
                  attempts: newGuesses.length,
                  hints_used: usedHint,
                  hint_record: hintRecord,
                  ...(challenge.is_shapeshifter
                     ? { target_words: updatedTargetWords }
                     : {}),
               };
            }
         } else {
            if (won || lost) {
               const skillScore = calculateSkillIndex({
                  attempts: newGuesses.length,
                  maxAttempts: maxAttempts,
                  usedHint: usedHint,
                  guesses: newGuesses,
                  gameDate: new Date().toISOString().split("T")[0],
                  hintRecord: hintRecord,
               }).finalScore;
               resultPayload = {
                  status: "completed",
                  score: skillScore,
                  attempts: newGuesses.length,
                  guesses: newGuesses,
                  hints_used: usedHint,
                  hint_record: hintRecord,
                  time_taken: timeTaken,
                  ...(challenge.is_shapeshifter
                     ? { target_words: updatedTargetWords }
                     : {}),
               };
            } else {
               resultPayload = {
                  status: "playing",
                  score: 0,
                  attempts: newGuesses.length,
                  guesses: newGuesses,
                  hints_used: usedHint,
                  hint_record: hintRecord,
                  ...(challenge.is_shapeshifter
                     ? { target_words: updatedTargetWords }
                     : {}),
               };
            }
         }

         // Save to localStorage immediately for robustness
         saveToLocal(resultPayload);

         let success = false;
         let attempt = 0;
         const maxSyncAttempts = 3;

         try {
            while (attempt < maxSyncAttempts && !success) {
               if (attempt > 0) {
                  setRetryCount(attempt);
                  await new Promise((r) => setTimeout(r, 1500));
               }
               success = await wrappedSubmitResult(
                  resultPayload,
                  isMarathon ? wordLength : undefined,
                  isMarathon ? gameIndex! : undefined,
               );
               attempt++;
            }
         } catch (e) {
            logger.error("[Engine] Error during guess submission sync", {
               error: e,
            });
            success = false;
         }

         setIsSaving(false);
         setRetryCount(0);

         if (!success) {
            setSyncFailed(true);
            lastPayloadRef.current = {
               payload: resultPayload,
               wordLen: isMarathon ? wordLength : undefined,
               gIdx: isMarathon ? gameIndex! : undefined,
            };
            triggerToast("Sync failed. Check connection.", 5000);
         } else {
            setSyncFailed(false);
            lastPayloadRef.current = null;
         }

         if (won || lost) {
            const transitionDelay = returnAnimationTime(wordLength) + 600;

            setTimeout(() => {
               dispatch({ type: "STOP_REVEALING" });
               triggerToast(
                  won ? "Completed! 🎉" : `The word was ${targetWord}`,
                  5000,
               );
               if (isMarathon) {
                  if (onLengthComplete) onLengthComplete();
               } else {
                  onFinish();
               }
            }, transitionDelay);
         } else {
            const transitionDelay = returnAnimationTime(wordLength) + 600;
            setTimeout(() => {
               dispatch({ type: "STOP_REVEALING" });
            }, transitionDelay);
         }
      } finally {
         isSubmittingRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [
      isGameOver,
      state.currentGuess,
      state.timeLeft,
      wordLength,
      targetWord,
      guesses,
      challenge.mode,
      challenge.is_shapeshifter,
      effectiveMaxTime,
      isMarathon,
      triggerToast,
      usedHint,
      hintRecord,
      wrappedSubmitResult,
      saveToLocal,
      onLengthComplete,
      onFinish,
      ask,
      gameIndex,
      dispatch,
      targetWords,
      initialTargetWord,
      setTargetWords,
      setActiveTargetWord,
      maxAttempts,
      setIsSaving,
      setRetryCount,
      setSyncFailed,
      lastPayloadRef,
   ]);

   const handleHint = useCallback(async () => {
      if (isGameOver || usedHint) return;

      if (challenge.disable_hints) {
         triggerToast("Hints are disabled for this challenge.");
         return;
      }

      if (guesses.length >= 5) {
         triggerToast("Hint locked on last available guess.");
         return;
      }
      if (isHintDisabled(targetWord, guesses)) {
         triggerToast("Hint disabled: Only one letter remains!");
         return;
      }
      if (guesses.length < 2) {
         triggerToast("Hint unlocks after 2 attempts.", 3000);
         return;
      }

      const hint = getHint(targetWord, guesses);
      if (hint) {
         const hintWithRow = { ...hint, row: guesses.length };
         dispatch({ type: "SET_HINT", hint: hintWithRow });
         triggerToast(
            `Hint: "${hint.letter}" at position ${hint.index + 1}.`,
            5000,
         );

         setIsSaving(true);
         let resultPayload: any;
         if (isMarathon) {
            resultPayload = {
               status: "playing",
               guesses: guesses,
               attempts: guesses.length,
               hints_used: true,
               hint_record: hintWithRow,
               ...(challenge.is_shapeshifter
                  ? { target_words: targetWords }
                  : {}),
            };
         } else {
            resultPayload = {
               status: "playing",
               score: 0,
               attempts: guesses.length,
               guesses: guesses,
               hints_used: true,
               hint_record: hintWithRow,
               ...(challenge.is_shapeshifter
                  ? { target_words: targetWords }
                  : {}),
            };
         }
         try {
            const success = await wrappedSubmitResult(
               resultPayload,
               isMarathon ? wordLength : undefined,
               isMarathon ? gameIndex! : undefined,
            );
            setIsSaving(false);
            if (!success) triggerToast("Failed to save hint usage.", 3000);
         } catch (e) {
            logger.error("[Engine] Error in handleHint sync", { error: e });
            setIsSaving(false);
            triggerToast("Failed to save hint usage.", 3000);
         }
      }
   }, [
      isGameOver,
      usedHint,
      challenge.disable_hints,
      guesses,
      targetWord,
      triggerToast,
      dispatch,
      setIsSaving,
      isMarathon,
      wordLength,
      gameIndex,
      wrappedSubmitResult,
   ]);

   const actions = useMemo(
      () => ({
         onChar,
         onDelete,
         onEnter,
         handleHint,
         retrySync,
         onSetCursor,
         onSetEditIndex,
         onCursorLeft,
         onCursorRight,
      }),
      [
         onChar,
         onDelete,
         onEnter,
         handleHint,
         retrySync,
         onSetCursor,
         onSetEditIndex,
         onCursorLeft,
         onCursorRight,
      ],
   );

   return { actions };
};
