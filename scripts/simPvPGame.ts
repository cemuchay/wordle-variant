// ── Live PvP game simulator ────────────────────────────────────────

import { SimEngine, type MatchData, type Question, calcPoints } from "./simEngine";
import { SimLogger, diffState } from "./simLogger";
import { generateUserId, randChoice } from "./simUtils";
import { MockMatchClient } from "./simMatchClient.mock";
import { SimMatchClient } from "./simMatchClient";

export interface PvpSimOptions {
   category: string;
   runs: number;
   mock?: boolean;
   seed?: number;
   supabaseUrl?: string;
   serviceRoleKey?: string;
   logger: SimLogger;
   injectDelayMs?: number;
}

export async function runPvpSimulation(opts: PvpSimOptions): Promise<void> {
   for (let run = 1; run <= opts.runs; run++) {
      opts.logger.startRun(run, `pvp${opts.mock ? "-mock" : "-real"}`, opts.category);
      const startTime = Date.now();

      try {
         if (opts.mock) {
            await runMockPvpGame(opts, run);
         } else if (opts.supabaseUrl && opts.serviceRoleKey) {
            await runRealPvpGame(opts, run);
         } else {
            throw new Error("Real PvP mode requires supabaseUrl and serviceRoleKey");
         }
      } catch (err: any) {
         opts.logger.logAnomaly("error", `Run ${run} failed: ${err.message}`, -1);
      }

      opts.logger.endRun(Date.now() - startTime);
   }
}

async function runMockPvpGame(opts: PvpSimOptions, run: number): Promise<void> {
   const logger = opts.logger;
   const seed = (opts.seed ?? 42) + run;

   const questions: Question[] = Array.from({ length: 7 }, (_, i) => ({
      type: "definition",
      prompt: `PvP question ${i + 1} (seed ${seed})?`,
      choices: ["Alpha", "Beta", "Gamma", "Delta"],
      answer: "Alpha",
   }));

   logger.logQuestions(questions);

   const makeMatchData = (id: string): MatchData => ({
      id, category: opts.category, status: "active",
      current_question_index: 0, p1_answers: [], p2_answers: [],
      p1_answered: false, p2_answered: false, p1_score: 0, p2_score: 0,
   });

   const matchId = `sim-pvp-${run}-${Date.now()}`;
   const engineA = new SimEngine(makeMatchData(matchId), questions, "live");
   const engineB = new SimEngine(makeMatchData(matchId), questions, "live");

   const channelA = new MockMatchClient(opts.injectDelayMs ?? 0);
   const channelB = new MockMatchClient(opts.injectDelayMs ?? 0);
   channelA.link(channelB);
   channelB.link(channelA);

   for (let round = 0; round < 7; round++) {
      const q = questions[round];
      const dur = q ? 10 : 10;

      engineA.startQuestionRound(round);
      engineB.startQuestionRound(round);

      logger.logRoundStart(round);

      // P1 answers
      const choiceA = randChoice(q.choices);
      const p1Elapsed = 2 + Math.random() * 2;
      const p1Correct = choiceA === q.answer;
      const p1Pts = calcPoints(p1Correct, p1Elapsed, dur, round === 6);
      const ansA = { question_idx: round, correct: p1Correct, time_taken: p1Elapsed, points: p1Pts, choice: choiceA };

      engineA.matchData.p1_answers = [...(engineA.matchData.p1_answers || []), ansA];
      engineA.matchData.p1_answered = true;
      engineA.matchData.p1_score = (engineA.matchData.p1_score || 0) + p1Pts;
      engineA.state.selectedAnswer = choiceA;

      logger.logAnswer("P1", choiceA, p1Correct, p1Pts);
      logger.logBroadcast("P1", "player_answered");
      await channelA.send({ type: "player_answered", role: "player1", answers: engineA.matchData.p1_answers, myScore: engineA.matchData.p1_score, oppScore: engineA.matchData.p2_score });

      // P2 receives P1's answer
      const evt = await channelB.receive(2000);
      if (evt && evt.type === "player_answered") {
         logger.logReceive("P2", "player_answered");
         const lastAns = evt.answers[evt.answers.length - 1];
         engineB.matchData.p1_answers = [...(engineB.matchData.p1_answers || []), lastAns];
         engineB.matchData.p1_answered = true;
         engineB.matchData.p1_score = evt.myScore;
      } else {
         logger.logAnomaly("error", `P2 didn't receive P1's answer for round ${round}`, round);
      }

      // P2 answers
      const choiceB = randChoice(q.choices);
      const p2Elapsed = 2 + Math.random() * 2;
      const p2Correct = choiceB === q.answer;
      const p2Pts = calcPoints(p2Correct, p2Elapsed, dur, round === 6);
      const ansB = { question_idx: round, correct: p2Correct, time_taken: p2Elapsed, points: p2Pts, choice: choiceB };

      engineB.matchData.p2_answers = [...(engineB.matchData.p2_answers || []), ansB];
      engineB.matchData.p2_answered = true;
      engineB.matchData.p2_score = (engineB.matchData.p2_score || 0) + p2Pts;
      engineB.state.selectedAnswer = choiceB;

      logger.logAnswer("P2", choiceB, p2Correct, p2Pts);
      logger.logBroadcast("P2", "player_answered");
      await channelB.send({ type: "player_answered", role: "player2", answers: engineB.matchData.p2_answers, myScore: engineB.matchData.p2_score, oppScore: engineB.matchData.p1_score });

      // P1 receives P2's answer
      const evt2 = await channelA.receive(2000);
      if (evt2 && evt2.type === "player_answered") {
         logger.logReceive("P1", "player_answered");
         const lastAns = evt2.answers[evt2.answers.length - 1];
         engineA.matchData.p2_answers = [...(engineA.matchData.p2_answers || []), lastAns];
         engineA.matchData.p2_answered = true;
         engineA.matchData.p2_score = evt2.myScore;
      } else {
         logger.logAnomaly("error", `P1 didn't receive P2's answer for round ${round}`, round);
      }

      // Trigger reveal + advance on both
      engineA.triggerReveal();
      engineB.triggerReveal();

      const totalScore = engineA.matchData.p1_score + engineA.matchData.p2_score;
      const prevTotal = totalScore - p1Pts - p2Pts;
      logger.logScoreUpdate(engineA.matchData.p1_score, engineA.matchData.p2_score, p1Pts + p2Pts);

      if (engineA.matchData.current_question_index !== engineB.matchData.current_question_index) {
         logger.logAnomaly("error", `Round sync mismatch after reveal`, round, engineA.matchData.current_question_index, engineB.matchData.current_question_index);
      }

      const snapA = engineA.getStateSnapshot();
      const snapB = engineB.getStateSnapshot();
      const diffs = diffState(`R${round}`, snapA, snapB);
      for (const d of diffs) {
         logger.logAnomaly(d.level, d.message, round, d.expected, d.actual);
      }
      logger.logStateSync(diffs.length === 0 ? "ok" : "mismatch", diffs.length);

      logger.addRound({
         round, p1Choice: choiceA, p1Correct, p1Pts,
         p2Choice: choiceB, p2Correct, p2Pts,
         scoreSync: diffs.length === 0,
      });

      logger.logRoundEnd(round);
   }

   engineA.endGame();
   engineB.endGame();

   logger.logGameOver(engineA.matchData.p1_score, engineA.matchData.p2_score);
   logger.logDbSave(true, matchId);

   const fA = engineA.matchData;
   const fB = engineB.matchData;
   if (fA.p1_score !== fB.p1_score) {
      logger.logAnomaly("error", "Final P1 score mismatch", 6, fA.p1_score, fB.p1_score);
   }
   if (fA.p2_score !== fB.p2_score) {
      logger.logAnomaly("error", "Final P2 score mismatch", 6, fA.p2_score, fB.p2_score);
   }
}

