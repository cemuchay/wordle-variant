/* eslint-disable @typescript-eslint/no-explicit-any */
import {
   useCallback,
   useEffect,
   useReducer,
   useState,
   useMemo,
   useRef,
} from "react";
import {
   checkGuess,
   deobfuscateWord,
   getLetterStatuses,
   isHintDisabled,
   decryptGuesses,
} from "../../lib/game-logic";
import {
   challengeGameReducer,
   initialChallengeState,
} from "../../reducers/challengeReducer";
import { useConfirmation } from "../../context/ConfirmationContext";
import { logger } from "../../lib/logger";
import {
   parseMarathonGames,
   getMarathonTimer,
   getHandicapStarter,
} from "../../utils/marathon";
import { supabase } from "../../lib/supabaseClient";

import type { UseChallengeGameEngineProps } from "./types";
import { useBotWords } from "./useBotWords";
import { useTimer } from "./useTimer";
import { usePersistence } from "./usePersistence";
import { useActions } from "./useActions";
import { safeLocalStorage } from "../../utils/storage";

export const useChallengeGameEngine = ({
   challenge,
   participation,
   triggerToast,
   submitChallengeResult,
   onFinish,
   gameIndex,
   onLengthComplete,
}: UseChallengeGameEngineProps) => {
   const { ask } = useConfirmation();
   const isMarathon = challenge.word_length === 1;

   const marathonGames = useMemo(() => {
      if (!isMarathon) return [];
      return parseMarathonGames(challenge.target_word, challenge.salt);
   }, [challenge.target_word, isMarathon, challenge.salt]);

   const activeGame = useMemo(() => {
      if (!isMarathon || gameIndex === undefined || gameIndex === null)
         return null;
      return marathonGames[gameIndex] || null;
   }, [isMarathon, marathonGames, gameIndex]);

   const effectiveMaxTime = useMemo(() => {
      if (challenge.mode !== "LIVE") return null;
      if (
         !isMarathon ||
         gameIndex === undefined ||
         gameIndex === null ||
         !challenge.marathon_timers
      )
         return challenge.max_time;
      const activeLength = activeGame ? activeGame.wordLength : 5;
      return getMarathonTimer(challenge, gameIndex, activeLength);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [
      challenge.mode,
      challenge.max_time,
      challenge.marathon_timers,
      isMarathon,
      gameIndex,
      activeGame,
   ]);

   const [state, dispatch] = useReducer(challengeGameReducer, {
      ...initialChallengeState,
      guesses: [],
      letterStatuses: {},
      usedHint: false,
      hintRecord: null,
      status: participation?.status || "pending",
      isGameOver: false,
   });

   const { guesses, isGameOver, usedHint, hintRecord, timeLeft } =
      state;

   const currentKey = isMarathon ? `m-idx-${gameIndex}` : `r-${challenge.id}`;
   const storageKey = `challenge-prog-${challenge.id}-${currentKey}`;

   const { botDailyWords } = useBotWords(challenge, triggerToast);

   const wordLength = isMarathon
      ? activeGame
         ? activeGame.wordLength
         : 5
      : challenge.word_length;

   const maxAttempts = challenge.is_shapeshifter ? 10 : 6;

   const [targetWords, setTargetWords] = useState<string[]>([]);
   const [activeTargetWord, setActiveTargetWord] = useState<string>("");

   const initialTargetWord = useMemo(() => {
      if (challenge.is_bot_marathon && challenge.target_word === "MARATHON") {
         const botData = botDailyWords[wordLength];
         if (botData) {
            return deobfuscateWord(botData.word, botData.salt);
         }
         return "";
      }

      return isMarathon
         ? activeGame
            ? activeGame.word
            : ""
         : deobfuscateWord(challenge.target_word, challenge.salt);
   }, [
      isMarathon,
      activeGame,
      challenge.target_word,
      challenge.salt,
      challenge.is_bot_marathon,
      botDailyWords,
      wordLength,
   ]);

   const targetWord = challenge.is_shapeshifter
      ? activeTargetWord || initialTargetWord
      : initialTargetWord;

   const {
      isSaving,
      setIsSaving,
      syncFailed,
      setSyncFailed,
      retryCount,
      setRetryCount,
      networkLogs,
      addLog,
      wrappedSubmitResult,
      retrySync,
      lastPayloadRef,
   } = usePersistence({
      challenge,
      storageKey,
      targetWord,
      isMarathon,
      activeGame,
      submitChallengeResult,
      triggerToast,
   });

   const { handleTimeExpired } = useTimer({
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
   });

   const { actions } = useActions({
      state,
      dispatch,
      isGameOver,
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
      onLengthComplete,
      onFinish,
      setSyncFailed,
      lastPayloadRef,
      usedHint,
      hintRecord,
      retrySync,
   });

   const initializedRef = useRef<string>("");
   const startTimerRef = useRef(false);

   const getDecryptionKey = useCallback(
      (participationRecord: any) => {
         const salt = challenge.salt || "";
         if (challenge.is_shapeshifter && participationRecord) {
            let loadedTargetWords: string[];
            if (isMarathon) {
               const progress = participationRecord.marathon_progress?.find(
                  (p: any) =>
                     p.game_index === gameIndex ||
                     (p.game_index === undefined &&
                        p.word_length === activeGame?.wordLength),
               );
               loadedTargetWords = progress?.target_words || [];
            } else {
               loadedTargetWords = participationRecord.target_words || [];
            }
            if (loadedTargetWords.length > 0) {
               return loadedTargetWords[loadedTargetWords.length - 1] + salt;
            }
         }
         return initialTargetWord + salt;
      },
      [
         challenge.is_shapeshifter,
         challenge.salt,
         isMarathon,
         gameIndex,
         activeGame,
         initialTargetWord,
      ],
   );

   const getIncomingGuesses = useCallback(() => {
      if (!participation) return [];

      const key = targetWord + (challenge.salt || "");

      if (isMarathon) {
         if (gameIndex === undefined || gameIndex === null) return [];
         const progress = participation.marathon_progress?.find(
            (p: any) =>
               p.game_index === gameIndex ||
               (p.game_index === undefined &&
                  p.word_length === activeGame?.wordLength),
         );
         if (!progress) return [];
         return decryptGuesses(progress.guesses, key);
      }

      const g = participation.guesses;
      return decryptGuesses(g, key);
   }, [
      participation,
      isMarathon,
      gameIndex,
      activeGame,
      targetWord,
      challenge.salt,
   ]);

   // Initialization & State Sync
   useEffect(() => {
      if (isMarathon && (gameIndex === undefined || gameIndex === null)) return;
      if (initializedRef.current === currentKey) return;

      const initialize = async () => {
         setIsSaving(true);

         let loadedTargetWords: string[] = [];
         if (participation) {
            if (isMarathon) {
               const progress = participation.marathon_progress?.find(
                  (p: any) =>
                     p.game_index === gameIndex ||
                     (p.game_index === undefined &&
                        p.word_length === activeGame?.wordLength),
               );
               loadedTargetWords = progress?.target_words || [];
            } else {
               loadedTargetWords = participation.target_words || [];
            }
         }

         let localTargetWords = loadedTargetWords;
         try {
            const saved = safeLocalStorage.getItem(storageKey);
            if (saved) {
               const parsed = JSON.parse(saved);
               if (
                  parsed.target_words &&
                  parsed.target_words.length >= loadedTargetWords.length
               ) {
                  localTargetWords = parsed.target_words;
               }
            }
         } catch (e) {
            console.error("Local target words recovery failed", e);
         }

         if (challenge.is_shapeshifter) {
            const resolvedWords =
               localTargetWords.length > 0
                  ? localTargetWords
                  : [initialTargetWord];
            setTargetWords(resolvedWords);
            setActiveTargetWord(resolvedWords[resolvedWords.length - 1]);
         } else {
            setTargetWords([initialTargetWord]);
            setActiveTargetWord(initialTargetWord);
         }

         const key = getDecryptionKey(participation);

         let incoming: any[] = [];
         let serverHintRecord: any = null;

         if (participation) {
            if (isMarathon) {
               const progress = participation.marathon_progress?.find(
                  (p: any) =>
                     p.game_index === gameIndex ||
                     (p.game_index === undefined &&
                        p.word_length === activeGame?.wordLength),
               );
               if (progress) {
                  let progGuesses = progress.guesses;
                  serverHintRecord = progress.hint_record;

                  if (!Array.isArray(progGuesses)) {
                     const { data, error } = await supabase
                        .from("challenge_participants_marathon")
                        .select("guesses, hint_record")
                        .eq("participation_id", participation.id)
                        .eq("game_index", gameIndex!)
                        .maybeSingle();

                     if (!error && data) {
                        progGuesses = data.guesses;
                        serverHintRecord = data.hint_record;
                     }
                  }
                  incoming = decryptGuesses(progGuesses, key);
               }
            } else {
               let rootGuesses = participation.guesses;
               serverHintRecord = participation.hint_record;

               if (!Array.isArray(rootGuesses)) {
                  const { data, error } = await supabase
                     .from("challenge_participants")
                     .select("guesses, hint_record")
                     .eq("id", participation.id)
                     .single();

                  if (!error && data) {
                     rootGuesses = data.guesses;
                     serverHintRecord = data.hint_record;
                  }
               }
               incoming = decryptGuesses(rootGuesses, key);
            }
         }

         const progress = isMarathon
            ? participation?.marathon_progress?.find(
                 (p: any) =>
                    p.game_index === gameIndex ||
                    (p.game_index === undefined &&
                       p.word_length === activeGame?.wordLength),
              )
            : null;

         addLog(`Game Initialized: idx ${gameIndex} (${wordLength}L)`);

         const serverStatus = isMarathon
            ? progress?.status || "playing"
            : participation?.status || "playing";
         const isFinishedStatus =
            serverStatus === "completed" || serverStatus === "timed_out";

         let initialTimeLeft = null;
         let hasTimedOutOffline = false;

         if (challenge.mode === "LIVE" && effectiveMaxTime) {
            const startTime = isMarathon
               ? progress?.started_at
               : participation.started_at;

            if (isMarathon && !progress?.started_at) {
               initialTimeLeft = effectiveMaxTime * 60;
            } else if (startTime) {
               const elapsed = Math.floor(
                  (Date.now() - new Date(startTime).getTime()) / 1000,
               );
               initialTimeLeft = Math.max(0, effectiveMaxTime * 60 - elapsed);
               if (initialTimeLeft <= 0 && !isFinishedStatus) {
                  hasTimedOutOffline = true;
               }
            } else {
               initialTimeLeft = effectiveMaxTime * 60;
            }
         }

         initializedRef.current = currentKey;

         let localGuesses = incoming;
         let localUsedHint = isMarathon
            ? progress?.hints_used || false
            : participation?.hints_used || false;
         let localHintRecord = serverHintRecord;
         let needsBackgroundSync = false;
         let recoveredPayload = null;

         try {
            let saved = safeLocalStorage.getItem(storageKey);
            if (!saved && isMarathon && activeGame) {
               const legacyKey = `challenge-prog-${challenge.id}-m-${activeGame.wordLength}`;
               saved = safeLocalStorage.getItem(legacyKey);
            }
            if (saved) {
               const parsed = JSON.parse(saved);
               const localStatus = parsed.status || "playing";

               const hasMoreGuesses =
                  (parsed.guesses?.length || 0) > incoming.length;
               const hasNewHint = parsed.hints_used && !localUsedHint;
               const hasAdvancedStatus =
                  (localStatus === "completed" ||
                     localStatus === "timed_out") &&
                  serverStatus === "playing";

               if (
                  hasMoreGuesses ||
                  hasNewHint ||
                  hasAdvancedStatus ||
                  parsed.needsSync
               ) {
                  if (
                     parsed.guesses &&
                     parsed.guesses.length >= incoming.length
                  ) {
                     localGuesses = parsed.guesses;
                  }
                  localUsedHint = parsed.hints_used || localUsedHint;
                  localHintRecord = parsed.hint_record || localHintRecord;

                  needsBackgroundSync = true;
                  recoveredPayload = parsed;
               }
            }
         } catch (e) {
            logger.error("Local recovery failed", {
               key: storageKey,
               error: e,
            });
         }

         let isStarterEnforced = false;
         const currentWordForStarter = challenge.is_shapeshifter
            ? localTargetWords.length > 0
               ? localTargetWords[localTargetWords.length - 1]
               : initialTargetWord
            : targetWord;
         if (localGuesses.length === 0 && currentWordForStarter) {
            const starter = isMarathon
               ? getHandicapStarter(challenge, gameIndex!, wordLength)
               : challenge.handicap_starter;
            if (starter && challenge.handicap_enforced) {
               const upperStarter = starter.toUpperCase();
               const result = checkGuess(upperStarter, currentWordForStarter);
               localGuesses = [result];
               isStarterEnforced = true;
            }
         }

         dispatch({
            type: "START_GAME",
            payload: {
               guesses: localGuesses,
               letterStatuses: getLetterStatuses(localGuesses),
               usedHint: localUsedHint,
               hintRecord: localHintRecord,
               isGameOver:
                  isFinishedStatus ||
                  (initialTimeLeft !== null && initialTimeLeft <= 0) ||
                  localGuesses.some((g: any) =>
                     g.every((r: any) => r.status === "correct"),
                  ) ||
                  localGuesses.length >= maxAttempts,
               status: serverStatus,
               timeLeft: initialTimeLeft,
            },
         });

         setIsSaving(false);

         try {
            if (
               needsBackgroundSync &&
               recoveredPayload &&
               !isFinishedStatus &&
               !startTimerRef.current
            ) {
               wrappedSubmitResult(
                  recoveredPayload,
                  isMarathon ? wordLength : undefined,
                  isMarathon ? gameIndex! : undefined,
               );
            }

            if (isStarterEnforced && !startTimerRef.current) {
               startTimerRef.current = true;
               await wrappedSubmitResult(
                  {
                     status: "playing",
                     attempts: 1,
                     guesses: localGuesses,
                     started_at: new Date().toISOString(),
                  },
                  isMarathon ? wordLength : undefined,
                  isMarathon ? gameIndex! : undefined,
               );
            }

            if (hasTimedOutOffline && !startTimerRef.current) {
               startTimerRef.current = true;
               await handleTimeExpired();
            }

            if (
               challenge.mode === "LIVE" &&
               effectiveMaxTime &&
               !hasTimedOutOffline &&
               !startTimerRef.current
            ) {
               const startTime = isMarathon
                  ? progress?.started_at
                  : participation?.started_at;
               if (!startTime) {
                  startTimerRef.current = true;
                  await wrappedSubmitResult(
                     {
                        status: "playing",
                        started_at: new Date().toISOString(),
                     },
                     isMarathon ? wordLength : undefined,
                     isMarathon ? gameIndex! : undefined,
                  );
               }
            }
         } catch (e) {
            console.error("[Engine] Error in runSideEffects:", e);
         }
      };

      initialize();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [
      currentKey,
      isMarathon,
      gameIndex,
      challenge,
      effectiveMaxTime,
      participation,
      targetWord,
      wordLength,
      storageKey,
      activeGame,
      wrappedSubmitResult,
      handleTimeExpired,
   ]);

   // Sync guesses if they update in props while engine is mounted
   useEffect(() => {
      if (
         isSaving ||
         (isMarathon && (gameIndex === undefined || gameIndex === null))
      )
         return;

      const incoming = getIncomingGuesses();

      const shouldSync =
         (guesses.length === 0 && incoming.length > 0) ||
         incoming.length > guesses.length;

      if (shouldSync) {
         let hasChanged = false;
         if (incoming.length !== guesses.length) {
            hasChanged = true;
         } else {
            for (let i = 0; i < incoming.length; i++) {
               if (JSON.stringify(incoming[i]) !== JSON.stringify(guesses[i])) {
                  hasChanged = true;
                  break;
               }
            }
         }

         if (hasChanged) {
            setTimeout(
               () =>
                  addLog(
                     `Background Sync: +${incoming.length - guesses.length}`,
                  ),
               0,
            );
            dispatch({
               type: "SWITCH_LENGTH",
               payload: {
                  guesses: incoming,
                  letterStatuses: getLetterStatuses(incoming),
                  isGameOver:
                     incoming.some((g: any) =>
                        g.every((r: any) => r.status === "correct"),
                     ) || incoming.length >= maxAttempts,
               },
            });
         }
      }
   }, [getIncomingGuesses, guesses, isSaving, isMarathon, gameIndex, addLog, maxAttempts]);

   const isHintBar1Restricted = useMemo(
      () => isHintDisabled(targetWord, guesses),
      [targetWord, guesses],
   );

   return {
      state: { ...state, isHintDisabled: isHintBar1Restricted },
      actions,
      isSaving,
      syncFailed,
      retryCount,
      wordLength,
      maxAttempts,
      targetWord,
      timeLeft,
      networkLogs,
      targetWords,
   };
};
