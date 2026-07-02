import { useReducer, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../utils/wordupAudio";
import { decryptMatchQuestions } from "../../../utils/wordupQuestionGenerator";
import { preloadMatchImages } from "../../../utils/wordupQuestionPostProcessor";
import { generateMatchQuestions } from "../../../services/wordup/questionService";
import { useAsyncStore } from "../store/useAsyncStore";
import { safeLocalStorage, safeSessionStorage } from "../../../utils/storage";
import { wordupNetworkGate } from "../../../components/wordup/WordUpView/services/wordupNetworkGate";
import { WORDUP_TIMEOUT, WORDUP_GAME, QUESTION_DURATION } from "../../../constants/wordup";
import { gameEngineReducer, initialState } from "./useGameEngine.types";

function getQuestionDuration(type: string): number {
   return QUESTION_DURATION[type] ?? QUESTION_DURATION.default;
}

interface EngineProps {
   gameType: "async";
   matchId: string | null;
   role: "player1" | "player2" | null;
   getSyncedNow: () => number;
   triggerToast: (msg: string, dur?: number) => void;
   onGameOver: (match: any) => void;
}

export function useGameEngine(props: EngineProps) {
   const { gameType, matchId, role, getSyncedNow, triggerToast, onGameOver } = props;
   const [state, dispatch] = useReducer(gameEngineReducer, initialState);

   const T = useRef({
      roundInterval: null as number | null,
      revealTimeout: null as number | null,
      safetyTimeout: null as number | null,
      lastRoundPopupTimeout: null as number | null,
      countdownInterval: null as number | null,
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
      roundStartedAt: 0,
   });

   const channel = useRef<any>(null);
   const launchedId = useRef<string | null>(null);

   S.current.matchData = state.matchData;
   S.current.questions = state.questions;
   S.current.currentRound = state.currentRound;
   S.current.revealAnswers = state.revealAnswers;
   S.current.timeLeft = state.timeLeft;
   S.current.role = role;
   S.current.maxTime = state.maxTime;

   function clearT(name: keyof typeof T.current) {
      const h = T.current[name];
      if (h === null) return;
      if (name === "roundInterval" || name === "countdownInterval") clearInterval(h);
      else clearTimeout(h);
      T.current[name] = null;
   }
   function clearAllT() {
      for (const k of Object.keys(T.current) as (keyof typeof T.current)[]) clearT(k);
   }

   const cb = useRef({
      handleMatchUpdate: null as ((m: any) => void) | null,
      handleAnswerSelect: null as ((c: string) => void) | null,
      advanceRound: null as ((id: string, idx: number) => void) | null,
      endGame: null as ((m: any) => void) | null,
      startQuestionRound: null as ((m: any, idx: number) => void) | null,
   });

   const phaseToView: Record<string, string> = {
      loading: "loading",
      countdown: "countdown",
      playing: "battle",
      reveal: "battle",
      gameover: "gameover",
      turn_submitted: "turn_submitted",
   };

   useEffect(() => {
      const store = useAsyncStore.getState();
      const targetView = phaseToView[state.phase];
      if (targetView && store.view !== targetView) {
         store.setView(targetView as any);
      }
      store.setIsBattlePlaying(state.phase === "playing" || state.phase === "reveal");
   }, [state.phase]);

   useEffect(() => { useAsyncStore.getState().setCurrentIdx(state.currentRound); }, [state.currentRound]);
   useEffect(() => { useAsyncStore.getState().setTimeLeft(state.timeLeft); }, [state.timeLeft]);
   useEffect(() => { useAsyncStore.getState().setMaxTime(state.maxTime); }, [state.maxTime]);
   useEffect(() => { useAsyncStore.getState().setSelectedAnswer(state.selectedAnswer); }, [state.selectedAnswer]);
   useEffect(() => { useAsyncStore.getState().setRevealAnswers(state.revealAnswers); }, [state.revealAnswers]);
   useEffect(() => { useAsyncStore.getState().setOpponentStats(state.opponentStats); }, [state.opponentStats]);
   useEffect(() => { if (state.matchData) useAsyncStore.getState().setMatchData(state.matchData); }, [state.matchData]);
   useEffect(() => { if (state.questions.length > 0) useAsyncStore.getState().setQuestions(state.questions); }, [state.questions]);

   useEffect(() => {
      G.current.isEnding = false;
      G.current.isRevealing = false;
      G.current.isSubmitting = false;
      G.current.isAdvancing = false;
   }, [matchId]);

   useEffect(() => {
      if (state.phase === "loading" || state.phase === "countdown") {
         clearT("safetyTimeout");
         T.current.safetyTimeout = window.setTimeout(() => {
            if (useAsyncStore.getState().view === "battle" || useAsyncStore.getState().view === "countdown") return;
            console.warn("[WordUp] Safety timeout — async game failed to start");
            triggerToast("Game creation timed out. Please try again.", WORDUP_TIMEOUT.TOAST_DURATION);
            clearAllT();
            safeLocalStorage.removeItem("wordup_async_active_game");
            dispatch({ type: "RESET" });
         }, WORDUP_TIMEOUT.SAFETY);
      } else {
         clearT("safetyTimeout");
      }
   }, [state.phase, triggerToast]);



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
      dispatch({ type: "SET_MATCH_DATA", data: merged });

      const meAns = (S.current.role === "player1" ? merged.p1_answered : merged.p2_answered)
         && ((merged.p1_answers?.length || 0) > 0 || (merged.p2_answers?.length || 0) > 0);
      const shouldReveal = meAns && !S.current.revealAnswers && !G.current.isRevealing;

      if (shouldReveal) {
         G.current.isRevealing = true;
         clearT("roundInterval");
         dispatch({ type: "REVEAL" });
         const nextIdx = merged.current_question_index + 1;
         if (nextIdx === 6) triggerToast("FINAL ROUND: DOUBLE POINTS!", 3000);
      clearT("revealTimeout");
      T.current.revealTimeout = window.setTimeout(() => {
         G.current.isRevealing = false;
         clearT("revealTimeout");
         if (nextIdx >= WORDUP_GAME.TOTAL_ROUNDS) {
            // All answered — persistTurn in handleAnswerSelect handles phase
         } else if (nextIdx === 6) {
            dispatch({ type: "SET_LAST_ROUND_POPUP", show: true });
            clearT("lastRoundPopupTimeout");
            T.current.lastRoundPopupTimeout = window.setTimeout(() => {
               dispatch({ type: "SET_LAST_ROUND_POPUP", show: false });
               clearT("lastRoundPopupTimeout");
               cb.current.advanceRound?.(merged.id, nextIdx);
            }, 1500);
         } else {
            cb.current.advanceRound?.(merged.id, nextIdx);
         }
      }, nextIdx === 6 ? 3200 : 1800);
      }
   }, [triggerToast]);
   cb.current.handleMatchUpdate = handleMatchUpdate;

   const advanceRound = useCallback((_mId: string, nextIdx: number) => {
      if (G.current.isAdvancing) return;
      G.current.isAdvancing = true;
      const isP1 = S.current.role === "player1";
      const upd: any = {
         ...S.current.matchData,
         current_question_index: nextIdx,
         [isP1 ? "p1_answered" : "p2_answered"]: false,
      };
      dispatch({ type: "SET_MATCH_DATA", data: upd });
      cb.current.startQuestionRound?.(upd, nextIdx);
      G.current.isAdvancing = false;
   }, []);
   cb.current.advanceRound = advanceRound;

   const handleAnswerSelect = useCallback(async (choice: string) => {
      if (G.current.isSubmitting || state.selectedAnswer !== null || state.revealAnswers || !matchId) return;
      G.current.isSubmitting = true;
      dispatch({ type: "ANSWER_SELECTED", answer: choice });
      clearT("roundInterval");

      const q = S.current.questions[S.current.currentRound];
      const duration = q ? getQuestionDuration(q.type) : 30;
      const elapsed = parseFloat((duration - S.current.timeLeft).toFixed(2));
      const correct = choice === q?.answer;
      let points = 0;
      if (correct) {
         const eff = Math.max(0, elapsed - 1.5);
         const denom = duration - 1.5;
         points = Math.max(11, Math.round(20 * (1 - eff / (denom > 0 ? denom : duration))));
      }
      if (S.current.currentRound === 6) points *= 2;
      if (choice !== "") {
         if (correct) wordupAudio.playCorrect(); else wordupAudio.playIncorrect();
      }

      const sub = { question_idx: S.current.currentRound, correct, time_taken: elapsed, points, choice };
      const lm = S.current.matchData;
      if (!lm) { G.current.isSubmitting = false; return; }

      const isP1 = S.current.role === "player1";
      const answers = [...((isP1 ? lm.p1_answers : lm.p2_answers) || [])];
      answers.push(sub);
      const ns = ((isP1 ? lm.p1_score : lm.p2_score) ?? 0) + points;
      const upd = {
         ...lm,
         [isP1 ? "p1_answers" : "p2_answers"]: answers,
         [isP1 ? "p1_answered" : "p2_answered"]: true,
         [isP1 ? "p1_score" : "p2_score"]: ns,
      };

      cb.current.handleMatchUpdate?.(upd);

      const myDone = answers.length >= WORDUP_GAME.TOTAL_ROUNDS;
      if (myDone) {
         await persistTurn(upd);
      }
      G.current.isSubmitting = false;
   }, [matchId, state.selectedAnswer, state.revealAnswers]);
   cb.current.handleAnswerSelect = handleAnswerSelect;

   // ── Async turn persistence ────────────────────────────────────────────
   const persistTurn = useCallback(async (upd: any) => {
      const isP1 = S.current.role === "player1";
      const myA = isP1 ? upd.p1_answers : upd.p2_answers;
      const oppA = isP1 ? upd.p2_answers : upd.p1_answers;
      const oppDone = oppA?.length >= WORDUP_GAME.TOTAL_ROUNDS;
      const myDone = myA?.length >= WORDUP_GAME.TOTAL_ROUNDS;

      try {
         await wordupNetworkGate.enqueue("put", "persist async turn",
            () => fetchWithRetry(async () => {
               const p: any = {
                  [isP1 ? "p1_answers" : "p2_answers"]: myA,
                  [isP1 ? "p1_answered" : "p2_answered"]: true,
                  [isP1 ? "p1_score" : "p2_score"]: isP1 ? upd.p1_score : upd.p2_score,
               };
               if (myDone && oppDone) {
                  p.status = "completed";
                  p.completed_at = new Date().toISOString();
               } else if (myDone) {
                  p.status = "turn_submitted";
               }
               const { error } = await supabase.from("wordup_async_matches").update(p).eq("id", upd.id);
               if (error) throw error;
               if (myDone && !oppDone) {
                  const { data } = await supabase.from("wordup_async_matches").select("*").eq("id", upd.id).single();
                  if (data) cb.current.handleMatchUpdate?.(data);
               }
            }, 3, 1000), true);

          if (myDone && oppDone) {
             safeSessionStorage.setItem("wordup_completed_" + upd.id, "true");
             safeLocalStorage.removeItem("wordup_async_active_game");
             const myScore = S.current.role === "player1" ? upd.p1_score : upd.p2_score;
             const oppScore = S.current.role === "player1" ? upd.p2_score : upd.p1_score;
             if (myScore > oppScore) wordupAudio.playVictory(); else if (myScore < oppScore) wordupAudio.playDefeat();
             dispatch({ type: "SET_PHASE", phase: "gameover" });
             onGameOver(upd);
         } else if (myDone) {
            safeLocalStorage.removeItem("wordup_async_active_game");
            dispatch({ type: "SET_PHASE", phase: "turn_submitted" });
         }
      } catch (e) {
         console.error("[WordUp] Async persist failed:", e);
         triggerToast("Failed to save progress.", 5000);
      }
   }, [triggerToast, onGameOver]);

   const endGame = useCallback(async (match: any) => {
      if (G.current.isEnding) return;
      G.current.isEnding = true;
      const completedAt = new Date().toISOString();
      const finalMatch = { ...match, status: "completed", completed_at: completedAt };

      try {
         await wordupNetworkGate.enqueue("put", "finalize async match",
            () => fetchWithRetry(async () => {
               const { error } = await supabase.from("wordup_async_matches")
                  .update({ status: "completed", completed_at: completedAt })
                  .eq("id", match.id);
               if (error) throw error;
            }, 3, 1000), true);

         safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
         safeLocalStorage.removeItem("wordup_async_active_game");
      } catch (e) {
         console.error("[WordUp] endGame DB failed:", e);
         triggerToast("Failed to save final results.", 5000);
      }

      dispatch({ type: "SET_MATCH_DATA", data: finalMatch });
      dispatch({ type: "SET_PHASE", phase: "gameover" });
      onGameOver(finalMatch);
   }, [triggerToast, onGameOver]);
   cb.current.endGame = endGame;

   const startQuestionRound = useCallback((_match: any, index: number) => {
      if (S.current.currentRound >= index && T.current.roundInterval !== null) return;
      if (S.current.currentRound > index) return;
      S.current.currentRound = index;
      clearT("roundInterval");
      const q = S.current.questions[index];
      const duration = q ? getQuestionDuration(q.type) : QUESTION_DURATION.default;

      // Recover time left if we reloaded
      let elapsed = 0;
      const recoveredGame = safeLocalStorage.getItem("wordup_async_active_game");
      if (recoveredGame) {
         try {
            const parsed = JSON.parse(recoveredGame);
            if (parsed && parsed.matchId === matchId && parsed.currentRound === index && parsed.roundStartedAt) {
               const now = getSyncedNow();
               elapsed = Math.max(0, (now - parsed.roundStartedAt) / 1000);
            }
         } catch {}
      }
      const remaining = Math.max(0, duration - elapsed);

      dispatch({ type: "SET_ROUND", round: index, timeLeft: remaining, maxTime: duration });
      dispatch({ type: "CLEAR_ANSWER" });
      dispatch({ type: "HIDE_REVEAL" });
      G.current.isSubmitting = false;

      if (index === 6) {
         wordupAudio.playFinalRound();
      } else if (index > 0) {
         wordupAudio.playRoundTransition();
      }

      const startTime = getSyncedNow() - (elapsed * 1000);
      S.current.roundStartedAt = startTime;

        let lastTickRemaining = duration;
        T.current.roundInterval = window.setInterval(() => {
           const remainingTime = Math.max(0, duration - (getSyncedNow() - startTime) / 1000);
           dispatch({ type: "TICK", timeLeft: parseFloat(remainingTime.toFixed(2)) });
           if (remainingTime <= 5.0) {
              const desiredInterval = Math.max(0.08, remainingTime * 0.2);
              if (lastTickRemaining - remainingTime >= desiredInterval) {
                 lastTickRemaining = remainingTime;
                 wordupAudio.playTicking();
              }
           }
          if (remainingTime <= 0) {
             clearT("roundInterval");
             if (useAsyncStore.getState().selectedAnswer === null) { wordupAudio.playTimeUp(); cb.current.handleAnswerSelect?.(""); }
          }
      }, 50);
   }, [getSyncedNow]);
   cb.current.startQuestionRound = startQuestionRound;

   const startCountdown = useCallback((match: any) => {
      clearT("countdownInterval");
      dispatch({ type: "SET_PHASE", phase: "countdown" });
      let c = 3;
      dispatch({ type: "SET_COUNTDOWN_TEXT", text: "3" });
      T.current.countdownInterval = window.setInterval(() => {
         c--;
         if (c <= 0) {
            clearT("countdownInterval");
             dispatch({ type: "SET_PHASE", phase: "playing" });
             wordupAudio.playGameStart();
             cb.current.startQuestionRound?.(match, 0);
         } else {
            dispatch({ type: "SET_COUNTDOWN_TEXT", text: String(c) });
         }
      }, 1000);
   }, []);

   // ══════════════════════════════════════════════════════════════════════
   // MATCH LOADING
   // ══════════════════════════════════════════════════════════════════════

   const loadMatch = useCallback(async (mId: string, activeRole: "player1" | "player2") => {
      dispatch({ type: "SET_PHASE", phase: "loading" });

      try {
         let match: any;
         try {
            match = await wordupNetworkGate.enqueue("get", `load async match ${mId}`, async () => {
               const { data, error } = await supabase.from("wordup_async_matches").select("*").eq("id", mId).single();
               if (error) throw error;
               return data;
            });
         } catch {
            throw new Error("Failed to load match");
         }

         if (!match) throw new Error("Match not found");

         if (match.status === "completed" || safeSessionStorage.getItem("wordup_completed_" + mId) === "true") {
            safeSessionStorage.setItem("wordup_completed_" + mId, "true");
            triggerToast("This match has already been completed.", 4000);
            dispatch({ type: "SET_MATCH_DATA", data: match });
            dispatch({ type: "SET_PHASE", phase: "gameover" });
            onGameOver(match);
            return;
         }

         if (match.status === "turn_submitted") {
            dispatch({ type: "SET_MATCH_DATA", data: match });
            const alreadyPlayed = activeRole === "player1" ? match.p1_answered : match.p2_answered;
            if (alreadyPlayed) {
               dispatch({ type: "SET_PHASE", phase: "turn_submitted" });
               return;
            }
         }

         dispatch({ type: "SET_MATCH_DATA", data: match });

         if (!match.questions && !match.encrypted_questions) {
            await generateMatchQuestions(match.id, match.category);
            const { data: ref } = await supabase.from("wordup_async_matches").select("*").eq("id", match.id).single();
            if (ref) { match = ref; dispatch({ type: "SET_MATCH_DATA", data: match }); }
         }

         const dec = await decryptMatchQuestions(match);
          await preloadMatchImages(dec);
         dispatch({ type: "SET_QUESTIONS", questions: dec });

         const oppId = activeRole === "player1" ? match.player2_id : match.player1_id;
         if (oppId) {
            const mp = await wordupNetworkGate.enqueue("get", "load opp profile", async () => {
               const { data, error } = await supabase.from("profiles").select("username, avatar_url").eq("id", oppId).single();
               if (error) throw error;
               return data;
            }).catch(() => null);
            const op = await wordupNetworkGate.enqueue("get", "load opp wordup profile", async () => {
               const { data, error } = await supabase.from("wordup_profiles").select("*").eq("id", oppId).single();
               if (error) throw error;
               return data;
            }).catch(() => null);
            if (op) {
               dispatch({ type: "SET_OPPONENT_STATS", stats: { ...op, username: mp?.username || "Opponent", avatar_url: mp?.avatar_url || null } });
            }
         }

         if (channel.current) supabase.removeChannel(channel.current);
         const ch = supabase.channel(`async-match-${mId}`)
            .on("postgres_changes", {
               event: "UPDATE",
               schema: "public",
               table: "wordup_async_matches",
               filter: `id=eq.${mId}`,
            }, (p: any) => {
               if (p.new.status === "completed") {
                  const store = useAsyncStore.getState();
                  store.setMatchData(p.new);
                  if (!store.questions?.length && p.new.encryption_key) {
                     decryptMatchQuestions(p.new).then(dec => store.setQuestions(dec)).catch(() => {});
                  }
                  clearAllT();
                  safeLocalStorage.removeItem("wordup_async_active_game");
                  dispatch({ type: "SET_PHASE", phase: "gameover" });
                  dispatch({ type: "SET_MATCH_DATA", data: p.new });
                  onGameOver(p.new);
               }
            })
            .subscribe();
          channel.current = ch;

          if (match.current_question_index > 0) {
             dispatch({ type: "SET_PHASE", phase: "playing" });
             cb.current.startQuestionRound?.(match, match.current_question_index || 0);
          } else {
             wordupAudio.playMatchStart();
             startCountdown(match);
          }
       } catch (err) {
         console.error("[WordUp] loadMatch error:", err);
         triggerToast("Failed to load match. Aborting.", 5000);
         const sd = S.current.matchData;
         if (sd?.id && sd.status !== "completed") {
            supabase.from("wordup_async_matches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sd.id)
               .then(({ error }) => { if (error) console.error("Failed to set completed on load error:", error); }, console.error);
         }
         dispatch({ type: "RESET" });
         useAsyncStore.getState().resetGame();
      }
   }, [triggerToast, onGameOver]);

   // ── Persist active game state ─────────────────────────────────────────
   useEffect(() => {
      if (state.phase !== "playing" && state.phase !== "reveal") return;
      const as = {
         matchId, role, questions: state.questions, currentRound: state.currentRound,
         matchData: state.matchData, opponentStats: state.opponentStats,
         revealAnswers: state.revealAnswers, selectedAnswer: state.selectedAnswer,
         timeLeft: state.timeLeft, maxTime: state.maxTime, gameType,
         roundStartedAt: S.current.roundStartedAt,
      };
      const d = setTimeout(() => safeLocalStorage.setItem("wordup_async_active_game", JSON.stringify(as)), 1000);
      return () => clearTimeout(d);
   }, [state.phase, state.currentRound, state.matchData, state.opponentStats, state.revealAnswers, state.selectedAnswer, state.timeLeft, state.maxTime, matchId, role, state.questions, gameType]);

   // ══════════════════════════════════════════════════════════════════════
   // PUBLIC API
   // ══════════════════════════════════════════════════════════════════════

   const startMatch = useCallback(async (mId: string, activeRole: "player1" | "player2") => {
      launchedId.current = mId;
      G.current.isEnding = false;
      G.current.isRevealing = false;
      G.current.isSubmitting = false;
      G.current.isAdvancing = false;
      clearAllT();
      dispatch({ type: "RESET" });
      await loadMatch(mId, activeRole);
   }, [loadMatch]);

   const cleanup = useCallback(() => {
      clearAllT();
      if (channel.current) { supabase.removeChannel(channel.current); channel.current = null; }
      launchedId.current = null;
   }, []);

   const abortMatch = useCallback(() => {
      cleanup();
      if (matchId) {
         wordupNetworkGate.enqueue("put", "abort async match", async () => {
            const { error } = await supabase.from("wordup_async_matches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", matchId);
            if (error) throw error;
         }).catch((e) => console.error("Failed to abort match:", e));
      }
      safeLocalStorage.removeItem("wordup_async_active_game");
      dispatch({ type: "RESET" });
      useAsyncStore.getState().resetGame();
      triggerToast("Match aborted.", WORDUP_TIMEOUT.TOAST_DURATION);
   }, [matchId, triggerToast, cleanup]);

   useEffect(() => {
      return () => {
         cleanup();
         const store = useAsyncStore.getState();
         if (!(store.view === "battle" || store.view === "gameover") || !store.matchId) store.resetGame();
      };
   }, [cleanup]);

   return {
      state,
      startMatch,
      handleAnswerSelect,
      cleanup,
      abortMatch,
   };
}
