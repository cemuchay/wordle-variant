/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback } from 'react';
import { logger } from '../../lib/logger';
import { safeLocalStorage } from '../../utils/storage';
import { encryptGuesses } from '../../lib/game-logic';
import type { NetworkLog } from './types';

interface UsePersistenceProps {
   challenge: any;
   storageKey: string;
   targetWord: string;
   isMarathon: boolean;
   activeGame: any;
   submitChallengeResult: (result: any, wordLength?: number, gameIndex?: number) => Promise<boolean>;
   triggerToast: (msg: string, duration?: number) => void;
}

export const usePersistence = ({
   challenge,
   storageKey,
   targetWord,
   isMarathon,
   activeGame,
   submitChallengeResult,
   triggerToast,
}: UsePersistenceProps) => {
   const [isSaving, setIsSaving] = useState(false);
   const [syncFailed, setSyncFailed] = useState(false);
   const [retryCount, setRetryCount] = useState(0);
   const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
   const lastPayloadRef = useRef<{ payload: any; wordLen?: number; gIdx?: number } | null>(null);

   const addLog = useCallback((msg: string, duration?: number) => {
      setNetworkLogs((prev) => [
         ...prev,
         { id: Math.random().toString(36).substr(2, 9), msg, duration },
      ]);
   }, []);

   const saveToLocal = useCallback(
      (payload: any, needsSync = false) => {
         try {
            const existing = safeLocalStorage.getItem(storageKey);
            const existingParsed = existing ? JSON.parse(existing) : {};
            const finalPayload = {
               ...existingParsed,
               ...payload,
               needsSync,
               timestamp: Date.now(),
            };
            safeLocalStorage.setItem(storageKey, JSON.stringify(finalPayload));
         } catch (e) {
            logger.error("Local save failed", { key: storageKey, error: e });
         }
      },
      [storageKey],
   );

   const wrappedSubmitResult = useCallback(
      async (payload: any, wordLen?: number, gIdx?: number) => {
         const start = Date.now();
         addLog(`Sync Start: ${payload.status}`);

         saveToLocal(payload);

         const dbPayload = { ...payload };
         delete dbPayload.needsSync;
         delete dbPayload.timestamp;

         const activeWord = challenge.is_shapeshifter
            ? payload.target_words && payload.target_words.length > 0
               ? payload.target_words[payload.target_words.length - 1]
               : targetWord
            : targetWord;

         if (dbPayload.guesses && activeWord) {
            const key = activeWord + (challenge.salt || "");
            dbPayload.guesses = encryptGuesses(dbPayload.guesses, key);
         }

         const success = await submitChallengeResult(dbPayload, wordLen, gIdx);
         const duration = Date.now() - start;
         addLog(`Sync End: ${success ? "Success" : "Failed"}`, duration);

         if (!success) {
            saveToLocal(payload, true);
         } else {
            try {
               const saved = safeLocalStorage.getItem(storageKey);
               if (saved) {
                  const parsed = JSON.parse(saved);
                  if (parsed.needsSync) {
                     delete parsed.needsSync;
                     safeLocalStorage.setItem(storageKey, JSON.stringify(parsed));
                  }
               }
            } catch (e) {
               logger.error("Failed to clear needsSync flag", { error: e });
            }
         }

         if (success && (payload.status === "completed" || payload.status === "timed_out")) {
            try {
               safeLocalStorage.removeItem(storageKey);
               if (isMarathon && activeGame) {
                  const legacyKey = `challenge-prog-${challenge.id}-m-${activeGame.wordLength}`;
                  safeLocalStorage.removeItem(legacyKey);
               }
            } catch (e) {
               logger.error("Local cleanup failed", { key: storageKey, error: e });
            }
         }

         return success;
      },
      [
         submitChallengeResult,
         addLog,
         saveToLocal,
         storageKey,
         isMarathon,
         activeGame,
         challenge.id,
         challenge.salt,
         targetWord,
      ],
   );

   const retrySync = useCallback(async () => {
      if (!syncFailed || !lastPayloadRef.current || isSaving) return;

      setIsSaving(true);
      setRetryCount(0);

      try {
         const { payload, wordLen, gIdx } = lastPayloadRef.current;
         const success = await wrappedSubmitResult(payload, wordLen, gIdx);

         if (success) {
            setSyncFailed(false);
            lastPayloadRef.current = null;
            triggerToast("Sync recovered!", 2000);
         } else {
            triggerToast("Sync failed again.", 3000);
         }
      } finally {
         setIsSaving(false);
      }
   }, [syncFailed, isSaving, wrappedSubmitResult, triggerToast]);

   return {
      isSaving,
      setIsSaving,
      syncFailed,
      setSyncFailed,
      retryCount,
      setRetryCount,
      networkLogs,
      addLog,
      saveToLocal,
      wrappedSubmitResult,
      retrySync,
      lastPayloadRef,
   };
};
