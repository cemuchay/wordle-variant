// ── Simplified live game engine ────────────────────────────────────
//
// Two timers:
//   1. Overall game timer (safety net) — starts when the match begins,
//      runs for the sum of all round durations + 15 s buffer. If the
//      game isn't over by then, it force-ends.
//   2. Per-round timer (50 ms tick) — starts each round, fires an empty
//      answer for any player who hasn't answered when time runs out.
//
// Round advance logic:
//   Both players answered  OR  the per-round timer expired.
//
// Supports live-bot (persistent Faker.js synthetic user profile with personality)
// and live PvP (real opponent over Supabase realtime).

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useLiveStore } from "../store/useLiveStore";
import { wordupAudio } from "../../../utils/wordupAudio";
import { TOAST_DURATION } from "../../../constants/ui";
import { getQuestionDuration, calcPoints } from "./useGameEngine.core";
import {
    decryptMatchQuestions,
    generateWordUpQuestions,
    generateSecretKey,
    encryptQuestions,
} from "../../../utils/wordupQuestionGenerator";
import { isBotMatchId, cleanBotMatchId } from "../../shared/botUtils";
import { removePausedGame } from "../../shared/pauseStorage";
import { preloadMatchImages } from "../../../utils/wordupQuestionPostProcessor";
import { safeLocalStorage } from "../../../utils/storage";
import { isProceduralCategory } from "../../../services/wordup/generatorRegistry";
import type { WordUpQuestion } from "../../../utils/wordupQuestionGenerator";
import type { ProfileStats } from "../../shared/types";
import { getPrefetchedBotMatch } from "../../../utils/wordupPrefetchCache";
import {
    getOrSpawnBotOpponent,
    botToProfileStats,
} from "../../shared/botService";
import {
    simulatePersonalityBotResponse,
    evaluateProactiveBotRematch,
    evaluateBotResponseToUserRematch,
    type BotPersonality,
} from "../../shared/botPersonality";

// ── Types ─────────────────────────────────────────────────────────

type Status = "idle" | "countdown" | "playing" | "reveal" | "gameover";
type GameType = "live" | "live-bot";
export type RematchState = "idle" | "sent" | "received" | "declined" | "expired";

interface EngineProps {
    gameType: GameType;
    matchId: string | null;
    role: "player1" | "player2" | null;
    getSyncedNow: () => number;
    triggerToast: (msg: string, dur?: number) => void;
    onGameOver: (match: Record<string, unknown>) => void;
    onRematchAccepted: (newMatchId: string, role: "player1" | "player2") => void;
    userId?: string;
}

// ── Pure helpers ──────────────────────────────────────────────────

/** Pick a bot choice — correct answer or a random wrong one. */
function pickBotChoice(q: WordUpQuestion, correct: boolean): string {
    if (correct) return q.answer;
    const wrong = q.choices.filter((c) => c !== q.answer);
    return wrong[Math.floor(Math.random() * wrong.length)] || "WRONG";
}

/** Build the final match object passed to onGameOver. */
function buildFinalMatch(
    matchData: Record<string, unknown>,
    role: "player1" | "player2" | null,
    myScore: number,
    opponentScore: number,
    cleanId?: string,
    botProfileKey?: string,
    encryptedQuestions?: string,
    encryptionKey?: string,
    botOpponentStats?: ProfileStats | null,
) {
    return {
        ...matchData,
        id: cleanId || matchData.id,
        ...(botOpponentStats?.id ? { player2_id: botOpponentStats.id } : {}),
        p1_score: role === "player1" ? myScore : opponentScore,
        p2_score: role === "player1" ? opponentScore : myScore,
        p1_answered: true,
        p2_answered: true,
        status: "completed",
        completed_at: new Date().toISOString(),
        questions: encryptedQuestions || matchData.questions || null,
        encryption_key: encryptionKey || (matchData.encryption_key as string) || null,
        ...(botProfileKey ? { bot_profile: botProfileKey } : {}),
    };
}

// ── Hook ──────────────────────────────────────────────────────────

