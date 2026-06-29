/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useCallback } from 'react';
import { useChallengeStore } from '../../store/useChallengeStore';

interface UseTimerProps {
   timeLeft: number | null;
   isGameOver: boolean;
   dispatch: React.Dispatch<any>;
   isSaving: boolean;
   setIsSaving: (val: boolean) => void;
   triggerToast: (msg: string, duration?: number) => void;
   challenge: any;
   effectiveMaxTime: number | null;
   isMarathon: boolean;
   guesses: any[];
   usedHint: boolean;
   hintRecord: any;
   wordLength: number;
   gameIndex: number | null | undefined;
   wrappedSubmitResult: (payload: any, wordLen?: number, gIdx?: number) => Promise<boolean>;
   onLengthComplete?: () => void;
   onFinish: () => void;
}

export const useTimer = ({
   timeLeft,
   isGameOver,
   dispatch,
   isSaving,
   setIsSaving,
   triggerToast,
   challenge,
   effectiveMaxTime,
   isMarathon,
   guesses,
   usedHint,
   hintRecord,
   wordLength,
   gameIndex,
   wrappedSubmitResult,
   onLengthComplete,
   onFinish,
}: UseTimerProps) => {
   const setTimeLeftStore = useChallengeStore((state) => state.setTimeLeft);

   const handleTimeExpired = useCallback(async () => {
      if (isSaving) return;
      dispatch({ type: "TIME_UP" });
      triggerToast("Time's up!", 3000);
      setIsSaving(true);

      try {
         let timeTaken: number | null = null;
         if (challenge.mode === "LIVE" && effectiveMaxTime) {
            timeTaken = effectiveMaxTime * 60; // Max time used if expired
         }

         if (isMarathon) {
            const success = await wrappedSubmitResult(
               {
                  status: "timed_out",
                  attempts: guesses.length,
                  guesses: guesses,
                  score: 0,
                  hints_used: usedHint,
                  hint_record: hintRecord,
                  time_taken: timeTaken,
               },
               wordLength,
               gameIndex!,
            );
            if (!success) triggerToast("Failed to save progress.", 3000);
            if (onLengthComplete) onLengthComplete();
         } else {
            const success = await wrappedSubmitResult({
               status: "timed_out",
               score: 0,
               attempts: guesses.length,
               guesses: guesses,
               hints_used: usedHint,
               hint_record: hintRecord,
               time_taken: timeTaken,
            });
            if (!success) triggerToast("Failed to save result.", 4000);
            onFinish();
         }
      } finally {
         setIsSaving(false);
      }
   }, [
      isSaving,
      dispatch,
      triggerToast,
      setIsSaving,
      challenge.mode,
      effectiveMaxTime,
      isMarathon,
      wrappedSubmitResult,
      guesses,
      usedHint,
      hintRecord,
      wordLength,
      gameIndex,
      onLengthComplete,
      onFinish,
   ]);

   // Sync timeLeft with Global Store
   useEffect(() => {
      setTimeLeftStore(timeLeft);
      return () => setTimeLeftStore(null);
   }, [timeLeft, setTimeLeftStore]);

   // Timer Interval Management
   useEffect(() => {
      if (timeLeft !== null && timeLeft > 0 && !isGameOver) {
         const interval = window.setInterval(() => {
            dispatch({ type: "TICK_TIMER" });
         }, 1000);
         return () => clearInterval(interval);
      }
   }, [isGameOver, timeLeft, dispatch]);

   useEffect(() => {
      if (timeLeft === 0 && !isGameOver) {
         handleTimeExpired();
      }
   }, [timeLeft, isGameOver, handleTimeExpired]);

   return { handleTimeExpired };
};
