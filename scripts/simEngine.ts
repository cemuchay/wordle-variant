// ── Headless game engine ───────────────────────────────────────────
// Uses the same core logic as the real game engine
// (useGameEngine.core.ts) so bug fixes apply to both.

import {
   getQuestionDuration,
   calcPoints,
   buildPlayerAnswer,
   buildBotAnswer,
   mergeMatchData,
   buildAdvanceMatchData,
   buildEndMatchData,
   fabricateBotUpdate,
} from "../src/wordup/live/hooks/useGameEngine.core";
export { calcPoints } from "../src/wordup/live/hooks/useGameEngine.core";
import { simulateBotResponse } from "../src/utils/wordupQuestionGenerator";

export interface SimEvent {
   type: string;
   payload?: any;
   timestamp: number;
}

export interface MatchData {
   id: string;
   category: string;
   status: "waiting" | "countdown" | "active" | "completed";
   current_question_index: number;
   p1_answers: Answer[];
   p2_answers: Answer[];
   p1_answered: boolean;
   p2_answered: boolean;
   p1_score: number;
   p2_score: number;
   question_started_at?: string;
   is_bot_match?: boolean;
   game_type?: string;
}

export interface Answer {
   question_idx: number;
   correct: boolean;
   time_taken: number;
   points: number;
   choice: string;
}

export interface Question {
   type: string;
   prompt: string;
   choices: string[];
   answer: string;
   id?: string;
}

export function pickBotChoice(q: Question, correct: boolean): string {
   if (correct) return q.answer;
   const wrong = q.choices.filter((c) => c !== q.answer);
   return wrong.length > 0
      ? wrong[Math.floor(Math.random() * wrong.length)]
      : "WRONG";
}

// ── SimEngine ──────────────────────────────────────────────────────

export class SimEngine {
   state: {
      currentRound: number;
      selectedAnswer: string | null;
      revealAnswers: boolean;
      timeLeft: number;
      maxTime: number;
      phase: string;
   };
   matchData: MatchData;
   questions: Question[];
   events: SimEvent[] = [];
   private gameType: "live" | "live-bot";
   private isAdvancing = false;
   private isRevealing = false;

   constructor(
      matchData: MatchData,
      questions: Question[],
      gameType: "live" | "live-bot" = "live",
   ) {
      this.matchData = { ...matchData };
      this.questions = questions;
      this.gameType = gameType;
      this.state = {
         currentRound: matchData.current_question_index ?? 0,
         selectedAnswer: null,
         revealAnswers: false,
         timeLeft: 10,
         maxTime: 10,
         phase: "playing",
      };
   }

   private push(type: string, payload?: any): SimEvent {
      const e: SimEvent = { type, payload, timestamp: Date.now() };
      this.events.push(e);
      return e;
   }

   startQuestionRound(index: number): SimEvent[] {
      const q = this.questions[index];
      const duration = q ? getQuestionDuration(q.type) : 10;
      this.state.currentRound = index;
      this.state.selectedAnswer = null;
      this.state.revealAnswers = false;
      this.state.timeLeft = duration;
      this.state.maxTime = duration;
      this.matchData.p1_answered = false;
      this.matchData.p2_answered = false;

      // Bot: seed botAction
      if (this.gameType === "live-bot" && q) {
         const br = simulateBotResponse(q, "average", duration);
         (this as any)._botAction = br;
      }

      return [
         this.push("SET_ROUND", { round: index, timeLeft: duration, maxTime: duration }),
         this.push("CLEAR_ANSWER"),
         this.push("HIDE_REVEAL"),
         this.push("SET_MATCH_DATA", { p1_answered: false, p2_answered: false }),
      ];
   }

   handleAnswerSelect(
      player: "p1" | "p2",
      choice: string,
      overrideTimeTaken?: number,
   ): SimEvent[] {
      const q = this.questions[this.state.currentRound];
      const duration = q ? getQuestionDuration(q.type) : 10;
      const isRound6 = this.state.currentRound === 6;
      const elapsed = overrideTimeTaken ?? duration - 0.5;
      const correct = choice === q?.answer;
      const pts = calcPoints(correct, elapsed, duration, isRound6);
      const sub = buildPlayerAnswer(this.state.currentRound, choice, correct, elapsed, pts);

      // For bot mode P1 answers → fabricate P2 answer here too
      if (this.gameType === "live-bot" && player === "p1") {
         const ba = (this as any)._botAction ?? { correct: Math.random() > 0.5, time_taken: 2 };
         const botAnswer = buildBotAnswer(q, this.state.currentRound, ba, duration, isRound6);
         this.matchData = {
            ...this.matchData,
            p1_answers: [...(this.matchData.p1_answers || []), sub],
            p1_answered: true,
            p1_score: (this.matchData.p1_score || 0) + pts,
            p2_answers: [...(this.matchData.p2_answers || []), botAnswer],
            p2_answered: true,
            p2_score: (this.matchData.p2_score || 0) + botAnswer.points,
         };
         this.state.selectedAnswer = choice;
         this.push("ANSWER_SELECTED", { player, choice });
         this.push("SET_MATCH_DATA", { ...this.matchData });
         return this.triggerReveal();
      }

      const isP1 = player === "p1";
      const key = isP1 ? "p1_answers" : "p2_answers";
      const answeredKey = isP1 ? "p1_answered" : "p2_answered";
      const scoreKey = isP1 ? "p1_score" : "p2_score";

      this.matchData = {
         ...this.matchData,
         [key]: [...(this.matchData[key] || []), sub],
         [answeredKey]: true,
         [scoreKey]: (this.matchData[scoreKey] ?? 0) + pts,
      };
      this.state.selectedAnswer = choice;
      this.push("ANSWER_SELECTED", { player, choice });
      this.push("SET_MATCH_DATA", { ...this.matchData });

      if (this.matchData.p1_answered && this.matchData.p2_answered) {
         return this.triggerReveal();
      }
      return this.events.slice(-3);
   }

