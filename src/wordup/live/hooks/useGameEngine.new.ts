// ── Simplified live game engine ────────────────────────────────────
//
// ≈ 150 lines, zero useReducer, zero stale closures.
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
// State is plain useState.  All data that timeout / interval callbacks
// need is mirrored to refs so the callbacks never capture stale
// closures.
//
// Supports live-bot (simulated bot opponent) and live PvP (real
// opponent over Supabase realtime).

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useLiveStore } from "../store/useLiveStore";
import { wordupAudio } from "../../../utils/wordupAudio";
import { getQuestionDuration, calcPoints } from "./useGameEngine.core";
import {
    decryptMatchQuestions,
    generateWordUpQuestions,
    generateSecretKey,
    encryptQuestions,
    simulateBotResponse,
} from "../../../utils/wordupQuestionGenerator";
import { preloadMatchImages } from "../../../utils/wordupQuestionPostProcessor";
import { BOT_PROFILES } from "../../../utils/wordupQuestionGenerator";
import { safeLocalStorage } from "../../../utils/storage";
import { BOT_PROFILES_RATINGS } from "../../../constants/wordup";
import { isProceduralCategory } from "../../../services/wordup/generatorRegistry";
import type { WordUpQuestion } from "../../../utils/wordupQuestionGenerator";
import type { ProfileStats } from "../../shared/types";

// ── Types ─────────────────────────────────────────────────────────

