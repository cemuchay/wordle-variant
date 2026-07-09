// ── Shared game engine core (React-free, side-effect-free) ─────────
// Imported by both the React hook (useGameEngine.ts) and the headless
// simulator (scripts/simEngine.ts).  Any bug fix here applies to both.

import { QUESTION_DURATION } from "../../../constants/wordup";

// ── Question duration ──────────────────────────────────────────────

export function getQuestionDuration(type: string): number {
   return QUESTION_DURATION[type] ?? QUESTION_DURATION.default;
}

// ── Score calculation ──────────────────────────────────────────────

export function calcPoints(
   correct: boolean,
   elapsed: number,
   duration: number,
   isRound6: boolean,
): number {
   if (!correct) return 0;
   const eff = Math.max(0, elapsed - 1.5);
   const denom = duration - 1.5;
   let p = Math.max(
      11,
      Math.round(20 * (1 - eff / (denom > 0 ? denom : duration))),
   );
   if (isRound6) p *= 2;
   return p;
}

// ── Answer builders ────────────────────────────────────────────────

export interface AnswerPayload {
   question_idx: number;
   correct: boolean;
   time_taken: number;
   points: number;
   choice: string;
}

export function buildPlayerAnswer(
   round: number,
   choice: string,
   correct: boolean,
   elapsed: number,
   points: number,
): AnswerPayload {
   return { question_idx: round, correct, time_taken: elapsed, points, choice };
}

export function buildBotAnswer(
   question: { answer: string; choices?: string[] } | null,
   round: number,
   botAction: { correct: boolean; time_taken: number },
   duration: number,
   isRound6: boolean,
): AnswerPayload {
   const pts = calcPoints(botAction.correct, botAction.time_taken, duration, isRound6);
   let choice = question?.answer ?? "";
   if (!botAction.correct && question?.choices) {
      const wrong = question.choices.filter((c) => c !== question.answer);
      choice = wrong[Math.floor(Math.random() * wrong.length)] || "WRONG";
   }
   return {
      question_idx: round,
      correct: botAction.correct,
      time_taken: botAction.time_taken,
      points: pts,
      choice,
   };
}

// ── Match data merge (with protection logic) ───────────────────────

export function mergeMatchData(cur: any, newMatch: any): any {
   if (!cur) return newMatch;

   const merged = { ...cur, ...newMatch };

   // Protection: keep longer answer arrays (prevents stale broadcasts from overwriting)
   if ((cur.p1_answers?.length || 0) > (newMatch.p1_answers?.length || 0)) {
      merged.p1_answers = cur.p1_answers;
      merged.p1_score = cur.p1_score;
      merged.p1_answered = cur.p1_answered;
   }
   if ((cur.p2_answers?.length || 0) > (newMatch.p2_answers?.length || 0)) {
      merged.p2_answers = cur.p2_answers;
      merged.p2_score = cur.p2_score;
      merged.p2_answered = cur.p2_answered;
   }

   merged.current_question_index = Math.max(
      cur.current_question_index || 0,
      newMatch.current_question_index || 0,
   );

   if (cur.status === "active" && newMatch.status === "countdown") {
      merged.status = "active";
   }

   return merged;
}

// ── Advance round builder ──────────────────────────────────────────

export function buildAdvanceMatchData(
   cur: any,
   nextIdx: number,
   syncedNow: number,
): any {
   return {
      ...cur,
      current_question_index: nextIdx,
      question_started_at: new Date(syncedNow).toISOString(),
      p1_answered: false,
      p2_answered: false,
   };
}

// ── End-game builder ───────────────────────────────────────────────

export function buildEndMatchData(match: any, completedAt: string): any {
   return {
      ...match,
      status: "completed",
      p1_answered: true,
      p2_answered: true,
      completed_at: completedAt,
   };
}

// ── Bot answer fabrication ─────────────────────────────────────────

export function fabricateBotUpdate(
   lm: any,
   round: number,
   botAction: { correct: boolean; time_taken: number },
   duration: number,
   isRound6: boolean,
   question: { answer: string; choices?: string[] } | null,
): any {
   const ba = botAction;
   const botAnswer = buildBotAnswer(question, round, ba, duration, isRound6);
   return {
      ...lm,
      p2_answers: [...(lm.p2_answers || []), botAnswer],
      p2_answered: true,
      p2_score: (lm.p2_score || 0) + botAnswer.points,
   };
}