   receiveOpponentAnswer(answer: Answer, score: number): SimEvent[] {
      const isP1 = this.matchData.p1_answers.length <= this.matchData.p2_answers.length;
      const key = isP1 ? "p1_answers" : "p2_answers";
      const answeredKey = isP1 ? "p1_answered" : "p2_answered";
      const scoreKey = isP1 ? "p1_score" : "p2_score";

      // Protection: only accept if opponent has fewer answers than incoming
      const curLen = (this.matchData[key] || []).length;
      if (curLen > (this.matchData[key] || []).length + 0) return [];

      this.matchData = {
         ...this.matchData,
         [key]: [...(this.matchData[key] || []), answer],
         [answeredKey]: true,
         [scoreKey]: score,
      };
      this.push("RECEIVE_OPPONENT_ANSWER", { player: isP1 ? "p1" : "p2", answer });

      if (this.matchData.p1_answered && this.matchData.p2_answered) {
         return this.triggerReveal();
      }
      return this.events.slice(-1);
   }

   private triggerReveal(): SimEvent[] {
      this.state.revealAnswers = true;
      this.push("REVEAL");

      const nextIdx = this.matchData.current_question_index + 1;
      if (nextIdx >= 7) {
         return this.endGame();
      }
      return this.advanceRound(nextIdx);
   }

   advanceRound(nextIdx: number): SimEvent[] {
      if (this.isAdvancing) return [];
      this.isAdvancing = true;

      const q = this.questions[nextIdx];
      const dur = q ? getQuestionDuration(q.type) : 10;
      this.matchData = buildAdvanceMatchData(this.matchData, nextIdx, Date.now());
      const evts = [this.push("ADVANCE_ROUND", { round: nextIdx })];

      if (nextIdx < 7) {
         this.state = {
            ...this.state,
            currentRound: nextIdx,
            selectedAnswer: null,
            revealAnswers: false,
            timeLeft: dur,
            maxTime: dur,
         };
      }
      this.isAdvancing = false;
      return evts;
   }

   endGame(): SimEvent[] {
      this.matchData = buildEndMatchData(this.matchData, new Date().toISOString());
      this.state.phase = "gameover";
      return [this.push("END_GAME", { matchData: { ...this.matchData } })];
   }

   // Full run with automatic bot behavior
   async runBotGame(): Promise<SimReport> {
      const report: SimReport = {
         rounds: [],
         anomalies: [],
         totalDurationMs: 0,
      };
      const startTime = Date.now();

      for (let i = 0; i < this.questions.length && i < 7; i++) {
         this.startQuestionRound(i);
         const q = this.questions[i];
         const dur = q ? getQuestionDuration(q.type) : 10;

         // User answers with a random choice
         const userChoice = q ? q.choices[Math.floor(Math.random() * q.choices.length)] : "";
         const userCorrect = userChoice === q?.answer;
         const userElapsed = 2 + Math.random() * 3;
         const userPts = calcPoints(userCorrect, userElapsed, dur, i === 6);

         // Bot answers too
         const ba = simulateBotResponse(q!, "average", dur);
         const botPts = calcPoints(ba.correct, ba.time_taken, dur, i === 6);
         const botChoice = pickBotChoice(q!, ba.correct);

         this.matchData.p1_answers = [...(this.matchData.p1_answers || []), {
            question_idx: i, correct: userCorrect, time_taken: userElapsed, points: userPts, choice: userChoice,
         }];
         this.matchData.p1_answered = true;
         this.matchData.p1_score = (this.matchData.p1_score || 0) + userPts;
         this.matchData.p2_answers = [...(this.matchData.p2_answers || []), {
            question_idx: i, correct: ba.correct, time_taken: ba.time_taken, points: botPts, choice: botChoice,
         }];
         this.matchData.p2_answered = true;
         this.matchData.p2_score = (this.matchData.p2_score || 0) + botPts;
         this.state.selectedAnswer = userChoice;

         const roundEvents = this.triggerReveal();
         report.rounds.push({
            round: i,
            userChoice,
            userCorrect,
            userPts,
            botCorrect: ba.correct,
            botPts,
            events: roundEvents.map(e => e.type),
         });
      }

      this.endGame();
      report.totalDurationMs = Date.now() - startTime;
      report.questions = this.questions;
      report.finalMatchData = { ...this.matchData };
      return report;
   }

   getStateSnapshot(): any {
      return {
         currentRound: this.state.currentRound,
         selectedAnswer: this.state.selectedAnswer,
         revealAnswers: this.state.revealAnswers,
         phase: this.state.phase,
         p1_answered: this.matchData.p1_answered,
         p2_answered: this.matchData.p2_answered,
         p1_answers: (this.matchData.p1_answers || []).length,
         p2_answers: (this.matchData.p2_answers || []).length,
         p1_score: this.matchData.p1_score,
         p2_score: this.matchData.p2_score,
         current_question_index: this.matchData.current_question_index,
         status: this.matchData.status,
      };
   }
}

// ── Types ──────────────────────────────────────────────────────────

export interface RoundLog {
   round: number;
   userChoice: string;
   userCorrect: boolean;
   userPts: number;
   botCorrect: boolean;
   botPts: number;
   events: string[];
}

export interface SimReport {
   rounds: RoundLog[];
   anomalies: string[];
   totalDurationMs: number;
   questions: Question[];
   finalMatchData: MatchData;
}