type Status = "idle" | "countdown" | "playing" | "reveal" | "gameover";
type GameType = "live" | "live-bot";

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
) {
    return {
        ...matchData,
        id: cleanId || matchData.id,
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
    const [countdownText, setCountdownText] = useState("3");
    const [lastRoundPopup, setLastRoundPopup] = useState(false);

    // Live PvP States
    const [opponentSignalLevel, setOpponentSignalLevel] = useState(0);
    const [rematchState, setRematchState] = useState<"idle" | "sent" | "received" | "expired">("idle");
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

    // Timer IDs
    const countdownRef = useRef<number | null>(null);
    const roundTickRef = useRef<number | null>(null);
    const revealRef = useRef<number | null>(null);
    const overallRef = useRef<number | null>(null);
    const botTimerRef = useRef<number | null>(null);

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
    });

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
        stopRematchInterval();
        wordupAudio.stopFinalRoundBeat();
    }, [stopCountdown, stopRoundTick, stopReveal, stopOverall, stopBotTimer, stopRematchInterval]);

    // ══════════════════════════════════════════════════════════════════
    // Internal actions (read refs, safe inside timeouts)
    // ══════════════════════════════════════════════════════════════════

    /** Advance to the next round — accumulates points, resets choices. */
    const advanceRound = useCallback(() => {
        const next = currentRoundRef.current + 1;
        if (next > 6) return;

        transitioningRef.current = false;

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

        setMyScore((s) => s + myCurrentPointsRef.current);
        setOpponentScore((s) => s + opponentCurrentPointsRef.current);

        setCurrentRound(next);
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

    /** End the game, call onGameOver, clean up. */
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
        onGameOver(buildFinalMatch(md || {}, roleRef.current, finalMy, finalOpp, cleanIdRef.current, botProfileRef.current, encryptedQuestionsRef.current, encryptionKeyRef.current));

        // Start rematch countdown for live PvP matches
        if (gameTypeRef.current === "live") {
            setShowRematchButton(true);
            setRematchCountdown(10);
            
            stopRematchInterval();
            rematchIntervalRef.current = window.setInterval(() => {
                setRematchCountdown(prev => {
                    if (prev <= 1) {
                        stopRematchInterval();
                        setShowRematchButton(false);
                        setRematchState("expired");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    }, [onGameOver, stopAllTimers, stopRematchInterval]);

    const beginReveal = useCallback(() => {
        transitioningRef.current = true;
        stopRoundTick();
        stopBotTimer();

        const isLast = currentRoundRef.current >= 6;
        const delay = isLast ? 3200 : 1800;

        setPhase("reveal");

        revealRef.current = window.setTimeout(() => {
            revealRef.current = null;
            if (isLast) {
                endGame();
            } else if (currentRoundRef.current === 5) {
                wordupAudio.playFinalRoundAnticipationStart();
                triggerToast("FINAL ROUND: DOUBLE POINTS!", 3000);
                setLastRoundPopup(true);

                revealRef.current = window.setTimeout(() => {
                    revealRef.current = null;
                    setLastRoundPopup(false);
                    advanceRound();
                    wordupAudio.startFinalRoundBeat();
                }, 3000);
            } else {
                advanceRound();
            }
        }, delay);
    }, [triggerToast, advanceRound, endGame, stopRoundTick, stopBotTimer]);

    // ══════════════════════════════════════════════════════════════════
    // EFFECT 1 — Countdown (3 → 2 → 1 → playing)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (phase !== "countdown") return;

        Promise.resolve().then(() => {
            setCountdownText("3");
        });
        wordupAudio.playCountdownTick(3);
        let count = 3;

        countdownRef.current = window.setInterval(() => {
            count--;
            if (count <= 0) {
                stopCountdown();
                wordupAudio.playGameStart();

                // Start the first round
                setCurrentRound(0);
                setMyChoice(null);
                setOpponentChoice(null);
                setMyCurrentPoints(0);
                setOpponentCurrentPoints(0);
                const q = questionsRef.current[0];
                const dur = q ? getQuestionDuration(q.type) : 10;
                setTimeRemaining(dur);
                setMaxTime(dur);
                roundStartedAtRef.current = Date.now();
                setPhase("playing");
            } else {
                setCountdownText(String(count));
                wordupAudio.playCountdownTick(count);
            }
        }, 1000);

        return stopCountdown;
    }, [phase, stopCountdown]);

    // ══════════════════════════════════════════════════════════════════
    // EFFECT 2 — Round tick (50 ms) + overall safety timer
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
                // If the game somehow isn't over by now, force it
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

                // Auto-submit empty answer for the player if they haven't answered
                if (myChoiceRef.current === null) {
                    setMyChoice("");
                    setMyCurrentPoints(0);
                }

                // Auto-submit empty answer for the opponent if they haven't answered
                if (opponentChoiceRef.current === null) {
                    if (gameTypeRef.current === "live-bot") {
                        const bq = questionsRef.current[currentRoundRef.current];
                        if (bq) {
                            const bDur = getQuestionDuration(bq.type);
                            const br = simulateBotResponse(bq, botProfileRef.current, bDur);
                            const botChoice = pickBotChoice(bq, br.correct);
                            const pts = calcPoints(br.correct, br.time_taken, bDur, currentRoundRef.current === 6);
                            setOpponentChoice(botChoice);
                            setOpponentCurrentPoints(pts);
                        } else {
                            setOpponentChoice("");
                            setOpponentCurrentPoints(0);
                        }
                    } else {
                        setOpponentChoice("");
                        setOpponentCurrentPoints(0);
                    }
                }

                // Tick sound when ≤ 5 s remain
                if (remaining <= 5.0 && remaining > 0) {
                    // Import inline to avoid circular dep — wordupAudio is side-effect-free
                    void (async () => {
                        const { wordupAudio } = await import("../../../utils/wordupAudio");
                        wordupAudio.playTicking();
                    })();
                }
            }
        }, 50);

        // ── Independent bot answer timer ──
        if (gameTypeRef.current === "live-bot" && opponentChoiceRef.current === null) {
            const bq = questionsRef.current[currentRound];
            if (bq) {
                const bDur = getQuestionDuration(bq.type);
                const br = simulateBotResponse(bq, botProfileRef.current, bDur);
                const botMs = Math.max(200, br.time_taken * 1000);
                botTimerRef.current = window.setTimeout(() => {
                    botTimerRef.current = null;
                    if (opponentChoiceRef.current !== null) return;
                    const botChoice = pickBotChoice(bq, br.correct);
                    const pts = calcPoints(br.correct, br.time_taken, bDur, currentRoundRef.current === 6);
                    setOpponentChoice(botChoice);
                    setOpponentCurrentPoints(pts);
                }, botMs);
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

        // Map status → view
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
            // Show live running scores
            const showRunning = phase === "playing" || phase === "reveal";
            const runningMy = myScore + (showRunning ? myCurrentPoints : 0);
            const runningOpp = opponentScore + (showRunning ? opponentCurrentPoints : 0);
            s.setMatchData({
                ...matchDataRef.current,
                p1_score: roleRef.current === "player1" ? runningMy : runningOpp,
                p2_score: roleRef.current === "player1" ? runningOpp : runningMy,
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

    /**
     * Handle the player selecting an answer (or empty string for timeout).
     * For live-bot: immediately schedules a simulated bot answer.
     */
    const handleAnswerSelect = useCallback((choice: string) => {
        if (myChoiceRef.current !== null || phaseRef.current !== "playing") return;

        const q = questionsRef.current[currentRoundRef.current];
        if (!q) return;

        const duration = getQuestionDuration(q.type);
        const elapsed = (Date.now() - roundStartedAtRef.current) / 1000;
        const timeTaken = parseFloat(elapsed.toFixed(2));
        const correct = choice !== "" && choice === q.answer;
        const pts = calcPoints(correct, timeTaken, duration, currentRoundRef.current === 6);

        myTimeTakenRef.current = timeTaken;
        setMyChoice(choice);
        setMyCurrentPoints(pts);

        // Play sound
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
                    timeTaken: timeTaken
                }
            });
        }

        // Live-bot: answer immediately for fast UX
        if (gameTypeRef.current === "live-bot" && opponentChoiceRef.current === null) {
            stopBotTimer();
            const br = simulateBotResponse(q, botProfileRef.current, duration);
            const botChoice = pickBotChoice(q, br.correct);
            const botPts = calcPoints(
                br.correct,
                br.time_taken,
                duration,
                currentRoundRef.current === 6,
            );
            opponentTimeTakenRef.current = br.time_taken;
            setOpponentChoice(botChoice);
            setOpponentCurrentPoints(botPts);
        }
    }, [stopBotTimer]);

    /**
     * Handle opponent answer from a live PvP broadcast.
     * Called externally when a `player_answered` message arrives.
     */
    const handleOpponentAnswer = useCallback((choice: string, timeTaken: number) => {
        if (opponentChoiceRef.current !== null || phaseRef.current !== "playing") return;

        const q = questionsRef.current[currentRoundRef.current];
        const duration = q ? getQuestionDuration(q.type) : 10;
        const correct = choice === q?.answer;
        const pts = calcPoints(correct, timeTaken, duration, currentRoundRef.current === 6);

        opponentTimeTakenRef.current = timeTaken;
        setOpponentChoice(choice);
        setOpponentCurrentPoints(pts);
    }, []);

    // ── Stub functions (preserved API, currently no-ops) ─────────
    const sendRematch = useCallback(() => {
        if (!channelRef.current || !roleRef.current) return;
        setRematchState("sent");
        channelRef.current.send({
            type: "broadcast",
            event: "rematch_sent",
            payload: { role: roleRef.current }
        });
    }, []);

    const acceptRematch = useCallback(async (onMatchFoundCb?: (mId: string, role: "player1" | "player2") => void) => {
        if (!channelRef.current || !roleRef.current || !matchDataRef.current) return;

        const newMatchId = `rematch-${crypto.randomUUID()}`;
        setRematchState("idle");

        channelRef.current.send({
            type: "broadcast",
            event: "rematch_accepted",
            payload: { role: roleRef.current, newMatchId }
        });

        const nextRole = roleRef.current === "player1" ? "player2" : "player1";

        try {
            const category = useLiveStore.getState().category || "mixed";
            const p1 = roleRef.current === "player1" ? matchDataRef.current.player2_id : matchDataRef.current.player1_id;
            const p2 = roleRef.current === "player1" ? matchDataRef.current.player1_id : matchDataRef.current.player2_id;

            await supabase.from("wordup_matches").upsert({
                id: newMatchId,
                category,
                player1_id: p1,
                player2_id: p2,
                status: "waiting",
                game_type: "live"
            });
        } catch (e) {
            console.error("Failed to register rematch matching:", e);
        }

        if (onMatchFoundCb) {
            onMatchFoundCb(newMatchId, nextRole);
        }
    }, []);

    const sendQuickChat = useCallback((message: string) => {
        if (!channelRef.current || !roleRef.current) return;

        window.dispatchEvent(new CustomEvent("wordup-quick-chat", {
            detail: { sender: "self", message }
        }));

        channelRef.current.send({
            type: "broadcast",
            event: "quick_chat",
            payload: { role: roleRef.current, message }
        });
    }, []);

    const sendSignalUpdate = useCallback((level: number) => {
        if (!channelRef.current || !roleRef.current) return;

        channelRef.current.send({
            type: "broadcast",
            event: "signal_update",
            payload: { role: roleRef.current, level }
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
        if (mId && !mId.startsWith("bot-match-")) {
            if (channelRef.current) {
                channelRef.current.send({
                    type: "broadcast",
                    event: "match_abandoned",
                    payload: { role: roleRef.current }
                });
            }
            try {
                await supabase
                    .from("wordup_matches")
                    .update({ status: "abandoned" })
                    .eq("id", mId);
            } catch (e) {
                console.error("Failed to mark match as abandoned in DB:", e);
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
            const loadStart = Date.now();
            let questions: WordUpQuestion[];
            let matchData: Record<string, unknown>;
            let oppStats: ProfileStats | null = null;

            if (mId.startsWith("bot-match-")) {
                // ── Local bot match — generate questions on the fly ──
                const category = useLiveStore.getState().category || "mixed";
                matchData = {
                    id: mId,
                    category,
                    status: "active",
                    is_bot_match: true,
                    game_type: "live-bot",
                    current_question_index: 0,
                    p1_answers: [],
                    p2_answers: [],
                    p1_answered: false,
                    p2_answered: false,
                    p1_score: 0,
                    p2_score: 0,
                };
                if (isProceduralCategory(category)) {
                    const cleanId = mId.startsWith("bot-match-") ? mId.slice(10) : mId;
                    cleanIdRef.current = cleanId;
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
                let userRating = 600;
                if (props.userId) {
                    // First: try category-specific rating (all categories including "mixed")
                    const { data: catProfile } = await supabase
                        .from("wordup_category_profiles")
                        .select("rating")
                        .eq("user_id", props.userId)
                        .eq("category", category)
                        .maybeSingle();
                    if (catProfile?.rating) {
                        userRating = catProfile.rating;
                    } else if (category === "mixed") {
                        // Fallback for "mixed": use global profile rating
                        const { data } = await supabase
                            .from("wordup_profiles")
                            .select("rating")
                            .eq("id", props.userId)
                            .maybeSingle();
                        if (data?.rating) userRating = data.rating;
                    }
                }

                const botKeys = Object.keys(BOT_PROFILES);
                let bp = "average";

                if (Math.random() < 1 / 3) {
                    bp = botKeys[Math.floor(Math.random() * botKeys.length)];
                } else {
                    let minDiff = Infinity;
                    for (const key of botKeys) {
                        const botRating = BOT_PROFILES_RATINGS[key] || 1000;
                        const diff = Math.abs(botRating - userRating);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bp = key;
                        }
                    }
                }
                botProfileRef.current = bp;
                const prof = BOT_PROFILES[bp];
                const botRating = BOT_PROFILES_RATINGS[bp] || 1000;

                oppStats = {
                    username: prof?.name || "Bot",
                    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${bp}`,
                    rating: botRating,
                    xp: 0,
                    games_played: 0,
                    games_won: 0,
                    games_lost: 0,
                    games_tied: 0,
                    rank_name: botRating >= 1700 ? "Master" : botRating >= 1400 ? "Diamond" : botRating >= 1100 ? "Gold" : botRating >= 800 ? "Silver" : "Bronze",
                };
            } else {
                // ── Live match — load from Supabase ──
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

            // Store data in refs (persist across renders, no re-render needed)
            questionsRef.current = questions;
            matchDataRef.current = matchData;
            opponentStatsRef.current = oppStats;
            roleRef.current = activeRole;

            useLiveStore.getState().setMatchData(matchData);
            useLiveStore.getState().setOpponentStats(oppStats);
            useLiveStore.getState().setQuestions(questions);

            // Reset scores and choices for new game
            setMyScore(0);
            setOpponentScore(0);
            setMyCurrentPoints(0);
            setOpponentCurrentPoints(0);
            setMyChoice(null);
            setOpponentChoice(null);
            setLastRoundPopup(false);

            // Enforce visual buffer of at least 3 seconds so the user can see their opponent
            const elapsed = Date.now() - loadStart;
            const remainingDelay = Math.max(0, 3000 - elapsed);
            if (remainingDelay > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingDelay));
            }

            // Start the countdown
            setPhase("countdown");

            // ── Supabase Realtime Channel Registration for Live PvP ──
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }

            if (!mId.startsWith("bot-match-")) {
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
                        window.dispatchEvent(new CustomEvent("wordup-quick-chat", {
                            detail: { sender: "opponent", message: payload.message }
                        }));
                    }
                })
                .on("broadcast", { event: "rematch_sent" }, ({ payload }) => {
                    const opponentRole = activeRole === "player1" ? "player2" : "player1";
                    if (payload.role === opponentRole) {
                        setRematchState("received");
                    }
                })
                .on("broadcast", { event: "rematch_accepted" }, ({ payload }) => {
                    const opponentRole = activeRole === "player1" ? "player2" : "player1";
                    if (payload.role === opponentRole && payload.newMatchId) {
                        setRematchState("idle");
                        const nextRole = activeRole === "player1" ? "player2" : "player1";
                        onRematchAccepted(payload.newMatchId, nextRole);
                    }
                })
                .on("broadcast", { event: "match_abandoned" }, () => {
                    triggerToast("Opponent left the match.", 3000);
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
        [handleOpponentAnswer, onRematchAccepted, props.userId, abortMatch, triggerToast, stopAllTimers],
    );

    // ── Derive computed state shape for LiveView ─────────────────
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
        opponentSignalLevel: 0,
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
