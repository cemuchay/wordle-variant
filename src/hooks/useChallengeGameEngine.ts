/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  useMemo,
  useRef,
} from "react";
import { getWordLists } from "../data/words";
import {
  calculateSkillIndex,
  checkGuess,
  deobfuscateWord,
  getHint,
  getLetterStatuses,
  isHintDisabled,
} from "../lib/game-logic";
import {
  challengeGameReducer,
  initialChallengeState,
} from "../reducers/challengeReducer";
import { useChallengeStore } from "../store/useChallengeStore";
import { useConfirmation } from "../context/ConfirmationContext";
import {
  parseMarathonGames,
  getMarathonTimer,
  getHandicapStarter,
} from "../utils/marathon";

interface UseChallengeGameEngineProps {
  challenge: any;
  participation: any;
  triggerToast: (msg: string, duration?: number) => void;
  submitChallengeResult: (
    result: any,
    wordLength?: number,
    gameIndex?: number,
  ) => Promise<boolean>;
  onFinish: () => void;
  gameIndex?: number | null; // For Marathon mode
  onLengthComplete?: () => void; // Callback for Marathon mode
}

export const useChallengeGameEngine = ({
  challenge,
  participation,
  triggerToast,
  submitChallengeResult,
  onFinish,
  gameIndex,
  onLengthComplete,
}: UseChallengeGameEngineProps) => {
  const setTimeLeftStore = useChallengeStore((state) => state.setTimeLeft);
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
    status: participation.status,
    isGameOver: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const lastPayloadRef = useRef<{
    payload: any;
    wordLen?: number;
    gIdx?: number;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [networkLogs, setNetworkLogs] = useState<
    Array<{ id: string; msg: string; duration?: number }>
  >([]);
  const startTimerRef = useRef(false);
  const initializedRef = useRef<string>("");
  const { guesses, currentGuess, isGameOver, usedHint, hintRecord, timeLeft } =
    state;

  const currentKey = isMarathon ? `m-idx-${gameIndex}` : `r-${challenge.id}`;
  const storageKey = `challenge-prog-${challenge.id}-${currentKey}`;

  const addLog = useCallback((msg: string, duration?: number) => {
    setNetworkLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), msg, duration },
    ]);
  }, []);

  const saveToLocal = useCallback(
    (payload: any) => {
      try {
        const existing = localStorage.getItem(storageKey);
        const existingParsed = existing ? JSON.parse(existing) : {};
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...existingParsed,
            ...payload,
            timestamp: Date.now(),
          }),
        );
      } catch (e) {
        console.error("Local save failed", e);
      }
    },
    [storageKey],
  );

  const wrappedSubmitResult = useCallback(
    async (payload: any, wordLen?: number, gIdx?: number) => {
      const start = Date.now();
      addLog(`Sync Start: ${payload.status}`);

      // Save to local mirror first
      saveToLocal(payload);

      const success = await submitChallengeResult(payload, wordLen, gIdx);
      const duration = Date.now() - start;
      addLog(`Sync End: ${success ? "Success" : "Failed"}`, duration);

      // --- LOCAL STORAGE CLEANUP ---
      // If sync succeeded, and it was a final state (completed/timed_out),
      // we can remove the local mirror as the cloud is now authoritative.
      if (
        success &&
        (payload.status === "completed" || payload.status === "timed_out")
      ) {
        try {
          localStorage.removeItem(storageKey);
          // Also clean up fallback legacy key if it exists
          if (isMarathon && activeGame) {
            const legacyKey = `challenge-prog-${challenge.id}-m-${activeGame.wordLength}`;
            localStorage.removeItem(legacyKey);
          }
          console.log(
            "[Engine] Local mirror cleaned up after successful completion sync.",
          );
        } catch (e) {
          console.error("Local cleanup failed", e);
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
    ],
  );

  const wordLength = isMarathon
    ? activeGame
      ? activeGame.wordLength
      : 5
    : challenge.word_length;
  const targetWord = useMemo(() => {
    return isMarathon
      ? activeGame
        ? activeGame.word
        : ""
      : deobfuscateWord(challenge.target_word, challenge.salt);
  }, [isMarathon, activeGame, challenge.target_word, challenge.salt]);

  const handleTimeExpired = useCallback(async () => {
    if (isSaving) return;
    dispatch({ type: "TIME_UP" });
    triggerToast("Time's up!", 3000);
    setIsSaving(true);

    let timeTaken: number | null = null;
    if (challenge.mode === "LIVE" && effectiveMaxTime) {
      timeTaken = effectiveMaxTime * 60; // Max time used if expired
    }

    if (isMarathon) {
      // Just fail this specific word, but keep marathon playing
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
      setIsSaving(false);
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
      setIsSaving(false);
      if (!success) triggerToast("Failed to save result.", 4000);
      onFinish();
    }
  }, [
    isSaving,
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
    triggerToast,
  ]);

  // Sync timeLeft with Global Store
  useEffect(() => {
    setTimeLeftStore(timeLeft);
    return () => setTimeLeftStore(null);
  }, [timeLeft, setTimeLeftStore]);

  useEffect(() => {
    if (targetWord) {
      const t = setTimeout(() => addLog("Word Resolved"), 0);
      return () => clearTimeout(t);
    }
  }, [targetWord, addLog]);

  // Helper to extract guesses for current word with extreme defensiveness
  const getIncomingGuesses = useCallback(() => {
    if (!participation) return [];

    if (isMarathon) {
      if (gameIndex === undefined || gameIndex === null) return [];
      const progress = participation.marathon_progress?.find(
        (p: any) =>
          p.game_index === gameIndex ||
          (p.game_index === undefined &&
            p.word_length === activeGame?.wordLength),
      );
      return Array.isArray(progress?.guesses) ? progress.guesses : [];
    }

    let g = participation.guesses;
    // Handle potential stringified JSON from some DB responses
    if (typeof g === "string") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      try {
        g = JSON.parse(g);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(g) ? g : [];
  }, [participation, isMarathon, gameIndex, activeGame]);

  // Initialization & State Sync
  useEffect(() => {
    if (isMarathon && (gameIndex === undefined || gameIndex === null)) return;
    if (initializedRef.current === currentKey) return;

    const incoming = getIncomingGuesses();
    const progress = isMarathon
      ? participation.marathon_progress?.find(
          (p: any) =>
            p.game_index === gameIndex ||
            (p.game_index === undefined &&
              p.word_length === activeGame?.wordLength),
        )
      : null;

    console.log(
      `[Engine] Initializing game index ${gameIndex} (length ${wordLength}). Key: ${currentKey}`,
    );
    addLog(`Game Initialized: idx ${gameIndex} (${wordLength}L)`);

    const serverStatus = isMarathon
      ? progress?.status || "playing"
      : participation.status;
    const isFinishedStatus =
      serverStatus === "completed" || serverStatus === "timed_out";

    let initialTimeLeft = null;
    let hasTimedOutOffline = false;

    if (challenge.mode === "LIVE" && effectiveMaxTime) {
      // Marathon: use per-word startTime ONLY. Regular: use participation startTime.
      const startTime = isMarathon
        ? progress?.started_at
        : participation.started_at;

      if (isMarathon && !progress?.started_at) {
        // Word hasn't started yet, give full time
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

    // --- LOCAL STORAGE RECOVERY ---
    let localGuesses = incoming;
    let localUsedHint = isMarathon
      ? progress?.hints_used || false
      : participation.hints_used || false;
    let localHintRecord = isMarathon
      ? progress?.hint_record || null
      : participation.hint_record || null;

    try {
      let saved = localStorage.getItem(storageKey);
      if (!saved && isMarathon && activeGame) {
        const legacyKey = `challenge-prog-${challenge.id}-m-${activeGame.wordLength}`;
        saved = localStorage.getItem(legacyKey);
        if (saved) {
          console.log(
            "[Engine] Found legacy storage key, migrating/recovering from:",
            legacyKey,
          );
        }
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasMoreGuesses = parsed.guesses?.length > incoming.length;
        const hasNewHint = parsed.hints_used && !localUsedHint;

        if (hasMoreGuesses || hasNewHint) {
          console.log(
            "[Engine] Recovering advanced progress or hint from localStorage",
            { hasMoreGuesses, hasNewHint }
          );
          if (parsed.guesses && parsed.guesses.length >= incoming.length) {
            localGuesses = parsed.guesses;
          }
          localUsedHint = parsed.hints_used || localUsedHint;
          localHintRecord = parsed.hint_record || localHintRecord;
        }
      }
    } catch (e) {
      console.error("Local recovery failed", e);
    }

    let isStarterEnforced = false;
    if (localGuesses.length === 0 && targetWord) {
      const starter = isMarathon
        ? getHandicapStarter(challenge, gameIndex!, wordLength)
        : challenge.handicap_starter;
      if (starter && challenge.handicap_enforced) {
        const upperStarter = starter.toUpperCase();
        const result = checkGuess(upperStarter, targetWord);
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
          localGuesses.length >= 6,
        status: serverStatus,
        timeLeft: initialTimeLeft,
      },
    });

    // Side Effects (Timer Start / Timeout Sync)
    const runSideEffects = async () => {
      // Handle Enforced Starter Word Sync
      if (isStarterEnforced && !startTimerRef.current) {
        console.log("[Engine] Syncing enforced starter word to server...");
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

      // Handle Offline Timeout Sync
      if (hasTimedOutOffline && !isSaving && !startTimerRef.current) {
        console.log("[Engine] Offline timeout detected, syncing...");
        startTimerRef.current = true;
        await handleTimeExpired();
      }

      // Handle Per-Game Timer Start for LIVE mode
      if (
        challenge.mode === "LIVE" &&
        effectiveMaxTime &&
        !isSaving &&
        !hasTimedOutOffline &&
        !startTimerRef.current
      ) {
        const startTime = isMarathon
          ? progress?.started_at
          : participation.started_at;
        if (!startTime) {
          console.log("[Engine] Starting LIVE timer...");
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
    };

    runSideEffects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentKey,
    isMarathon,
    gameIndex,
    challenge,
    isSaving,
    effectiveMaxTime,
  ]);

  // Sync guesses if they update in props while engine is mounted
  useEffect(() => {
    if (
      isSaving ||
      (isMarathon && (gameIndex === undefined || gameIndex === null))
    )
      return;

    const incoming = getIncomingGuesses();

    // Robust Sync Strategy:
    // Only sync from props if:
    // 1. We have no local guesses yet (first fetch arrived after mount)
    // 2. The incoming data is MORE complete than our local state (sync from another device)
    const shouldSync =
      (guesses.length === 0 && incoming.length > 0) ||
      incoming.length > guesses.length;

    if (shouldSync) {
      // Check if content actually differs before dispatching
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
        console.log(
          `[Engine] Syncing background update. Incoming: ${incoming.length}, Local: ${guesses.length}`,
        );
        setTimeout(
          () => addLog(`Background Sync: +${incoming.length - guesses.length}`),
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
              ) || incoming.length >= 6,
          },
        });
      }
    }
  }, [getIncomingGuesses, guesses, isSaving, isMarathon, gameIndex, addLog]);

  // Timer Interval Management
  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isGameOver) {
      const interval = window.setInterval(() => {
        dispatch({ type: "TICK_TIMER" });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isGameOver, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && !isGameOver) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleTimeExpired();
    }
  }, [timeLeft, isGameOver, handleTimeExpired]);

  const onChar = useCallback(
    (char: string) => {
      if (isGameOver) return;
      dispatch({ type: "TYPE_CHAR", char, wordLength });
    },
    [isGameOver, wordLength],
  );

  const onDelete = useCallback(() => {
    if (isGameOver) return;
    dispatch({ type: "DELETE_CHAR" });
  }, [isGameOver]);

  const onEnter = useCallback(async () => {
    if (isGameOver || currentGuess.length !== wordLength) return;

    const upperGuess = currentGuess.toUpperCase();

    const { valid } = getWordLists(wordLength);
    if (!valid.has(upperGuess)) {
      triggerToast("Not in word list.");
      dispatch({ type: "SHAKE_GUESS" });
      setTimeout(() => dispatch({ type: "STOP_SHAKE" }), 500);
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

    const result = checkGuess(upperGuess, targetWord);
    const newGuesses = [...guesses, result];
    const newStatuses = getLetterStatuses(newGuesses);
    const won = upperGuess === targetWord;
    const lost = newGuesses.length === 6;

    // --- OPTIMISTIC UPDATE ---
    // Trigger reveal animation IMMEDIATELY
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
    if (challenge.mode === "LIVE" && effectiveMaxTime && timeLeft !== null) {
      timeTaken = effectiveMaxTime * 60 - timeLeft;
    }

    let resultPayload: any;
    if (isMarathon) {
      if (won || lost) {
        const skillScore = calculateSkillIndex({
          attempts: newGuesses.length,
          maxAttempts: 6,
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
        };
      } else {
        resultPayload = {
          status: "playing",
          guesses: newGuesses,
          attempts: newGuesses.length,
          hints_used: usedHint,
          hint_record: hintRecord,
        };
      }
    } else {
      if (won || lost) {
        const skillScore = calculateSkillIndex({
          attempts: newGuesses.length,
          maxAttempts: 6,
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
        };
      } else {
        resultPayload = {
          status: "playing",
          score: 0,
          attempts: newGuesses.length,
          guesses: newGuesses,
          hints_used: usedHint,
          hint_record: hintRecord,
        };
      }
    }

    // Retry logic: 3 attempts in background
    let success = false;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts && !success) {
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
      setTimeout(() => {
        triggerToast(
          won ? "Completed! 🎉" : `The word was ${targetWord}`,
          5000,
        );
        if (isMarathon) {
          if (onLengthComplete) onLengthComplete();
        } else {
          onFinish();
        }
      }, 2000);
    }
  }, [
    isGameOver,
    currentGuess,
    wordLength,
    targetWord,
    guesses,
    challenge.mode,
    effectiveMaxTime,
    timeLeft,
    isMarathon,
    triggerToast,
    usedHint,
    hintRecord,
    wrappedSubmitResult,
    onLengthComplete,
    onFinish,
    ask,
    gameIndex,
  ]);

  const handleHint = useCallback(async () => {
    if (isGameOver || usedHint) return;

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
        };
      } else {
        resultPayload = {
          status: "playing",
          score: 0,
          attempts: guesses.length,
          guesses: guesses,
          hints_used: true,
          hint_record: hintWithRow,
        };
      }
      const success = await wrappedSubmitResult(
        resultPayload,
        isMarathon ? wordLength : undefined,
        isMarathon ? gameIndex! : undefined,
      );
      setIsSaving(false);
      if (!success) triggerToast("Failed to save hint usage.", 3000);
    }
  }, [
    isGameOver,
    isSaving,
    usedHint,
    triggerToast,
    guesses,
    targetWord,
    isMarathon,
    gameIndex,
    wordLength,
    wrappedSubmitResult,
  ]);

  const retrySync = useCallback(async () => {
    if (!syncFailed || !lastPayloadRef.current || isSaving) return;

    setIsSaving(true);
    setRetryCount(0);

    const { payload, wordLen, gIdx } = lastPayloadRef.current;
    const success = await wrappedSubmitResult(payload, wordLen, gIdx);

    setIsSaving(false);
    if (success) {
      setSyncFailed(false);
      lastPayloadRef.current = null;
      triggerToast("Sync recovered!", 2000);
    } else {
      triggerToast("Sync failed again.", 3000);
    }
  }, [syncFailed, isSaving, wrappedSubmitResult, triggerToast]);

  const actions = useMemo(
    () => ({
      onChar,
      onDelete,
      onEnter,
      handleHint,
      retrySync,
    }),
    [onChar, onDelete, onEnter, handleHint, retrySync],
  );

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
    targetWord,
    timeLeft,
    networkLogs,
  };
};