export function useGameEngine(props: EngineProps) {
    const {
        gameType,
        triggerToast,
        onGameOver,
        onRematchAccepted,
    } = props;

    // ══════════════════════════════════════════════════════════════════
    // State (triggers re-renders)
    // ══════════════════════════════════════════════════════════════════

    const [phase, setPhase] = useState<Status>("idle");
    const [currentRound, setCurrentRound] = useState(0);
    const [myChoice, setMyChoice] = useState<string | null>(null);
    const [opponentChoice, setOpponentChoice] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(10);
    const [maxTime, setMaxTime] = useState(10);
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [myCurrentPoints, setMyCurrentPoints] = useState(0);
    const [opponentCurrentPoints, setOpponentCurrentPoints] = useState(0);
    const [countdownText, setCountdownText] = useState("1");
    const [lastRoundPopup, setLastRoundPopup] = useState(false);

    // Live PvP & Synthetic Opponent States
    const [opponentSignalLevel, setOpponentSignalLevel] = useState(4);
    const [rematchState, setRematchState] = useState<RematchState>("idle");
    const [rematchCountdown, setRematchCountdown] = useState(0);
    const [showRematchButton, setShowRematchButton] = useState(false);

    // ══════════════════════════════════════════════════════════════════
    // Refs — mutable, never cause re-renders
    // ══════════════════════════════════════════════════════════════════

    // Stable data (set once by startMatch)
    const roleRef = useRef<"player1" | "player2" | null>(null);
    const gameTypeRef = useRef<GameType>(gameType);
    const questionsRef = useRef<WordUpQuestion[]>([]);
    const matchDataRef = useRef<Record<string, unknown> | null>(null);
    const opponentStatsRef = useRef<ProfileStats | null>(null);
    const botProfileRef = useRef<string>("average");
    const botPersonalityRef = useRef<BotPersonality | null>(null);
    const consecutiveRematchesRef = useRef<number>(0);
    const isBotRematchPendingRef = useRef<boolean>(false);

    // Pending bot response for the current round
    const pendingBotRoundResultRef = useRef<{
        choice: string;
        points: number;
        timeTaken: number;
        gaveUp?: boolean;
    } | null>(null);

    // Per-round anchor (used by the 50 ms tick interval)
    const roundStartedAtRef = useRef(0);

    // Mutable mirrors of state so timer callbacks never read stale closures
    const myChoiceRef = useRef<string | null>(null);
    const opponentChoiceRef = useRef<string | null>(null);
    const myTimeTakenRef = useRef<number>(0);
    const opponentTimeTakenRef = useRef<number>(0);
    const currentRoundRef = useRef(0);
    const myScoreRef = useRef(0);
    const opponentScoreRef = useRef(0);
    const myCurrentPointsRef = useRef(0);
    const opponentCurrentPointsRef = useRef(0);
    const rematchStateRef = useRef<RematchState>("idle");

    // Timer IDs
    const countdownRef = useRef<number | null>(null);
    const roundTickRef = useRef<number | null>(null);
    const revealRef = useRef<number | null>(null);
    const overallRef = useRef<number | null>(null);
    const botTimerRef = useRef<number | null>(null);
    const botRematchTimerRef = useRef<number | null>(null);

    // Guard: prevents the "both answered" effect from firing twice
    const transitioningRef = useRef(false);

    // Clean UUID for DB save (set once in edge function path)
    const cleanIdRef = useRef<string>("");
    const encryptedQuestionsRef = useRef<string>("");
    const encryptionKeyRef = useRef<string>("");

    // Supabase channel ref for PvP broadcasts
    const channelRef = useRef<RealtimeChannel | null>(null);
    const rematchIntervalRef = useRef<number | null>(null);

    // Phase ref for use in callbacks (avoids stale closures)
    const phaseRef = useRef<Status>("idle");

    // ── Keep refs in sync with state (effect, not render) ──────────
    useEffect(() => {
        roleRef.current = props.role;
        gameTypeRef.current = gameType;
        myChoiceRef.current = myChoice;
        opponentChoiceRef.current = opponentChoice;
        currentRoundRef.current = currentRound;
        myScoreRef.current = myScore;
        opponentScoreRef.current = opponentScore;
        myCurrentPointsRef.current = myCurrentPoints;
        opponentCurrentPointsRef.current = opponentCurrentPoints;
        phaseRef.current = phase;
        rematchStateRef.current = rematchState;
    });

    // ══════════════════════════════════════════════════════════════════
    // Process pending e2e actions (queued before engine mount)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pending = (window as any).__pendingEngineActions;
        if (!pending || pending.length === 0) return;

        for (const action of [...pending]) {
            switch (action.type) {
                case "SET_INITIAL": {
                    const { gameType, role, questions, matchData, opponentStats } = action.payload;
                    gameTypeRef.current = gameType || "live";
                    roleRef.current = role;
                    questionsRef.current = questions || [];
                    matchDataRef.current = matchData || null;
                    opponentStatsRef.current = opponentStats || null;
                    break;
                }
                case "COUNTDOWN_DONE": {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setCurrentRound(0);
                    setPhase("playing");
                    const q = questionsRef.current[0];
                    const dur = q ? getQuestionDuration(q.type) : 10;
                    setTimeRemaining(dur);
                    setMaxTime(dur);
                    roundStartedAtRef.current = Date.now();
                    break;
                }
                case "START_ROUND": {
                    const r = action.round ?? 0;
                    const q = questionsRef.current[r];
                    const dur = q ? getQuestionDuration(q.type) : 10;
                    setCurrentRound(r);
                    setTimeRemaining(dur);
                    setMaxTime(dur);
                    roundStartedAtRef.current = action.startedAt || Date.now();
                    setPhase("playing");
                    break;
                }
            }
        }
        pending.length = 0;
    }, []);

    // ══════════════════════════════════════════════════════════════════
    // Timer helpers
    // ══════════════════════════════════════════════════════════════════

    const stopCountdown = useCallback(() => {
        if (countdownRef.current !== null) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    }, []);

    const stopRoundTick = useCallback(() => {
        if (roundTickRef.current !== null) {
            clearInterval(roundTickRef.current);
            roundTickRef.current = null;
        }
    }, []);

    const stopReveal = useCallback(() => {
        if (revealRef.current !== null) {
            clearTimeout(revealRef.current);
            revealRef.current = null;
        }
    }, []);

    const stopOverall = useCallback(() => {
        if (overallRef.current !== null) {
            clearTimeout(overallRef.current);
            overallRef.current = null;
        }
    }, []);

    const stopBotTimer = useCallback(() => {
        if (botTimerRef.current !== null) {
            clearTimeout(botTimerRef.current);
            botTimerRef.current = null;
        }
    }, []);

    const stopBotRematchTimer = useCallback(() => {
        if (botRematchTimerRef.current !== null) {
            clearTimeout(botRematchTimerRef.current);
            botRematchTimerRef.current = null;
        }
    }, []);

    const stopRematchInterval = useCallback(() => {
        if (rematchIntervalRef.current !== null) {
            clearInterval(rematchIntervalRef.current);
            rematchIntervalRef.current = null;
        }
    }, []);

    const stopAllTimers = useCallback(() => {
        stopCountdown();
        stopRoundTick();
        stopReveal();
        stopOverall();
        stopBotTimer();
        stopBotRematchTimer();
        stopRematchInterval();
        wordupAudio.stopFinalRoundBeat();
    }, [
        stopCountdown,
        stopRoundTick,
        stopReveal,
        stopOverall,
        stopBotTimer,
        stopBotRematchTimer,
        stopRematchInterval,
    ]);

    // ══════════════════════════════════════════════════════════════════
    // Internal actions (read refs, safe inside timeouts)
    // ══════════════════════════════════════════════════════════════════

    /** Advance to the next round — accumulates points, resets choices. */
    const advanceRound = useCallback(() => {
        const next = currentRoundRef.current + 1;
        const maxRound = Math.max(6, (questionsRef.current?.length || 7) - 1);
        if (next > maxRound) return;

        transitioningRef.current = false;
        pendingBotRoundResultRef.current = null;

        // Push current round answers into matchData before resetting
        const p1Arr = matchDataRef.current?.p1_answers;
        const p2Arr = matchDataRef.current?.p2_answers;
        const isP1 = roleRef.current === "player1";
        const p1Choice = isP1 ? myChoiceRef.current : opponentChoiceRef.current;
        const p1Correct = p1Choice === questionsRef.current[currentRoundRef.current]?.answer;
        const p1Points = isP1 ? myCurrentPointsRef.current : opponentCurrentPointsRef.current;
        const p1Time = isP1 ? myTimeTakenRef.current : opponentTimeTakenRef.current;

        const p2Choice = isP1 ? opponentChoiceRef.current : myChoiceRef.current;
        const p2Correct = p2Choice === questionsRef.current[currentRoundRef.current]?.answer;
        const p2Points = isP1 ? opponentCurrentPointsRef.current : myCurrentPointsRef.current;
        const p2Time = isP1 ? opponentTimeTakenRef.current : myTimeTakenRef.current;

        if (Array.isArray(p1Arr)) {
            p1Arr.push({
                question_idx: currentRoundRef.current,
                choice: p1Choice,
                correct: p1Correct,
                points: p1Points,
                time_taken: p1Time,
            });
        }
        if (Array.isArray(p2Arr)) {
            p2Arr.push({
                question_idx: currentRoundRef.current,
                choice: p2Choice,
                correct: p2Correct,
                points: p2Points,
                time_taken: p2Time,
            });
        }

        const addMy = myCurrentPointsRef.current;
        const addOpp = opponentCurrentPointsRef.current;

        const newMyScore = myScoreRef.current + addMy;
        const newOppScore = opponentScoreRef.current + addOpp;

        myScoreRef.current = newMyScore;
        opponentScoreRef.current = newOppScore;

        setMyScore(newMyScore);
        setOpponentScore(newOppScore);

        if (matchDataRef.current) {
            matchDataRef.current.p1_score = isP1 ? newMyScore : newOppScore;
            matchDataRef.current.p2_score = isP1 ? newOppScore : newMyScore;
        }

        setCurrentRound(next);
        myChoiceRef.current = null;
        opponentChoiceRef.current = null;
        myCurrentPointsRef.current = 0;
        opponentCurrentPointsRef.current = 0;
        setMyChoice(null);
        setOpponentChoice(null);
        setMyCurrentPoints(0);
        setOpponentCurrentPoints(0);
        setLastRoundPopup(false);

        const q = questionsRef.current[next];
        const dur = q ? getQuestionDuration(q.type) : 10;
        setTimeRemaining(dur);
        setMaxTime(dur);
        roundStartedAtRef.current = Date.now();
        setPhase("playing");
    }, []);

    /** End the game, call onGameOver, clean up, and initiate rematch window. */
    const endGame = useCallback(() => {
        const finalMy = myScoreRef.current + myCurrentPointsRef.current;
        const finalOpp = opponentScoreRef.current + opponentCurrentPointsRef.current;

        // Push last round answers into matchData
        const p1Arr = matchDataRef.current?.p1_answers;
        const p2Arr = matchDataRef.current?.p2_answers;
        const isP1 = roleRef.current === "player1";
        const p1Choice = isP1 ? myChoiceRef.current : opponentChoiceRef.current;
        const p1Correct = p1Choice === questionsRef.current[currentRoundRef.current]?.answer;
        const p1Points = isP1 ? myCurrentPointsRef.current : opponentCurrentPointsRef.current;
        const p1Time = isP1 ? myTimeTakenRef.current : opponentTimeTakenRef.current;

        const p2Choice = isP1 ? opponentChoiceRef.current : myChoiceRef.current;
        const p2Correct = p2Choice === questionsRef.current[currentRoundRef.current]?.answer;
        const p2Points = isP1 ? opponentCurrentPointsRef.current : myCurrentPointsRef.current;
        const p2Time = isP1 ? opponentTimeTakenRef.current : myTimeTakenRef.current;

        if (Array.isArray(p1Arr)) {
            p1Arr.push({
                question_idx: currentRoundRef.current,
                choice: p1Choice,
                correct: p1Correct,
                points: p1Points,
                time_taken: p1Time,
            });
        }
        if (Array.isArray(p2Arr)) {
            p2Arr.push({
                question_idx: currentRoundRef.current,
                choice: p2Choice,
                correct: p2Correct,
                points: p2Points,
                time_taken: p2Time,
            });
        }

        setMyScore(finalMy);
        setOpponentScore(finalOpp);
        setPhase("gameover");

        stopAllTimers();
        safeLocalStorage.removeItem("wordup_active_game");
        const md = matchDataRef.current;
        onGameOver(
            buildFinalMatch(
                md || {},
                roleRef.current,
                finalMy,
                finalOpp,
                cleanIdRef.current,
                botProfileRef.current,
                encryptedQuestionsRef.current,
                encryptionKeyRef.current,
                opponentStatsRef.current,
            ),
        );

        // Start rematch countdown for BOTH live PvP and synthetic bot matches
        setRematchState("idle");
        rematchStateRef.current = "idle";
        setShowRematchButton(true);
        setRematchCountdown(10);

        stopRematchInterval();
        rematchIntervalRef.current = window.setInterval(() => {
            setRematchCountdown((prev) => {
                if (prev <= 1) {
                    stopRematchInterval();
                    stopBotRematchTimer();
                    setShowRematchButton(false);
                    setRematchState((cur) => (cur === "declined" ? "declined" : "expired"));
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // If playing against a synthetic bot profile, evaluate whether the bot proactively requests a rematch
        const isBot = gameTypeRef.current === "live-bot" || Boolean(md?.is_bot_match);
        if (isBot) {
            const botWon = finalOpp > finalMy;
            const isDraw = finalOpp === finalMy;
            const scoreDiff = finalOpp - finalMy;
            const proactive = evaluateProactiveBotRematch(
                botPersonalityRef.current,
                botWon,
                isDraw,
                scoreDiff,
                consecutiveRematchesRef.current,
            );

            if (proactive.shouldRequest) {
                stopBotRematchTimer();
                botRematchTimerRef.current = window.setTimeout(() => {
                    botRematchTimerRef.current = null;
                    if (rematchStateRef.current === "idle" && phaseRef.current === "gameover") {
                        setRematchState("received");
                        rematchStateRef.current = "received";
                        const oppName = opponentStatsRef.current?.username || "Opponent";
                        triggerToast(`🔥 ${oppName} wants a rematch!`, TOAST_DURATION.DEFAULT);
                    }
                }, proactive.delayMs);
            }
        }
    }, [onGameOver, stopAllTimers, stopRematchInterval, stopBotRematchTimer, triggerToast]);

    const beginReveal = useCallback(() => {
        transitioningRef.current = true;
        stopRoundTick();
        stopBotTimer();

        const totalRounds = Math.max(7, questionsRef.current.length || 7);
        const isLast = currentRoundRef.current >= totalRounds - 1;
        const delay = 1800;

        setPhase("reveal");

        revealRef.current = window.setTimeout(() => {
            revealRef.current = null;
            if (isLast) {
                endGame();
            } else {
                if ((currentRoundRef.current + 2) % 7 === 0 || currentRoundRef.current === totalRounds - 2) {
                    wordupAudio.playFinalRoundAnticipationStart();
                    triggerToast("DOUBLE POINTS ROUND!", TOAST_DURATION.DEFAULT);
                    wordupAudio.startFinalRoundBeat();
                }
                advanceRound();
            }
        }, delay);
    }, [triggerToast, advanceRound, endGame, stopRoundTick, stopBotTimer]);

    // ══════════════════════════════════════════════════════════════════
    // EFFECT 1 — Countdown (1 → playing)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (phase !== "countdown") return;

        const targetRound =
            (matchDataRef.current?.current_question_index as number | undefined) ??
            useLiveStore.getState().currentIdx ??
            0;
        const isResuming = targetRound > 0;

        Promise.resolve().then(() => {
            setCountdownText(isResuming ? "Resuming in 1..." : "1");
        });
        wordupAudio.playCountdownTick(1);
        let count = 1;

        countdownRef.current = window.setInterval(() => {
            count--;
            if (count <= 0) {
                stopCountdown();
                wordupAudio.playGameStart();

                // Start the round (0 if new game, targetRound if resuming)
                setCurrentRound(targetRound);
                currentRoundRef.current = targetRound;
                useLiveStore.getState().setCurrentIdx(targetRound);

                myChoiceRef.current = null;
                opponentChoiceRef.current = null;
                myCurrentPointsRef.current = 0;
                opponentCurrentPointsRef.current = 0;
                setMyChoice(null);
                setOpponentChoice(null);
                setMyCurrentPoints(0);
                setOpponentCurrentPoints(0);
                const q = questionsRef.current[targetRound];
                const dur = q ? getQuestionDuration(q.type) : 10;
                setTimeRemaining(dur);
                setMaxTime(dur);
                roundStartedAtRef.current = Date.now();
                setPhase("playing");
            } else {
                setCountdownText(isResuming ? `Resuming in ${count}...` : String(count));
                wordupAudio.playCountdownTick(count);
            }
        }, 1000);

        return stopCountdown;
    }, [phase, stopCountdown]);

    // ══════════════════════════════════════════════════════════════════
    // EFFECT 2 — Round tick (50 ms) + overall safety timer + bot timer
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (phase !== "playing") return;

        // ── Overall game safety timer (starts once, never restarts) ──
        if (overallRef.current === null) {
            const totalSeconds = questionsRef.current.reduce(
                (sum, q) => sum + getQuestionDuration(q.type),
                0,
            );
            const timeoutMs = totalSeconds * 1000 + 15000; // sum of rounds + 15 s buffer

            overallRef.current = window.setTimeout(() => {
                if (overallRef.current === null) return;
                endGame();
            }, timeoutMs);
        }

        // ── Per-round 50 ms tick ──
        const q = questionsRef.current[currentRound];
        const duration = q ? getQuestionDuration(q.type) : 10;

        roundTickRef.current = window.setInterval(() => {
            const elapsed = (Date.now() - roundStartedAtRef.current) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            setTimeRemaining(remaining);

            // ── Timer expired ───────────────────────────────────────
            if (remaining <= 0) {
                stopRoundTick();
                stopBotTimer();

                if (myChoiceRef.current === null) {
                    setMyChoice("");
                    setMyCurrentPoints(0);
                }

                if (opponentChoiceRef.current === null) {
                    const pending = pendingBotRoundResultRef.current;
                    if (gameTypeRef.current === "live-bot" && pending && !pending.gaveUp) {
                        opponentTimeTakenRef.current = pending.timeTaken;
                        opponentChoiceRef.current = pending.choice;
                        opponentCurrentPointsRef.current = pending.points;
                        setOpponentChoice(pending.choice);
                        setOpponentCurrentPoints(pending.points);
                    } else {
                        opponentTimeTakenRef.current = duration;
                        opponentChoiceRef.current = "";
                        opponentCurrentPointsRef.current = 0;
                        setOpponentChoice("");
                        setOpponentCurrentPoints(0);
                    }
                }
            } else if (remaining <= 5.0 && remaining > 0) {
                void (async () => {
                    const { wordupAudio } = await import("../../../utils/wordupAudio");
                    wordupAudio.playTicking();
                })();
            }
        }, 50);

        // ── Independent personality-driven bot answer timer ──
        if (gameTypeRef.current === "live-bot" && opponentChoiceRef.current === null) {
            const bq = questionsRef.current[currentRound];
            if (bq) {
                const bDur = getQuestionDuration(bq.type);
                const br = simulatePersonalityBotResponse(
                    bq,
                    botPersonalityRef.current,
                    bDur,
                    currentRound,
                    myScoreRef.current,
                    opponentScoreRef.current,
                );

                // Subtle signal bar fluctuation (3 or 4 bars) for realism
                setOpponentSignalLevel(Math.random() < 0.8 ? 4 : 3);

                if (br.gaveUp) {
                    pendingBotRoundResultRef.current = {
                        choice: "",
                        points: 0,
                        timeTaken: bDur,
                        gaveUp: true,
                    };
                } else {
                    const botChoice = pickBotChoice(bq, br.correct);
                    const pts = calcPoints(
                        br.correct,
                        br.time_taken,
                        bDur,
                        (currentRound + 1) % 7 === 0,
                    );
                    pendingBotRoundResultRef.current = {
                        choice: botChoice,
                        points: pts,
                        timeTaken: br.time_taken,
                        gaveUp: false,
                    };

                    const botMs = Math.max(350, br.time_taken * 1000);
                    botTimerRef.current = window.setTimeout(() => {
                        botTimerRef.current = null;
                        if (opponentChoiceRef.current !== null) return;
                        opponentTimeTakenRef.current = br.time_taken;
                        opponentChoiceRef.current = botChoice;
                        opponentCurrentPointsRef.current = pts;
                        setOpponentChoice(botChoice);
                        setOpponentCurrentPoints(pts);
                    }, botMs);
                }
            }
        }

        return () => {
            stopRoundTick();
            stopBotTimer();
            wordupAudio.stopFinalRoundBeat();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, currentRound]);

    // ══════════════════════════════════════════════════════════════════
    // EFFECT 3 — Both answered → reveal → advance / game-over
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (phase !== "playing") {
            transitioningRef.current = false;
            return;
        }
        if (myChoice === null || opponentChoice === null) return;
        if (transitioningRef.current) return;

        beginReveal();
    }, [phase, myChoice, opponentChoice, currentRound, beginReveal]);

    // ══════════════════════════════════════════════════════════════════
    // Zustand sync (mirrors engine state → live store)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const s = useLiveStore.getState();

        if (phase === "idle") return;

        if (phase === "countdown") s.setView("countdown");
        else if (phase === "playing" || phase === "reveal") s.setView("battle");
        else if (phase === "gameover") s.setView("gameover");

        s.setIsBattlePlaying(phase === "playing" || phase === "reveal");
        s.setSelectedAnswer(myChoice);
        s.setOpponentChoice(opponentChoice);
        s.setTimeLeft(timeRemaining);
        s.setMaxTime(maxTime);
        s.setCurrentIdx(currentRound);
        s.setRevealAnswers(phase === "reveal");
        s.setOpponentStats(opponentStatsRef.current);
        s.setQuestions(questionsRef.current);

        if (matchDataRef.current) {
            const showRunning = phase === "playing" || phase === "reveal";
            const runningMy = myScore + (showRunning ? myCurrentPoints : 0);
            const runningOpp = opponentScore + (showRunning ? opponentCurrentPoints : 0);

            const isP1 = roleRef.current === "player1";
            const p1Score = isP1 ? runningMy : runningOpp;
            const p2Score = isP1 ? runningOpp : runningMy;

            matchDataRef.current.p1_score = p1Score;
            matchDataRef.current.p2_score = p2Score;

            s.setMatchData({
                ...matchDataRef.current,
                p1_score: p1Score,
                p2_score: p2Score,
            });
        }
    }, [
        phase,
        myChoice,
        opponentChoice,
        timeRemaining,
        maxTime,
        currentRound,
        myScore,
        opponentScore,
        myCurrentPoints,
        opponentCurrentPoints,
    ]);

    // ══════════════════════════════════════════════════════════════════
    // Overall timer cleanup on unmount
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => stopAllTimers, [stopAllTimers]);

    // ══════════════════════════════════════════════════════════════════
    // Handlers (use refs — no stale closures)
    // ══════════════════════════════════════════════════════════════════

    const handleAnswerSelect = useCallback((choice: string) => {
        if (myChoiceRef.current !== null || phaseRef.current !== "playing") return;

        let q = questionsRef.current[currentRoundRef.current];
        if (!q) {
            const storeQ = useLiveStore.getState().questions;
            if (storeQ && storeQ.length > 0) {
                questionsRef.current = storeQ;
                q = storeQ[currentRoundRef.current];
            }
        }
        if (!q) return;

        const duration = getQuestionDuration(q.type);
        const elapsed = (Date.now() - roundStartedAtRef.current) / 1000;
        const timeTaken = parseFloat(elapsed.toFixed(2));
        const correct = choice !== "" && choice === q.answer;
        const pts = calcPoints(correct, timeTaken, duration, (currentRoundRef.current + 1) % 7 === 0);

        myTimeTakenRef.current = timeTaken;
        myChoiceRef.current = choice;
        myCurrentPointsRef.current = pts;
        setMyChoice(choice);
        setMyCurrentPoints(pts);

        void (async () => {
            const { wordupAudio } = await import("../../../utils/wordupAudio");
            if (correct) wordupAudio.playCorrect();
            else wordupAudio.playIncorrect();
        })();

        // Live PvP: Broadcast selected answer to the opponent
        if (gameTypeRef.current === "live" && channelRef.current && roleRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "player_answered",
                payload: {
                    role: roleRef.current,
                    round: currentRoundRef.current,
                    choice: choice,
                    timeTaken: timeTaken,
                },
            });
        }

        // Live-bot: If the bot hasn't answered yet, avoid 0ms robotic snap when real timer is active,
        // or resolve if no timer was active (e.g. unit test dispatch).
        if (gameTypeRef.current === "live-bot" && opponentChoiceRef.current === null) {
            const pending = pendingBotRoundResultRef.current;
            if (botTimerRef.current !== null && pending && !pending.gaveUp) {
                const remainingBotMs = Math.max(0, pending.timeTaken * 1000 - elapsed * 1000);
                // If bot was going to take > 1.8s more, pace it to 0.45s - 1.35s so it feels human yet responsive
                if (remainingBotMs > 1800) {
                    stopBotTimer();
                    const pacedWaitMs = Math.round(450 + Math.random() * 900);
                    const adjustedTimeTaken = parseFloat((elapsed + pacedWaitMs / 1000).toFixed(2));
                    const adjustedPts = calcPoints(
                        pending.choice === q.answer,
                        adjustedTimeTaken,
                        duration,
                        (currentRoundRef.current + 1) % 7 === 0,
                    );
                    botTimerRef.current = window.setTimeout(() => {
                        botTimerRef.current = null;
                        if (opponentChoiceRef.current !== null) return;
                        opponentTimeTakenRef.current = adjustedTimeTaken;
                        opponentChoiceRef.current = pending.choice;
                        opponentCurrentPointsRef.current = adjustedPts;
                        setOpponentChoice(pending.choice);
                        setOpponentCurrentPoints(adjustedPts);
                    }, pacedWaitMs);
                }
            } else if (botTimerRef.current === null && (!pending || !pending.gaveUp)) {
                // Fallback when timer wasn't running (e.g. headless E2E SET_INITIAL)
                const br = simulatePersonalityBotResponse(
                    q,
                    botPersonalityRef.current,
                    duration,
                    currentRoundRef.current,
                    myScoreRef.current,
                    opponentScoreRef.current,
                );
                const botChoice = pickBotChoice(q, br.correct);
                const botPts = calcPoints(
                    br.correct,
                    br.time_taken,
                    duration,
                    (currentRoundRef.current + 1) % 7 === 0,
                );
                opponentTimeTakenRef.current = br.time_taken;
                opponentChoiceRef.current = botChoice;
                opponentCurrentPointsRef.current = botPts;
                setOpponentChoice(botChoice);
                setOpponentCurrentPoints(botPts);
            }
        }
    }, [stopBotTimer]);

    const handleOpponentAnswer = useCallback((choice: string, timeTaken: number) => {
        if (opponentChoiceRef.current !== null || phaseRef.current !== "playing") return;

        const q = questionsRef.current[currentRoundRef.current];
        const duration = q ? getQuestionDuration(q.type) : 10;
        const correct = choice === q?.answer;
        const pts = calcPoints(correct, timeTaken, duration, (currentRoundRef.current + 1) % 7 === 0);

        opponentTimeTakenRef.current = timeTaken;
        opponentChoiceRef.current = choice;
        opponentCurrentPointsRef.current = pts;
        setOpponentChoice(choice);
        setOpponentCurrentPoints(pts);
    }, []);

    // ══════════════════════════════════════════════════════════════════
    // Rematch Handlers (PvP & Synthetic Bot Personality Simulation)
    // ══════════════════════════════════════════════════════════════════

    const sendRematch = useCallback(() => {
        if (rematchStateRef.current !== "idle") return;

        const isBot =
            gameTypeRef.current === "live-bot" ||
            Boolean(matchDataRef.current?.is_bot_match);

        setRematchState("sent");
        rematchStateRef.current = "sent";
        stopBotRematchTimer();

        if (isBot) {
            const finalMy = myScoreRef.current;
            const finalOpp = opponentScoreRef.current;
            const botWon = finalOpp > finalMy;
            const isDraw = finalOpp === finalMy;

            const decision = evaluateBotResponseToUserRematch(
                botPersonalityRef.current,
                botWon,
                isDraw,
                consecutiveRematchesRef.current,
            );

            botRematchTimerRef.current = window.setTimeout(() => {
                botRematchTimerRef.current = null;
                if (rematchStateRef.current !== "sent") return;

                const oppName = opponentStatsRef.current?.username || "Opponent";

                if (decision.action === "accept") {
                    stopRematchInterval();
                    consecutiveRematchesRef.current += 1;
                    isBotRematchPendingRef.current = true;
                    setRematchState("idle");
                    rematchStateRef.current = "idle";
                    const newMatchId = `bot-match-${crypto.randomUUID()}`;
                    triggerToast(`🔥 ${oppName} accepted your rematch!`, TOAST_DURATION.DEFAULT);
                    onRematchAccepted(newMatchId, "player1");
                } else if (decision.action === "decline") {
                    stopRematchInterval();
                    setRematchState("declined");
                    rematchStateRef.current = "declined";
                    triggerToast(`${oppName} declined the rematch.`, TOAST_DURATION.DEFAULT);
                }
                // If decision.action === "ignore", let the 10s countdown expire naturally
            }, decision.delayMs);
            return;
        }

        if (!channelRef.current || !roleRef.current) return;
        channelRef.current.send({
            type: "broadcast",
            event: "rematch_sent",
            payload: { role: roleRef.current },
        });
    }, [onRematchAccepted, stopBotRematchTimer, stopRematchInterval, triggerToast]);

    const acceptRematch = useCallback(
        async (onMatchFoundCb?: (mId: string, role: "player1" | "player2") => void) => {
            const isBot =
                gameTypeRef.current === "live-bot" ||
                Boolean(matchDataRef.current?.is_bot_match);

            stopBotRematchTimer();
            stopRematchInterval();

            if (isBot) {
                consecutiveRematchesRef.current += 1;
                isBotRematchPendingRef.current = true;
                setRematchState("idle");
                rematchStateRef.current = "idle";
                const newMatchId = `bot-match-${crypto.randomUUID()}`;
                if (onMatchFoundCb) {
                    onMatchFoundCb(newMatchId, "player1");
                } else {
                    onRematchAccepted(newMatchId, "player1");
                }
                return;
            }

            if (!channelRef.current || !roleRef.current || !matchDataRef.current) return;

            const newMatchId = `rematch-${crypto.randomUUID()}`;
            setRematchState("idle");
            rematchStateRef.current = "idle";

            channelRef.current.send({
                type: "broadcast",
                event: "rematch_accepted",
                payload: { role: roleRef.current, newMatchId },
            });

            const nextRole = roleRef.current === "player1" ? "player2" : "player1";
            const category = useLiveStore.getState().category || "mixed";
            const prefetched = getPrefetchedBotMatch(category);

            try {
                const p1 =
                    roleRef.current === "player1"
                        ? matchDataRef.current.player2_id
                        : matchDataRef.current.player1_id;
                const p2 =
                    roleRef.current === "player1"
                        ? matchDataRef.current.player1_id
                        : matchDataRef.current.player2_id;

                const upsertData = {
                    id: newMatchId,
                    category,
                    player1_id: p1,
                    player2_id: p2,
                    status: prefetched ? "countdown" : "waiting",
                    game_type: "live",
                    ...(prefetched
                        ? {
                              questions: prefetched.encryptedQuestions,
                              encryption_key: prefetched.encryptionKey,
                          }
                        : {}),
                };

                await supabase.from("wordup_matches").upsert(upsertData);
            } catch (e) {
                console.error("Failed to register rematch matching:", e);
            }

            if (onMatchFoundCb) {
                onMatchFoundCb(newMatchId, nextRole);
            }
        },
        [onRematchAccepted, stopBotRematchTimer, stopRematchInterval],
    );

    const sendQuickChat = useCallback((message: string) => {
        if (!channelRef.current || !roleRef.current) return;

        window.dispatchEvent(
            new CustomEvent("wordup-quick-chat", {
                detail: { sender: "self", message },
            }),
        );

        channelRef.current.send({
            type: "broadcast",
            event: "quick_chat",
            payload: { role: roleRef.current, message },
        });
    }, []);

    const sendSignalUpdate = useCallback((level: number) => {
        if (!channelRef.current || !roleRef.current) return;

        channelRef.current.send({
            type: "broadcast",
            event: "signal_update",
            payload: { role: roleRef.current, level },
        });
    }, []);

    const cleanup = useCallback(() => {
        stopAllTimers();
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, [stopAllTimers]);

    const abortMatch = useCallback(async () => {
        stopAllTimers();
        const mId = useLiveStore.getState().matchId;
        const isBot = isBotMatchId(mId);
        const dbId = cleanBotMatchId(mId);

        if (mId) {
            removePausedGame(mId);
            if (dbId) {
                removePausedGame(dbId);
            }
            if (!isBot && channelRef.current) {
                channelRef.current.send({
                    type: "broadcast",
                    event: "match_abandoned",
                    payload: { role: roleRef.current },
                });
            }
            if (dbId) {
                try {
                    await supabase
                        .from("wordup_matches")
                        .update({ status: "abandoned" })
                        .eq("id", dbId);
                } catch (e) {
                    console.error("Failed to mark match as abandoned in DB:", e);
                }
            }
        }
        setPhase("idle");
        useLiveStore.getState().setView("menu");
        useLiveStore.getState().resetGame();
    }, [stopAllTimers]);

    const purgeAndReset = useCallback(async () => {
        stopAllTimers();
        setPhase("idle");
    }, [stopAllTimers]);

    // ══════════════════════════════════════════════════════════════════
    // Match loading
    // ══════════════════════════════════════════════════════════════════

    const startMatch = useCallback(
        async (mId: string, activeRole: "player1" | "player2") => {
            setPhase("idle");
            stopBotRematchTimer();
            stopRematchInterval();
            setRematchState("idle");
            rematchStateRef.current = "idle";
            setShowRematchButton(false);

            const loadStart = Date.now();
            let questions: WordUpQuestion[];
            let matchData: Record<string, unknown>;
            let oppStats: ProfileStats | null = null;

            const storeQuestions = useLiveStore.getState().questions;
            const storeMatchData = useLiveStore.getState().matchData as Record<string, unknown> | null;
            const storeOppStats = useLiveStore.getState().opponentStats;

            const isRematchWithSameBot = isBotRematchPendingRef.current && opponentStatsRef.current;
            isBotRematchPendingRef.current = false;

            if (storeQuestions && storeQuestions.length > 0 && storeMatchData && storeMatchData.status !== "completed" && !isRematchWithSameBot) {
                questions = storeQuestions;
                matchData = storeMatchData;
                oppStats = storeOppStats;
                if (oppStats?.bot_personality) {
                    botPersonalityRef.current = oppStats.bot_personality;
                }
            } else if (isBotMatchId(mId)) {
                const category = useLiveStore.getState().category || "mixed";
                const targetRounds =
                    (!isRematchWithSameBot && (storeMatchData?.total_rounds as number | undefined)) || 7;
                const prefetched = getPrefetchedBotMatch(category, targetRounds);

                if (prefetched) {
                    mId = prefetched.matchId;
                    cleanIdRef.current = cleanBotMatchId(prefetched.matchId);
                    questions = prefetched.questions;
                    encryptedQuestionsRef.current = prefetched.encryptedQuestions;
                    encryptionKeyRef.current = prefetched.encryptionKey;
                } else {
                    const cleanId = cleanBotMatchId(mId);
                    cleanIdRef.current = cleanId;
                    if (isProceduralCategory(category)) {
                        const seed = `${cleanId}-${category}`;
                        const { data: edgeData } = await supabase.functions.invoke(
                            "generate-match-questions",
                            { body: { matchId: cleanId, category, seed } },
                        );
                        if (edgeData?.encryptedQuestions && edgeData?.encryptionKey) {
                            encryptedQuestionsRef.current = edgeData.encryptedQuestions;
                            encryptionKeyRef.current = edgeData.encryptionKey;
                            questions = await decryptMatchQuestions({
                                questions: edgeData.encryptedQuestions,
                                encryption_key: edgeData.encryptionKey,
                            } as unknown as Parameters<typeof decryptMatchQuestions>[0]);
                        } else {
                            questions = await generateWordUpQuestions(category);
                            const fKey = generateSecretKey();
                            encryptedQuestionsRef.current = encryptQuestions(questions, fKey);
                            encryptionKeyRef.current = fKey;
                        }
                    } else {
                        questions = await generateWordUpQuestions(category);
                        const fKey = generateSecretKey();
                        encryptedQuestionsRef.current = encryptQuestions(questions, fKey);
                        encryptionKeyRef.current = fKey;
                    }
                }

                if (isRematchWithSameBot && opponentStatsRef.current) {
                    // Reuse the exact same bot profile & personality for the rematch
                    oppStats = opponentStatsRef.current;
                    if (oppStats.bot_personality) {
                        botPersonalityRef.current = oppStats.bot_personality;
                    }
                } else {
                    consecutiveRematchesRef.current = 0;
                    let userRating = 600;
                    if (props.userId) {
                        try {
                            const { data: catProfile } = await supabase
                                .from("wordup_category_profiles")
                                .select("rating")
                                .eq("user_id", props.userId)
                                .eq("category", category)
                                .maybeSingle();
                            if (catProfile?.rating) {
                                userRating = catProfile.rating;
                            } else {
                                const { data } = await supabase
                                    .from("wordup_profiles")
                                    .select("rating")
                                    .eq("id", props.userId)
                                    .maybeSingle();
                                if (data?.rating) userRating = data.rating;
                            }
                        } catch {
                            // default 600
                        }
                    }

                    const syntheticBot = await getOrSpawnBotOpponent({
                        userRating,
                        category,
                        excludeBotId: opponentStatsRef.current?.id || null,
                    });

                    botPersonalityRef.current = syntheticBot.bot_personality;
                    botProfileRef.current = syntheticBot.bot_personality.archetype || "average";
                    oppStats = botToProfileStats(syntheticBot);
                }

                matchData = {
                    id: mId,
                    category,
                    player1_id: props.userId || null,
                    player2_id: oppStats?.id || null,
                    status: "active",
                    is_bot_match: true,
                    bot_profile: botProfileRef.current,
                    game_type: "live-bot",
                    current_question_index: 0,
                    p1_answers: [],
                    p2_answers: [],
                    p1_answered: false,
                    p2_answered: false,
                    p1_score: 0,
                    p2_score: 0,
                };
            } else {
                // ── Live match — load from Supabase ──
                consecutiveRematchesRef.current = 0;
                const { data: match } = await supabase
                    .from("wordup_matches")
                    .select("*")
                    .eq("id", mId)
                    .single();
                if (!match) return;
                matchData = match;
                questions = await decryptMatchQuestions(match);
                await preloadMatchImages(questions);

                const oppId = activeRole === "player1" ? match.player2_id : match.player1_id;
                if (oppId) {
                    try {
                        let { data: profileData } = await supabase
                            .from("profiles")
                            .select("id, username, avatar_url")
                            .eq("id", oppId)
                            .maybeSingle();

                        if (!profileData) {
                            const { data: guestData } = await supabase
                                .from("guest_profiles")
                                .select("id, username, avatar_url")
                                .eq("id", oppId)
                                .maybeSingle();
                            profileData = guestData;
                        }

                        if (profileData) {
                            let rating = 600;
                            let rankName = "Bronze";
                            try {
                                const { data: wp } = await supabase
                                    .from("wordup_profiles")
                                    .select("rating, rank_name")
                                    .eq("id", oppId)
                                    .maybeSingle();
                                if (wp) {
                                    rating = wp.rating;
                                    rankName = wp.rank_name;
                                }
                            } catch (e) {
                                console.warn("Failed to fetch opponent wordup_profile:", e);
                            }

                            oppStats = {
                                id: profileData.id,
                                username: profileData.username,
                                avatar_url: profileData.avatar_url,
                                rating: rating,
                                xp: 0,
                                games_played: 0,
                                games_won: 0,
                                games_lost: 0,
                                games_tied: 0,
                                rank_name: rankName,
                            };
                        }
                    } catch (e) {
                        console.error("Failed to load opponent details:", e);
                        oppStats = null;
                    }
                }
            }

            questionsRef.current = questions;
            matchDataRef.current = matchData;
            opponentStatsRef.current = oppStats;
            roleRef.current = activeRole;

            useLiveStore.getState().setMatchData(matchData);
            useLiveStore.getState().setOpponentStats(oppStats);
            useLiveStore.getState().setQuestions(questions);

            const isP1 = activeRole === "player1";
            const initialMyScore = isP1
                ? ((matchData?.p1_score as number) || 0)
                : ((matchData?.p2_score as number) || 0);
            const initialOppScore = isP1
                ? ((matchData?.p2_score as number) || 0)
                : ((matchData?.p1_score as number) || 0);

            setMyScore(initialMyScore);
            setOpponentScore(initialOppScore);
            myScoreRef.current = initialMyScore;
            opponentScoreRef.current = initialOppScore;

            myChoiceRef.current = null;
            opponentChoiceRef.current = null;
            myCurrentPointsRef.current = 0;
            opponentCurrentPointsRef.current = 0;
            setMyCurrentPoints(0);
            setOpponentCurrentPoints(0);
            setMyChoice(null);
            setOpponentChoice(null);
            setLastRoundPopup(false);

            // Enforce visual buffer so the user can see their opponent on VSPreview
            const elapsed = Date.now() - loadStart;
            const bufferDuration = isBotMatchId(mId) ? 650 : 800;
            const remainingDelay = Math.max(0, bufferDuration - elapsed);
            if (remainingDelay > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingDelay));
            }

            setPhase("countdown");

            // ── Supabase Realtime Channel Registration for Live PvP ──
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }

            if (!isBotMatchId(mId)) {
                const channelName = `wordup_match_${mId}`;
                const ch = supabase.channel(channelName);

                ch.on("broadcast", { event: "player_answered" }, ({ payload }) => {
                    const opponentRole = activeRole === "player1" ? "player2" : "player1";
                    if (payload.role === opponentRole && payload.round === currentRoundRef.current) {
                        handleOpponentAnswer(payload.choice, payload.timeTaken);
                    }
                })
                    .on("broadcast", { event: "signal_update" }, ({ payload }) => {
                        const opponentRole = activeRole === "player1" ? "player2" : "player1";
                        if (payload.role === opponentRole) {
                            setOpponentSignalLevel(payload.level);
                        }
                    })
                    .on("broadcast", { event: "quick_chat" }, ({ payload }) => {
                        const opponentRole = activeRole === "player1" ? "player2" : "player1";
                        if (payload.role === opponentRole) {
                            window.dispatchEvent(
                                new CustomEvent("wordup-quick-chat", {
                                    detail: { sender: "opponent", message: payload.message },
                                }),
                            );
                        }
                    })
                    .on("broadcast", { event: "rematch_sent" }, ({ payload }) => {
                        const opponentRole = activeRole === "player1" ? "player2" : "player1";
                        if (payload.role === opponentRole) {
                            setRematchState("received");
                            rematchStateRef.current = "received";
                        }
                    })
                    .on("broadcast", { event: "rematch_accepted" }, ({ payload }) => {
                        const opponentRole = activeRole === "player1" ? "player2" : "player1";
                        if (payload.role === opponentRole && payload.newMatchId) {
                            setRematchState("idle");
                            rematchStateRef.current = "idle";
                            const nextRole = activeRole === "player1" ? "player2" : "player1";
                            onRematchAccepted(payload.newMatchId, nextRole);
                        }
                    })
                    .on("broadcast", { event: "match_abandoned" }, () => {
                        triggerToast("Opponent left the match.", TOAST_DURATION.DEFAULT);
                        stopAllTimers();
                        setPhase("idle");
                        useLiveStore.getState().setView("menu");
                        useLiveStore.getState().resetGame();
                    })
                    .subscribe((status) => {
                        if (status === "SUBSCRIBED") {
                            console.log(`Subscribed to match channel: ${channelName}`);
                        }
                    });

                channelRef.current = ch;
            }
        },
        [
            handleOpponentAnswer,
            onRematchAccepted,
            props.userId,
            triggerToast,
            stopAllTimers,
            stopBotRematchTimer,
            stopRematchInterval,
        ],
    );

    const engineState = {
        phase,
        selectedAnswer: myChoice,
        rematchState,
        rematchCountdown,
        showRematchButton,
        isConnected: true,
        opponentSignalLevel,
        countdownText,
        lastRoundPopup,
    };

    return {
        state: engineState,
        isConnected: true,
        opponentSignalLevel,
        startMatch,
        handleAnswerSelect,
        handleOpponentAnswer,
        sendRematch,
        acceptRematch,
        sendQuickChat,
        sendSignalUpdate,
        cleanup,
        abortMatch,
        purgeAndReset,
    };
}
