import { useReducer, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import {
   decryptMatchQuestions, generateWordUpQuestions, generateSecretKey,
   encryptQuestions, simulateBotResponse, getRandomBotProfile,
} from "../../../../utils/wordupQuestionGenerator";
import { preloadMatchImages } from "../../../../utils/wordupQuestionPostProcessor";
import { generateMatchQuestions } from "../../../../services/wordup/questionService";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { safeSessionStorage, safeLocalStorage } from "../../../../utils/storage";
import { wordupNetworkGate } from "../services/wordupNetworkGate";
import { QUESTION_DURATION, WORDUP_TIMEOUT } from "../../../../constants/wordup";
import { gameEngineReducer, initialState, type GameType } from "./useWordUpGameEngine.types";

export function getQuestionDuration(type: string): number {
   return QUESTION_DURATION[type] ?? QUESTION_DURATION.default;
}

interface EngineProps {
   gameType: GameType;
   matchId: string | null;
   role: "player1" | "player2" | null;
   getSyncedNow: () => number;
   triggerToast: (msg: string, dur?: number) => void;
   onGameOver: (match: any) => void;
   onRematchAccepted: (newMatchId: string, role: "player1" | "player2") => void;
}

export function useWordUpGameEngine(props: EngineProps) {
   const { gameType, matchId, role, getSyncedNow, triggerToast, onGameOver, onRematchAccepted } = props;
   const [state, dispatch] = useReducer(gameEngineReducer, initialState);

   // ── Refs grouped by purpose ───────────────────────────────────────────
   const T = useRef({
      roundInterval: null as number | null,
      botTimeout: null as number | null,
      revealTimeout: null as number | null,
      safetyTimeout: null as number | null,
      countdownInterval: null as number | null,
      rematchHide: null as number | null,
      rematchCountdown: null as number | null,
      rematchFallback: null as number | null,
      opponentWatchdog: null as number | null,
      recoveryDelay: null as number | null,
      lastRoundPopupTimeout: null as number | null,
   });

   const G = useRef({
      isSubmitting: false,
      isAdvancing: false,
      isRevealing: false,
      isEnding: false,
   });

   const S = useRef({
      matchData: null as any,
      questions: [] as any[],
      currentRound: 0,
      revealAnswers: false,
      timeLeft: 0,
      role: null as "player1" | "player2" | null,
      maxTime: 0,
   });

   const channel = useRef<any>(null);
   const launchedId = useRef<string | null>(null);
   const botAction = useRef<any>(null);

   // Keep snapshots current on every render
   S.current.matchData = state.matchData;
   S.current.questions = state.questions;
   S.current.currentRound = state.currentRound;
   S.current.revealAnswers = state.revealAnswers;
   S.current.timeLeft = state.timeLeft;
   S.current.role = role;
   S.current.maxTime = state.maxTime;

   // ── Timer helpers ─────────────────────────────────────────────────────
   function clearT(name: keyof typeof T.current) {
      const h = T.current[name];
      if (h === null) return;
      if (name === "roundInterval" || name === "countdownInterval" || name === "rematchCountdown") clearInterval(h);
      else clearTimeout(h);
      T.current[name] = null;
   }
   function clearAllT() {
      for (const k of Object.keys(T.current) as (keyof typeof T.current)[]) clearT(k);
   }

   // ── Callback refs (for timer/channel callbacks to avoid stale closures) ─
   const cb = useRef({
      handleMatchUpdate: null as ((m: any) => void) | null,
      handleAnswerSelect: null as ((c: string) => void) | null,
      advanceRound: null as ((id: string, idx: number) => void) | null,
      endGame: null as ((m: any) => void) | null,
      startQuestionRound: null as ((m: any, idx: number) => void) | null,
      acceptRematch: null as ((cb: any) => void) | null,
   });

   // ── Sync engine state to Zustand store ────────────────────────────────
   const phaseToView: Record<string, string> = {
      loading: "loading", countdown: "countdown",
      playing: "battle", reveal: "battle", gameover: "gameover",
   };

   useEffect(() => {
      const store = useWordUpStore.getState();
      const targetView = phaseToView[state.phase];
      if (targetView && store.view !== targetView) {
         store.setView(targetView as any);
      }
      store.setIsBattlePlaying(state.phase === "playing" || state.phase === "reveal");
   }, [state.phase]);

   useEffect(() => { useWordUpStore.getState().setCurrentIdx(state.currentRound); }, [state.currentRound]);
   useEffect(() => { useWordUpStore.getState().setTimeLeft(state.timeLeft); }, [state.timeLeft]);
   useEffect(() => { useWordUpStore.getState().setMaxTime(state.maxTime); }, [state.maxTime]);
   useEffect(() => { useWordUpStore.getState().setSelectedAnswer(state.selectedAnswer); }, [state.selectedAnswer]);
   useEffect(() => { useWordUpStore.getState().setRevealAnswers(state.revealAnswers); }, [state.revealAnswers]);
   useEffect(() => { useWordUpStore.getState().setOpponentStats(state.opponentStats); }, [state.opponentStats]);
   useEffect(() => { if (state.matchData) useWordUpStore.getState().setMatchData(state.matchData); }, [state.matchData]);
   useEffect(() => { if (state.questions.length > 0) useWordUpStore.getState().setQuestions(state.questions); }, [state.questions]);

   // ── Reset guards on matchId change ────────────────────────────────────
   useEffect(() => { G.current.isEnding = false; G.current.isRevealing = false; G.current.isSubmitting = false; G.current.isAdvancing = false; }, [matchId]);

   // ── Safety timer ──────────────────────────────────────────────────────
   useEffect(() => {
      if (state.phase === "loading" || state.phase === "countdown") {
         clearT("safetyTimeout");
         T.current.safetyTimeout = window.setTimeout(() => {
            if (useWordUpStore.getState().view === "battle") return;
            console.warn("[WordUp Logs] Safety timeout — game failed to start");
            triggerToast("Game creation timed out. Please try again.", WORDUP_TIMEOUT.TOAST_DURATION);
            clearAllT();
            safeLocalStorage.removeItem("wordup_active_game");
            dispatch({ type: "RESET" });
         }, WORDUP_TIMEOUT.SAFETY);
      } else {
         clearT("safetyTimeout");
      }
   }, [state.phase, triggerToast]);

   // ── Ambient audio ─────────────────────────────────────────────────────
   useEffect(() => {
      if (state.phase === "countdown" || state.phase === "playing" || state.phase === "reveal") wordupAudio.startAmbient();
      else wordupAudio.stopAmbient();
      return () => wordupAudio.stopAmbient();
   }, [state.phase]);

   // ══════════════════════════════════════════════════════════════════════
   // CORE GAME FLOW
   // ══════════════════════════════════════════════════════════════════════

   const handleMatchUpdate = useCallback((newMatch: any) => {
      const cur = S.current.matchData;
      if (!cur) { dispatch({ type: "SET_MATCH_DATA", data: newMatch }); return; }

      const merged = { ...cur, ...newMatch };
      if ((cur.p1_answers?.length || 0) > (newMatch.p1_answers?.length || 0)) {
         merged.p1_answers = cur.p1_answers; merged.p1_score = cur.p1_score; merged.p1_answered = cur.p1_answered;
      }
      if ((cur.p2_answers?.length || 0) > (newMatch.p2_answers?.length || 0)) {
         merged.p2_answers = cur.p2_answers; merged.p2_score = cur.p2_score; merged.p2_answered = cur.p2_answered;
      }
      merged.current_question_index = Math.max(cur.current_question_index || 0, newMatch.current_question_index || 0);
      if (cur.status === "active" && newMatch.status === "countdown") merged.status = "active";
      dispatch({ type: "SET_MATCH_DATA", data: merged });

      // Reveal condition
      const both = merged.p1_answered && merged.p2_answered;
      const meAns = (S.current.role === "player1" ? merged.p1_answered : merged.p2_answered)
         && ((merged.p1_answers?.length || 0) > 0 || (merged.p2_answers?.length || 0) > 0);
      const shouldReveal = gameType === "async"
         ? meAns && !S.current.revealAnswers && !G.current.isRevealing
         : both && !S.current.revealAnswers && !G.current.isRevealing;

      if (shouldReveal) {
         G.current.isRevealing = true;
         clearT("roundInterval"); clearT("botTimeout");
         dispatch({ type: "REVEAL" });
         const nextIdx = merged.current_question_index + 1;
         if (nextIdx === 6) triggerToast("FINAL ROUND: DOUBLE POINTS!", 3000);
         clearT("revealTimeout");
         T.current.revealTimeout = window.setTimeout(() => {
            G.current.isRevealing = false; clearT("revealTimeout");
            if (nextIdx >= 7) {
               const latest = S.current.matchData;
               if (latest) cb.current.endGame?.(latest);
            } else {
               cb.current.advanceRound?.(merged.id, nextIdx);
            }
         }, nextIdx === 6 ? 3200 : 1800);
      }

      if (merged.current_question_index !== S.current.currentRound
         && (merged.status === "active" || merged.status === "countdown")) {
         if (merged.current_question_index === 6 && !T.current.lastRoundPopupTimeout) {
            dispatch({ type: "SET_LAST_ROUND_POPUP", show: true });
            clearT("lastRoundPopupTimeout");
            T.current.lastRoundPopupTimeout = window.setTimeout(() => {
               dispatch({ type: "SET_LAST_ROUND_POPUP", show: false });
               clearT("lastRoundPopupTimeout");
               const nq = S.current.questions[6];
               const nd = nq ? getQuestionDuration(nq.type) : 10.0;
               dispatch({ type: "SET_ROUND", round: 6, timeLeft: nd, maxTime: nd });
               cb.current.startQuestionRound?.(S.current.matchData, 6);
            }, 1500);
         } else {
            cb.current.startQuestionRound?.(merged, merged.current_question_index);
         }
      }

      if (merged.status === "completed") {
         safeSessionStorage.setItem("wordup_completed_" + merged.id, "true");
         dispatch({ type: "SHOW_REMATCH_BUTTON", show: true });
         clearT("rematchHide");
         T.current.rematchHide = window.setTimeout(() => { dispatch({ type: "SHOW_REMATCH_BUTTON", show: false }); clearT("rematchHide"); }, 120000);
         onGameOver(merged);
      }
   }, [gameType, triggerToast, onGameOver]);
   cb.current.handleMatchUpdate = handleMatchUpdate;

    const advanceRound = useCallback((_mId: string, nextIdx: number) => {
       if (G.current.isAdvancing) return;
       G.current.isAdvancing = true;
       const nextQ = S.current.questions[nextIdx];
       const nextDur = nextQ ? getQuestionDuration(nextQ.type) : 10.0;
       const isP1 = S.current.role === "player1";
       const upd: any = { ...S.current.matchData, current_question_index: nextIdx, question_started_at: new Date(getSyncedNow()).toISOString() };
       if (gameType === "async") upd[isP1 ? "p1_answered" : "p2_answered"] = false;
       else { upd.p1_answered = false; upd.p2_answered = false; }
       if (gameType === "live")
          channel.current?.send({ type: "broadcast", event: "advance_round", payload: { nextIdx } }).catch(console.error);
       if (nextIdx < 6) {
          dispatch({ type: "SET_ROUND", round: nextIdx, timeLeft: nextDur, maxTime: nextDur });
       }
       cb.current.handleMatchUpdate?.(upd);
       G.current.isAdvancing = false;
    }, [gameType, getSyncedNow]);
   cb.current.advanceRound = advanceRound;

   const handleAnswerSelect = useCallback(async (choice: string) => {
      if (G.current.isSubmitting || state.selectedAnswer !== null || state.revealAnswers || !matchId) return;
      G.current.isSubmitting = true;
      dispatch({ type: "ANSWER_SELECTED", answer: choice });
      clearT("roundInterval");
      const q = S.current.questions[S.current.currentRound];
      const duration = q ? getQuestionDuration(q.type) : 10.0;
      const elapsed = parseFloat((duration - S.current.timeLeft).toFixed(2));
      const correct = choice === q?.answer;
      let points = 0;
      if (correct) { const eff = Math.max(0, elapsed - 1.5); const denom = duration - 1.5; points = Math.max(0, Math.round(20 * (1 - eff / (denom > 0 ? denom : duration)))); }
      if (S.current.currentRound === 6) points *= 2;
      if (choice !== "") { if (correct) wordupAudio.playCorrect(); else wordupAudio.playIncorrect(); }
      const sub = { question_idx: S.current.currentRound, correct, time_taken: elapsed, points, choice };

      try {
         const lm = S.current.matchData;
         if (!lm) throw new Error("No match data");
         let upd: any;

         if (gameType === "live-bot") {
            clearT("botTimeout");
            const ba = botAction.current || { correct: Math.random() > 0.5, time_taken: 2.0 };
            let bp = 0;
            if (ba.correct) { const eff = Math.max(0, ba.time_taken - 1.5); const denom = duration - 1.5; bp = Math.max(0, Math.round(20 * (1 - eff / (denom > 0 ? denom : duration)))); }
            if (S.current.currentRound === 6) bp *= 2;
            let bc = q?.answer;
            if (!ba.correct && q?.choices) { const w = q.choices.filter((c: any) => c !== q.answer); bc = w[Math.floor(Math.random() * w.length)] || "WRONG"; }
            upd = {
               ...lm, p1_answers: [...(lm.p1_answers || []), sub], p1_answered: true, p1_score: (lm.p1_score || 0) + points,
               p2_answers: [...(lm.p2_answers || []), { question_idx: S.current.currentRound, correct: ba.correct, time_taken: ba.time_taken, points: bp, choice: bc }],
               p2_answered: true, p2_score: (lm.p2_score || 0) + bp,
            };
         } else {
            const isP1 = S.current.role === "player1";
            const answers = [...((isP1 ? lm.p1_answers : lm.p2_answers) || [])];
            answers.push(sub);
            const ns = ((isP1 ? lm.p1_score : lm.p2_score) ?? 0) + points;
            upd = { ...lm, [isP1 ? "p1_answers" : "p2_answers"]: answers, [isP1 ? "p1_answered" : "p2_answered"]: true, [isP1 ? "p1_score" : "p2_score"]: ns };
         }

         cb.current.handleMatchUpdate?.(upd);

         if (gameType === "live") {
            channel.current?.send({ type: "broadcast", event: "player_answered", payload: { role: S.current.role, answers: upd.p1_answers || upd.p2_answers, score: upd.p1_score || upd.p2_score } }).catch(console.error);
         }
         if (gameType === "async") await persistTurn(upd);
      } catch (err) {
         console.error("[WordUp] handleAnswerSelect error:", err);
         dispatch({ type: "CLEAR_ANSWER" });
      } finally { G.current.isSubmitting = false; }
   }, [matchId, state.selectedAnswer, state.revealAnswers, gameType]);
   cb.current.handleAnswerSelect = handleAnswerSelect;

   // ── Async turn persistence ────────────────────────────────────────────
   const persistTurn = useCallback(async (upd: any) => {
      const isP1 = S.current.role === "player1";
      const myA = isP1 ? upd.p1_answers : upd.p2_answers;
      const oppA = isP1 ? upd.p2_answers : upd.p1_answers;
      const oppDone = oppA?.length >= 7;
      const myDone = myA?.length >= 7;
      try {
         await wordupNetworkGate.enqueue("put", "persist async turn",
            () => fetchWithRetry(async () => {
               const p: any = { [isP1 ? "p1_answers" : "p2_answers"]: myA, [isP1 ? "p1_answered" : "p2_answered"]: true, [isP1 ? "p1_score" : "p2_score"]: isP1 ? upd.p1_score : upd.p2_score };
               if (myDone && oppDone) { p.status = "completed"; p.completed_at = new Date().toISOString(); }
               const { error } = await supabase.from("wordup_matches").update(p).eq("id", upd.id);
               if (error) throw error;
               if (myDone && !oppDone) {
                  const { data } = await supabase.from("wordup_matches").select("*").eq("id", upd.id).single();
                  if (data) cb.current.handleMatchUpdate?.(data);
               }
            }, 3, 1000), true);
         if (myDone && oppDone) {
            safeSessionStorage.setItem("wordup_completed_" + upd.id, "true");
            dispatch({ type: "SET_PHASE", phase: "gameover" });
            onGameOver(upd);
         } else if (myDone) {
            triggerToast("Turn submitted! Waiting for opponent...", 4000);
            dispatch({ type: "SET_PHASE", phase: "idle" });
            useWordUpStore.getState().resetGame();
         }
      } catch (e) { console.error("[WordUp] Async persist failed:", e); triggerToast("Failed to save progress.", 5000); }
   }, [triggerToast, onGameOver]);

   const endGame = useCallback(async (match: any) => {
      if (G.current.isEnding) return;
      G.current.isEnding = true;
      const completedAt = new Date().toISOString();
      const finalMatch = { ...match, status: "completed", p1_answered: true, p2_answered: true, completed_at: completedAt };

      if (gameType === "live") {
         dispatch({ type: "SET_MATCH_DATA", data: finalMatch });
         dispatch({ type: "SET_PHASE", phase: "gameover" });
         onGameOver(finalMatch);
      }

      try {
         console.log(`[WordUp] ${gameType} endGame: pushing to DB`);
          if (gameType === "live-bot") {
            const isLocal = match.id.startsWith("bot-match-");
            if (isLocal) {
              await supabase.from("wordup_matches").insert({
                id: crypto.randomUUID(),
                category: match.category,
                player1_id: match.player1_id,
                player2_id: "00000000-0000-0000-0000-000000000b0b",
                is_bot_match: true,
                game_type: "live-bot",
                bot_profile: match.bot_profile || "average",
                status: "completed",
                p1_answers: match.p1_answers,
                p2_answers: match.p2_answers,
                p1_score: match.p1_score,
                p2_score: match.p2_score,
                p1_answered: true,
                p2_answered: true,
                completed_at: completedAt,
              });
            } else {
              await wordupNetworkGate.enqueue("put", "finalize bot match",
                () => fetchWithRetry(async () => {
                    const { error } = await supabase.from("wordup_matches")
                      .update({ status: "completed", p1_answers: match.p1_answers, p2_answers: match.p2_answers, p1_score: match.p1_score, p2_score: match.p2_score, p1_answered: true, p2_answered: true, completed_at: completedAt })
                      .eq("id", match.id);
                    if (error) throw error;
                }, 3, 1000), true);
            }
         } else {
            await wordupNetworkGate.enqueue("put", "finalize match",
               () => fetchWithRetry(async () => {
                  const { error } = await supabase.from("wordup_matches")
                     .update({ status: "completed", p1_answers: match.p1_answers, p2_answers: match.p2_answers, p1_score: match.p1_score, p2_score: match.p2_score, p1_answered: true, p2_answered: true, completed_at: completedAt })
                     .eq("id", match.id);
                  if (error) throw error;
               }, 3, 1000), true);
         }
         console.log(`[WordUp] ${gameType} sync successful`);
         safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
         safeLocalStorage.removeItem("wordup_active_game");
      } catch (e) {
         console.error(`[WordUp] ${gameType} endGame DB failed:`, e);
         triggerToast("Failed to save final results. Check connection.", 5000);
         if (gameType !== "live" && !match.id.startsWith("bot-match-")) {
            try { await supabase.from("wordup_matches").update({ status: "completed", p1_score: match.p1_score, p2_score: match.p2_score, completed_at: completedAt }).eq("id", match.id); }
            catch { /* best-effort fallback */ }
         }
      }
      if (gameType !== "live") {
         dispatch({ type: "SET_MATCH_DATA", data: finalMatch });
         dispatch({ type: "SET_PHASE", phase: "gameover" });
         onGameOver(finalMatch);
      }
   }, [gameType, triggerToast, onGameOver]);
   cb.current.endGame = endGame;

    // ── Start question round ──────────────────────────────────────────────
    const startQuestionRound = useCallback((_match: any, index: number) => {
       if (S.current.currentRound >= index && T.current.roundInterval !== null && gameType !== "live") return;
       if (S.current.currentRound > index) return;
       S.current.currentRound = index;
       clearT("roundInterval"); clearT("botTimeout");
       const q = S.current.questions[index];
       const duration = q ? getQuestionDuration(q.type) : 10.0;
       botAction.current = null;
       dispatch({ type: "SET_ROUND", round: index, timeLeft: duration, maxTime: duration });
       dispatch({ type: "CLEAR_ANSWER" }); dispatch({ type: "HIDE_REVEAL" });
       G.current.isSubmitting = false;

        const startTime = getSyncedNow();
       let lastTicked = Math.ceil(duration) + 1;
       T.current.roundInterval = window.setInterval(() => {
          const remaining = Math.max(0, duration - (getSyncedNow() - startTime) / 1000);
          dispatch({ type: "TICK", timeLeft: parseFloat(remaining.toFixed(2)) });
          const cs = Math.ceil(remaining);
          if (remaining <= 3.0 && cs < lastTicked) { lastTicked = cs; wordupAudio.playTicking(); }
          if (remaining <= 0) { clearT("roundInterval"); if (useWordUpStore.getState().selectedAnswer === null) cb.current.handleAnswerSelect?.(""); }
       }, 50);

      if (gameType === "live-bot" && q) {
         const bp = _match.bot_profile || "average";
          const br = simulateBotResponse(q, bp, duration);
         const bt = Math.min(br.time_taken, duration - 0.5);
         botAction.current = { ...br, time_taken: bt };
         T.current.botTimeout = window.setTimeout(() => cb.current.handleMatchUpdate?.({ p2_answered: true }), bt * 1000);
      }
   }, [gameType, getSyncedNow]);
   cb.current.startQuestionRound = startQuestionRound;

    // ── Countdown (3-2-1 → battle) ────────────────────────────────────────
    const startCountdown = useCallback((match: any) => {
       clearT("countdownInterval");
       useWordUpStore.getState().setView("countdown");

       if (match.game_type === "live" && match.question_started_at) {
          const startTime = new Date(match.question_started_at).getTime();
          let lastDisplayed = -1;

          T.current.countdownInterval = window.setInterval(() => {
             const remaining = startTime - getSyncedNow();
             const secs = Math.ceil(remaining / 1000);
             const display = Math.min(3, Math.max(0, secs));

             if (display !== lastDisplayed) {
                lastDisplayed = display;
                dispatch({ type: "SET_COUNTDOWN_TEXT", text: String(display || "0") });
             }

             if (remaining <= 0) {
                clearT("countdownInterval");
                dispatch({ type: "SET_PHASE", phase: "playing" });
                if (role === "player2" && !match.id?.startsWith("bot-match-"))
                   supabase.from("wordup_matches").update({ status: "active" }).eq("id", match.id)
                      .then(({ error }: any) => { if (error) console.error("Failed to set active:", error); });
                channel.current?.send({ type: "broadcast", event: "game_active", payload: {} }).catch(console.error);
                cb.current.startQuestionRound?.(match, 0);
             }
          }, 200);
       } else {
          let c = 3;
          dispatch({ type: "SET_COUNTDOWN_TEXT", text: "3" });
          T.current.countdownInterval = window.setInterval(() => {
             c--;
             if (c === 0) {
                clearT("countdownInterval");
                dispatch({ type: "SET_PHASE", phase: "playing" });
                if ((role === "player2" || match.is_bot_match) && match.status !== "waiting" && !match.id?.startsWith("bot-match-"))
                   supabase.from("wordup_matches").update({ status: "active" }).eq("id", match.id)
                      .then(({ error }: any) => { if (error) console.error("Failed to set active:", error); });
                if (match.game_type === "live") channel.current?.send({ type: "broadcast", event: "game_active", payload: {} }).catch(console.error);
                cb.current.startQuestionRound?.(match, 0);
             } else {
                useWordUpStore.getState().setView("countdown");
                dispatch({ type: "SET_COUNTDOWN_TEXT", text: String(c) });
             }
          }, WORDUP_TIMEOUT.COUNTDOWN_INTERVAL);
       }
    }, [role, getSyncedNow]);

   // ── Live watchdog ─────────────────────────────────────────────────────
   useEffect(() => {
      if (gameType !== "live" || !(state.timeLeft === 0 && !state.revealAnswers && state.matchData?.status === "active")) return;
      const wd = window.setTimeout(() => {
         const cur = S.current.matchData;
         if (cur && !S.current.revealAnswers) {
            const isP1 = S.current.role === "player1";
            if ((isP1 ? cur.p1_answered : cur.p2_answered)) return;
            cb.current.handleAnswerSelect?.("");
         }
      }, 1500);
      T.current.opponentWatchdog = wd;
      return () => clearTimeout(wd);
   }, [gameType, state.timeLeft, state.revealAnswers, state.matchData?.status]);

   // ── Persist active game state ─────────────────────────────────────────
   useEffect(() => {
      if (state.phase !== "playing" && state.phase !== "reveal") return;
      const as = { matchId, role, questions: state.questions, currentRound: state.currentRound, matchData: state.matchData, opponentStats: state.opponentStats, revealAnswers: state.revealAnswers, selectedAnswer: state.selectedAnswer, timeLeft: state.timeLeft, maxTime: state.maxTime, gameType };
      if (gameType === "async") { const d = setTimeout(() => safeLocalStorage.setItem("wordup_active_game", JSON.stringify(as)), 1000); return () => clearTimeout(d); }
      safeLocalStorage.setItem("wordup_active_game", JSON.stringify(as));
   }, [state.phase, state.currentRound, state.matchData, state.opponentStats, state.revealAnswers, state.selectedAnswer, state.timeLeft, state.maxTime, matchId, role, state.questions, gameType]);

   // ══════════════════════════════════════════════════════════════════════
   // MATCH LOADING (startMatch is the public entry point)
   // ══════════════════════════════════════════════════════════════════════

   const loadMatch = useCallback(async (mId: string, activeRole: "player1" | "player2") => {
      dispatch({ type: "SET_PHASE", phase: "loading" });

      try {
         // ── Bot match ──
          if (mId.startsWith("bot-match-")) {
            const category = useWordUpStore.getState().category || "mixed";
            let match: any;

            const raw = generateWordUpQuestions(category);
            const sk = generateSecretKey();
            const enc = encryptQuestions(raw, sk);
            let uid = "guest-player";
            try {
               const { data: { session } } = await supabase.auth.getSession();
               uid = session?.user?.id || localStorage.getItem("wordle_anon_id") || "guest-player";
            } catch { uid = localStorage.getItem("wordle_anon_id") || "guest-player"; }

            match = {
               id: mId, category, player1_id: uid, player2_id: "00000000-0000-0000-0000-000000000b0b",
               is_bot_match: true, game_type: "live-bot",
               bot_profile: S.current.matchData?.bot_profile || getRandomBotProfile(),
               status: "countdown", current_question_index: 0,
               p1_answers: [], p2_answers: [], p1_score: 0, p2_score: 0,
               p1_answered: false, p2_answered: false,
               questions: enc, encryption_key: sk,
            };

            if (category === "flag_bearer") {
               try { await preloadMatchImages(raw); } catch { triggerToast("Failed to load images.", 5000); dispatch({ type: "RESET" }); return; }
            }
            dispatch({ type: "SET_QUESTIONS", questions: raw });
            dispatch({ type: "SET_MATCH_DATA", data: match });
            setBotStats(match);
            startCountdown(match);
            return;
         }

         // ── Live / Async match ──
         let match: any;
         try {
            match = await wordupNetworkGate.enqueue("get", `load match ${mId}`, async () => {
               const { data, error } = await supabase.from("wordup_matches").select("*").eq("id", mId).single();
               if (error) throw error; return data;
            });
         } catch { throw new Error("Failed to load match"); }

         if (!match) throw new Error("Match not found");

          if (match.status === "completed" || safeSessionStorage.getItem("wordup_completed_" + mId) === "true") {
             safeSessionStorage.setItem("wordup_completed_" + mId, "true");
             triggerToast("This match has already been completed.", 4000);
             dispatch({ type: "RESET" });
             useWordUpStore.getState().resetGame();
             return;
          }
          const mt = match.created_at ? new Date(match.created_at).getTime() : 0;
          if (match.status !== "completed" && match.status !== "waiting" && Date.now() - mt > 300000) {
             await supabase.from("wordup_matches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", mId);
             triggerToast("This match has expired.", 5000);
             dispatch({ type: "RESET" });
             useWordUpStore.getState().resetGame();
             return;
          }

         dispatch({ type: "SET_MATCH_DATA", data: match });
         const actualGameType = match.game_type || "live";

          if (!match.questions && !match.encrypted_questions) {
            await generateMatchQuestions(match.id, match.category);
            const { data: ref } = await supabase.from("wordup_matches").select("*").eq("id", match.id).single();
            if (ref) { match = ref; dispatch({ type: "SET_MATCH_DATA", data: match }); }
         }

         const dec = await decryptMatchQuestions(match);
         if (match.category === "flag_bearer") await preloadMatchImages(dec);
         dispatch({ type: "SET_QUESTIONS", questions: dec });

          // Load opponent profile (live only)
          if (actualGameType === "live") {
            const oppId = activeRole === "player1" ? match.player2_id : match.player1_id;
            if (oppId) {
               const mp = await wordupNetworkGate.enqueue("get", "load opp profile", async () => {
                  const { data, error } = await supabase.from("profiles").select("username, avatar_url").eq("id", oppId).single();
                  if (error) throw error; return data;
               }).catch(() => null);
               const op = await wordupNetworkGate.enqueue("get", "load opp wordup profile", async () => {
                  const { data, error } = await supabase.from("wordup_profiles").select("*").eq("id", oppId).single();
                  if (error) throw error; return data;
               }).catch(() => null);
               if (op) dispatch({ type: "SET_OPPONENT_STATS", stats: { ...op, username: mp?.username || "Opponent", avatar_url: mp?.avatar_url || null } });
            }
         }

          // Channel subscription
          if (actualGameType === "live") {
            if (channel.current) supabase.removeChannel(channel.current);
            const ch = supabase.channel(`wordup_match_${mId}`, { config: { broadcast: { self: false } } })
               .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wordup_matches", filter: `id=eq.${mId}` }, (p: any) => cb.current.handleMatchUpdate?.(p.new))
               .on("broadcast", { event: "player_answered" }, ({ payload }: any) => {
                  const cur = S.current.matchData; if (!cur) return;
                  const u: any = { ...cur };
                  if (payload.role === "player1") { u.p1_answered = true; u.p1_answers = payload.answers; u.p1_score = payload.score; }
                  else { u.p2_answered = true; u.p2_answers = payload.answers; u.p2_score = payload.score; }
                  cb.current.handleMatchUpdate?.(u);
               })
                 .on("broadcast", { event: "advance_round" }, ({ payload }: any) => {
                    const cur = S.current.matchData; if (!cur) return;
                    cb.current.handleMatchUpdate?.({ ...cur, current_question_index: payload.nextIdx, p1_answered: false, p2_answered: false });
                })
               .on("broadcast", { event: "game_active" }, () => {
                  const cur = S.current.matchData; if (!cur) return;
                  cb.current.handleMatchUpdate?.({ ...cur, status: "active" });
               })
               .on("broadcast", { event: "rematch_request" }, () => {
                  if (useWordUpStore.getState().view !== "gameover") return;
                  if (state.rematchState === "sent") {
                     const lm = S.current.matchData;
                     if (lm) {
                        const myId = activeRole === "player1" ? lm.player1_id : lm.player2_id;
                        const oppId = activeRole === "player1" ? lm.player2_id : lm.player1_id;
                        if (myId && oppId) {
                           if (myId < oppId) cb.current.acceptRematch?.(onRematchAccepted);
                           else {
                              clearT("rematchFallback");
                              T.current.rematchFallback = window.setTimeout(async () => {
                                 if (useWordUpStore.getState().view !== "gameover") return;
                                 const { data } = await supabase.from("wordup_matches").select("id")
                                    .or(`and(player1_id.eq.${myId},player2_id.eq.${oppId}),and(player1_id.eq.${oppId},player2_id.eq.${myId})`)
                                    .in("status", ["countdown", "active"]).order("created_at", { ascending: false }).limit(1);
                                 if (data?.[0]) onRematchAccepted(data[0].id, activeRole);
                              }, 3000);
                           }
                        }
                     }
                     return;
                  }
                  dispatch({ type: "SET_REMATCH_STATE", state: "received" });
                  dispatch({ type: "SET_REMATCH_COUNTDOWN", count: 20 });
                  clearT("rematchCountdown"); let rc = 20;
                  T.current.rematchCountdown = window.setInterval(() => { rc--; if (rc <= 0) { clearT("rematchCountdown"); dispatch({ type: "SET_REMATCH_STATE", state: "expired" }); } else dispatch({ type: "SET_REMATCH_COUNTDOWN", count: rc }); }, 1000);
               })
               .on("broadcast", { event: "rematch_accepted" }, ({ payload }: any) => {
                  clearT("rematchCountdown");
                  if (useWordUpStore.getState().view !== "gameover" || state.rematchState === "expired") return;
                  dispatch({ type: "SET_REMATCH_STATE", state: "idle" });
                  onRematchAccepted(payload.newMatchId, activeRole);
               })
               .on("broadcast", { event: "quick_chat" }, ({ payload }: any) => window.dispatchEvent(new CustomEvent("wordup-quick-chat", { detail: payload })))
               .subscribe((status) => {
                  if (status === "SUBSCRIBED") supabase.from("wordup_matches").select("*").eq("id", mId).single().then(({ data }) => { if (data) cb.current.handleMatchUpdate?.(data); }, () => {});
                  if (status === "CHANNEL_ERROR") triggerToast("Connection lost. Attempting to reconnect...", 3000);
               });
            channel.current = ch;
          } else if (actualGameType === "async") {
            if (channel.current) supabase.removeChannel(channel.current);
            const ch = supabase.channel(`async-match-${mId}`)
               .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wordup_matches", filter: `id=eq.${mId}` }, (p: any) => {
                  if (p.new.status === "completed") {
                     const store = useWordUpStore.getState(); store.setMatchData(p.new);
                     if (!store.questions?.length && p.new.encryption_key) decryptMatchQuestions(p.new).then(dec => store.setQuestions(dec)).catch(() => {});
                     onGameOver(p.new);
                  }
               }).subscribe();
            channel.current = ch;
         }

         // Check match status for recovery
         if (match.status === "active") {
            // Recovery: skip countdown, go directly to playing
            dispatch({ type: "SET_PHASE", phase: "playing" });
            cb.current.startQuestionRound?.(match, match.current_question_index || 0);
         } else {
            wordupAudio.playMatchStart();
            startCountdown(match);
         }
      } catch (err) {
         console.error("[WordUp] loadMatch error:", err);
         triggerToast("Failed to load match questions. Aborting game.", 5000);
         const sd = S.current.matchData;
         if (sd?.id && !sd.id.startsWith("bot-match-") && sd.status !== "completed") {
            supabase.from("wordup_matches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sd.id)
               .then(({ error }) => { if (error) console.error("Failed to set completed on load error:", error); }, console.error);
         }
         dispatch({ type: "RESET" });
      }
   }, [triggerToast, startCountdown, onGameOver, onRematchAccepted]);

   function setBotStats(match: any) {
      const bp = match.bot_profile || "average";
      dispatch({ type: "SET_OPPONENT_STATS", stats: {
         rating: bp === "impossible" ? 2200 : bp === "master" ? 1800 : 1200,
         xp: 5000, games_played: 150, games_won: 95, games_lost: 50, games_tied: 5,
         rank_name: bp === "impossible" ? "Diamond" : "Gold",
      } as any });
   }

   // ══════════════════════════════════════════════════════════════════════
   // PUBLIC API
   // ══════════════════════════════════════════════════════════════════════

   const startMatch = useCallback(async (mId: string, activeRole: "player1" | "player2") => {
      launchedId.current = mId;
      // Reset guards before starting new match
      G.current.isEnding = false; G.current.isRevealing = false; G.current.isSubmitting = false; G.current.isAdvancing = false;
      clearAllT();
      dispatch({ type: "RESET" });
      await loadMatch(mId, activeRole);
   }, [loadMatch]);

   const acceptRematch = useCallback(async (onMatchFoundCallback: (newMatchId: string, role: "player1" | "player2") => void) => {
      const match = S.current.matchData;
      if (!match) return;
      clearT("rematchCountdown");
      try {
         const nm = await wordupNetworkGate.enqueue("post", "create rematch", async () => {
            const { data, error } = await supabase.from("wordup_matches").insert({
               category: match.category, player1_id: match.player1_id,
               player2_id: gameType === "live-bot" ? "00000000-0000-0000-0000-000000000b0b" : match.player2_id,
               is_bot_match: gameType === "live-bot", game_type: gameType,
               bot_profile: gameType === "live-bot" ? (match.bot_profile || "average") : undefined,
               status: "countdown", question_started_at: new Date(getSyncedNow()).toISOString(),
            }).select().single();
            if (error) throw error; return data;
         }, true);
         if (!nm) throw new Error("Failed to create rematch");
         await generateMatchQuestions(nm.id, match.category);
         if (gameType === "live") channel.current?.send({ type: "broadcast", event: "rematch_accepted", payload: { newMatchId: nm.id } }).catch(console.error);
         onMatchFoundCallback(nm.id, gameType === "live-bot" ? "player1" : (S.current.role || "player1"));
      } catch (e) { console.error("[WordUp] acceptRematch failed:", e); triggerToast("Failed to initiate rematch.", 4000); }
   }, [gameType, getSyncedNow, triggerToast]);
   cb.current.acceptRematch = acceptRematch;

   const sendRematch = useCallback(() => {
      dispatch({ type: "SET_REMATCH_STATE", state: "sent" });
      dispatch({ type: "SET_REMATCH_COUNTDOWN", count: 20 });
      if (gameType === "live") channel.current?.send({ type: "broadcast", event: "rematch_request", payload: {} }).catch(console.error);
   }, [gameType]);

   const sendQuickChat = useCallback((text: string) => {
      if (gameType === "live") channel.current?.send({ type: "broadcast", event: "quick_chat", payload: { text, senderRole: S.current.role } }).catch(console.error);
      else window.dispatchEvent(new CustomEvent("wordup-quick-chat", { detail: { text, senderRole: S.current.role } }));
   }, [gameType]);

   const cleanup = useCallback(() => {
      clearAllT();
      if (channel.current) { supabase.removeChannel(channel.current); channel.current = null; }
      launchedId.current = null;
   }, []);

   const abortMatch = useCallback(async () => {
      cleanup();
      if (matchId) {
         await wordupNetworkGate.enqueue("put", "abort match", async () => {
            const { error } = await supabase.from("wordup_matches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", matchId);
            if (error) throw error;
         }).catch((e) => console.error("Failed to abort match:", e));
      }
      safeLocalStorage.removeItem("wordup_active_game");
      dispatch({ type: "RESET" });
      useWordUpStore.getState().resetGame();
      triggerToast("Match aborted.", WORDUP_TIMEOUT.TOAST_DURATION);
   }, [matchId, triggerToast, cleanup]);

   const purgeAndReset = useCallback(async () => {
      cleanup();
      try {
         const user = (await supabase.auth.getSession()).data.session?.user;
         if (user) {
            await supabase.from("wordup_queue").delete().eq("user_id", user.id);
            const { data: stale } = await supabase.from("wordup_matches").select("id, player1_id, player2_id, p1_answered, p2_answered, status")
               .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`).in("status", ["waiting", "countdown"]);
            if (stale) for (const m of stale) { if ((m.player1_id === user.id ? m.p1_answered : m.p2_answered)) await supabase.from("wordup_matches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", m.id); }
         }
      } catch (e) { console.error("Purge error:", e); }
      for (const k of Object.keys(sessionStorage)) { if (k.startsWith("wordup_")) safeSessionStorage.removeItem(k); }
      for (const k of Object.keys(localStorage)) { if (k.startsWith("wordup_")) safeLocalStorage.removeItem(k); }
      dispatch({ type: "RESET" });
      triggerToast("Local data purged and stale matches cleaned.", WORDUP_TIMEOUT.TOAST_DURATION);
   }, [triggerToast, cleanup]);

   // ── Unmount cleanup ──────────────────────────────────────────────────
   useEffect(() => {
      return () => {
         cleanup();
         const store = useWordUpStore.getState();
         if (!(store.view === "battle" || store.view === "countdown" || store.view === "gameover") || !store.matchId) store.resetGame();
      };
   }, [cleanup]);

   // ── Return ───────────────────────────────────────────────────────────
   return {
      state,
      startMatch,
      handleAnswerSelect,
      sendRematch,
      acceptRematch,
      sendQuickChat,
      cleanup,
      abortMatch,
      purgeAndReset,
   };
}