async function runRealPvpGame(opts: PvpSimOptions, run: number): Promise<void> {
   const logger = opts.logger;
   const userIdA = generateUserId();
   const userIdB = generateUserId();

   const clientA = new SimMatchClient(opts.supabaseUrl!, opts.serviceRoleKey!, userIdA);
   const clientB = new SimMatchClient(opts.supabaseUrl!, opts.serviceRoleKey!, userIdB);

   console.log("  Player A joining queue...");
   const resultA = await clientA.joinQueue(userIdA, opts.category);
   if (resultA.status !== "queued") throw new Error("P1 did not queue");
   console.log("  Player A queued.");

   console.log("  Player B joining queue...");
   const resultB = await clientB.joinQueue(userIdB, opts.category);
   if (!resultB.match_id) throw new Error("P2 did not get a match");
   const matchId = resultB.match_id;
   console.log(`  Match found! ID: ${matchId.slice(0, 8)}...`);

   clientA.matchId = matchId;
   clientB.matchId = matchId;
   clientA.role = "player1";
   clientB.role = "player2";

   console.log("  Waiting for questions...");
   let match = await clientA.getMatch(matchId);
   let attempts = 0;
   while ((!match.questions && !match.encrypted_questions) && attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      match = await clientA.getMatch(matchId);
      attempts++;
   }
   if (!match.questions && !match.encrypted_questions) {
      throw new Error("Questions not generated after 30s");
   }
   console.log(`  Questions ready (attempt ${attempts + 1}).`);

   const { generateWordUpQuestions } = await import("../src/utils/wordupQuestionGenerator");
   const questions = await generateWordUpQuestions(opts.category);
   logger.logQuestions(questions);

   const engineA = new SimEngine({
      id: matchId, category: opts.category, status: "active",
      current_question_index: 0, p1_answers: [], p2_answers: [],
      p1_answered: false, p2_answered: false, p1_score: 0, p2_score: 0,
   }, questions, "live");

   const engineB = new SimEngine({
      id: matchId, category: opts.category, status: "active",
      current_question_index: 0, p1_answers: [], p2_answers: [],
      p1_answered: false, p2_answered: false, p1_score: 0, p2_score: 0,
   }, questions, "live");

   clientA.subscribe(matchId, {
      onPlayerAnswered: (payload) => {
         if (payload.role === "player2") {
            const last = payload.answers[payload.answers.length - 1];
            engineA.matchData.p2_answers = [...(engineA.matchData.p2_answers || []), last];
            engineA.matchData.p2_answered = true;
            engineA.matchData.p2_score = payload.myScore;
         }
      },
      onMatchUpdate: (m) => { if (m.status === "completed") engineA.endGame(); },
   });

   clientB.subscribe(matchId, {
      onPlayerAnswered: (payload) => {
         if (payload.role === "player1") {
            const last = payload.answers[payload.answers.length - 1];
            engineB.matchData.p1_answers = [...(engineB.matchData.p1_answers || []), last];
            engineB.matchData.p1_answered = true;
            engineB.matchData.p1_score = payload.myScore;
         }
      },
      onMatchUpdate: (m) => { if (m.status === "completed") engineB.endGame(); },
   });

   for (let round = 0; round < 7; round++) {
      const q = questions[round];
      const dur = q ? 10 : 10;

      engineA.startQuestionRound(round);
      engineB.startQuestionRound(round);
      logger.logRoundStart(round);

      // P1 answers
      const choiceA = randChoice(q.choices);
      const p1Elapsed = 2 + Math.random() * 2;
      const p1Correct = choiceA === q.answer;
      const p1Pts = calcPoints(p1Correct, p1Elapsed, dur, round === 6);
      const ansA = { question_idx: round, correct: p1Correct, time_taken: p1Elapsed, points: p1Pts, choice: choiceA };

      engineA.matchData.p1_answers = [...(engineA.matchData.p1_answers || []), ansA];
      engineA.matchData.p1_answered = true;
      engineA.matchData.p1_score = (engineA.matchData.p1_score || 0) + p1Pts;

      logger.logAnswer("P1", choiceA, p1Correct, p1Pts);
      logger.logBroadcast("P1", "player_answered");
      await clientA.sendAnswer("player1", engineA.matchData.p1_answers, engineA.matchData.p1_score, engineA.matchData.p2_score);
      await new Promise(r => setTimeout(r, 300));

      // P2 answers
      const choiceB = randChoice(q.choices);
      const p2Elapsed = 2 + Math.random() * 2;
      const p2Correct = choiceB === q.answer;
      const p2Pts = calcPoints(p2Correct, p2Elapsed, dur, round === 6);
      const ansB = { question_idx: round, correct: p2Correct, time_taken: p2Elapsed, points: p2Pts, choice: choiceB };

      engineB.matchData.p2_answers = [...(engineB.matchData.p2_answers || []), ansB];
      engineB.matchData.p2_answered = true;
      engineB.matchData.p2_score = (engineB.matchData.p2_score || 0) + p2Pts;

      logger.logAnswer("P2", choiceB, p2Correct, p2Pts);
      logger.logBroadcast("P2", "player_answered");
      await clientB.sendAnswer("player2", engineB.matchData.p2_answers, engineB.matchData.p2_score, engineB.matchData.p1_score);
      await new Promise(r => setTimeout(r, 300));

      engineA.triggerReveal();
      engineB.triggerReveal();

      logger.logScoreUpdate(engineA.matchData.p1_score, engineA.matchData.p2_score, p1Pts + p2Pts);

      const snapA = engineA.getStateSnapshot();
      const snapB = engineB.getStateSnapshot();
      const diffs = diffState(`R${round}`, snapA, snapB);
      for (const d of diffs) {
         logger.logAnomaly(d.level, d.message, round, d.expected, d.actual);
      }
      logger.logStateSync(diffs.length === 0 ? "ok" : "mismatch", diffs.length);
      logger.logRoundEnd(round);
   }

   clientA.unsubscribe();
   clientB.unsubscribe();

   logger.logGameOver(engineA.matchData.p1_score, engineA.matchData.p2_score);
   logger.logDbSave(true, matchId);

   if (engineA.matchData.p1_score !== engineB.matchData.p1_score) {
      logger.logAnomaly("error", "Final P1 score mismatch", 6, engineA.matchData.p1_score, engineB.matchData.p1_score);
   }
   if (engineA.matchData.p2_score !== engineB.matchData.p2_score) {
      logger.logAnomaly("error", "Final P2 score mismatch", 6, engineA.matchData.p2_score, engineB.matchData.p2_score);
   }
}
