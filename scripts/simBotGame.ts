// ── Bot game simulator ─────────────────────────────────────────────

import { SimEngine, type MatchData, type Question, calcPoints } from "./simEngine";
import { simulateBotResponse } from "../src/utils/wordupQuestionGenerator";
import { pickBotChoice } from "./simEngine";
import { SimLogger } from "./simLogger";
import { generateUserId, randChoice } from "./simUtils";
import { SimMatchClient } from "./simMatchClient";

export interface BotSimOptions {
   category: string;
   runs: number;
   seed?: number;
   remote?: boolean;
   supabaseUrl?: string;
   serviceRoleKey?: string;
   logger: SimLogger;
}

export async function runBotSimulation(opts: BotSimOptions): Promise<void> {
   for (let run = 1; run <= opts.runs; run++) {
      opts.logger.startRun(run, "bot", opts.category);
      const startTime = Date.now();
      const userId = generateUserId();

      try {
         if (opts.remote && opts.supabaseUrl && opts.serviceRoleKey) {
            await runRemoteBotGame(opts, userId, run);
         } else {
            await runLocalBotGame(opts, run);
         }
      } catch (err: any) {
         opts.logger.logAnomaly("error", `Run ${run} failed: ${err.message}`, -1);
      }

      opts.logger.endRun(Date.now() - startTime);
   }
}

async function runLocalBotGame(opts: BotSimOptions, run: number): Promise<void> {
   const seed = (opts.seed ?? 42) + run;

   const questions: Question[] = Array.from({ length: 7 }, (_, i) => ({
      type: "definition",
      prompt: `Sample question ${i + 1} (seed ${seed})?`,
      choices: ["Alpha", "Beta", "Gamma", "Delta"],
      answer: "Alpha",
   }));

   const matchData: MatchData = {
      id: `sim-bot-${run}-${Date.now()}`,
      category: opts.category,
      status: "active",
      current_question_index: 0,
      p1_answers: [],
      p2_answers: [],
      p1_answered: false,
      p2_answered: false,
      p1_score: 0,
      p2_score: 0,
      is_bot_match: true,
      game_type: "live-bot",
   };

   const logger = opts.logger;
   logger.logQuestions(questions);

   const engine = new SimEngine(matchData, questions, "live-bot");
   const report = await engine.runBotGame();

   for (const rd of report.rounds) {
      logger.logRoundStart(rd.round);
      logger.logAnswer("User", rd.userChoice, rd.userCorrect, rd.userPts);

      const q = questions[rd.round];
      const dur = q ? 10 : 10;
      const br = simulateBotResponse(q!, "average", dur);
      logger.logBotSim(br, br.time_taken);
      logger.logAnswer("Bot", rd.botChoice ?? "", rd.botCorrect, rd.botPts);

      const p1 = engine.matchData.p1_score;
      const p2 = engine.matchData.p2_score;
      const prevP1 = p1 - rd.userPts;
      const prevP2 = p2 - rd.botPts;
      const deltaP1 = rd.userPts;
      const deltaP2 = rd.botPts;
      logger.logScoreUpdate(p1, p2, deltaP1 + deltaP2);
      logger.logRoundEnd(rd.round);
   }

   logger.logGameOver(engine.matchData.p1_score, engine.matchData.p2_score);
   logger.logDbSave(true, matchData.id);

   // Verify invariants
   const f = engine.matchData;
   if (f.p1_answers?.length !== 7) {
      logger.logAnomaly("error", `Expected 7 round answers, got ${f.p1_answers?.length}`, -1, 7, f.p1_answers?.length);
   }
   if (f.p1_answers && f.p2_answers && f.p1_answers.length !== f.p2_answers.length) {
      logger.logAnomaly("warn", "Mismatched answer count between players", -1, f.p1_answers.length, f.p2_answers.length);
   }
}

async function runRemoteBotGame(opts: BotSimOptions, userId: string, run: number): Promise<void> {
   const logger = opts.logger;
   const client = new SimMatchClient(
      opts.supabaseUrl!, opts.serviceRoleKey!, userId,
   );

   console.log("  Creating bot match via Supabase...");
   const result = await client.createBotMatch(userId, opts.category);
   console.log(`  Match ID: ${result.match_id}`);

   let match: any;
   let attempts = 0;
   console.log("  Waiting for questions to be generated...");
   while (attempts < 30) {
      await new Promise(r => setTimeout(r, 500));
      match = await client.getMatch(result.match_id);
      if (match?.questions || match?.encrypted_questions) break;
      attempts++;
   }

   if (!match?.questions && !match?.encrypted_questions) {
      throw new Error("Match questions not generated after 15s");
   }
   console.log(`  Questions generated (attempt ${attempts + 1})`);

   const { generateWordUpQuestions } = await import("../src/utils/wordupQuestionGenerator");
   const questions = await generateWordUpQuestions(opts.category);
   logger.logQuestions(questions);

   const engine = new SimEngine({
      id: result.match_id,
      category: opts.category,
      status: "active",
      current_question_index: 0,
      p1_answers: [],
      p2_answers: [],
      p1_answered: false,
      p2_answered: false,
      p1_score: 0,
      p2_score: 0,
      is_bot_match: true,
      game_type: "live-bot",
   }, questions, "live-bot");

   for (let i = 0; i < questions.length && i < 7; i++) {
      const q = questions[i];
      const dur = q ? 10 : 10;
      const userChoice = randChoice(q.choices);
      const userCorrect = userChoice === q.answer;
      const userElapsed = 2 + Math.random() * 3;
      const userPts = calcPoints(userCorrect, userElapsed, dur, i === 6);
      const ba = simulateBotResponse(q!, "average", dur);
      const botPts = calcPoints(ba.correct, ba.time_taken, dur, i === 6);
      const botChoice = pickBotChoice(q!, ba.correct);

      engine.matchData.p1_answers = [...(engine.matchData.p1_answers || []), {
         question_idx: i, correct: userCorrect, time_taken: userElapsed, points: userPts, choice: userChoice,
      }];
      engine.matchData.p1_answered = true;
      engine.matchData.p1_score = (engine.matchData.p1_score || 0) + userPts;
      engine.matchData.p2_answers = [...(engine.matchData.p2_answers || []), {
         question_idx: i, correct: ba.correct, time_taken: ba.time_taken, points: botPts, choice: botChoice,
      }];
      engine.matchData.p2_answered = true;
      engine.matchData.p2_score = (engine.matchData.p2_score || 0) + botPts;

      logger.logRoundStart(i);
      logger.logAnswer("User", userChoice, userCorrect, userPts);
      logger.logBotSim(ba, ba.time_taken);
      logger.logAnswer("Bot", botChoice, ba.correct, botPts);
      logger.logScoreUpdate(engine.matchData.p1_score, engine.matchData.p2_score, userPts + botPts);

      engine.triggerReveal();
      logger.logRoundEnd(i);
   }

   engine.endGame();
   logger.logGameOver(engine.matchData.p1_score, engine.matchData.p2_score);

   // Save to DB
   try {
      const { encryptQuestions, generateSecretKey } = await import("../src/utils/wordupQuestionGenerator");
      const key = generateSecretKey();
      const encrypted = encryptQuestions(questions, key);
      await client.updateMatch(result.match_id, {
         status: "completed",
         questions: encrypted,
         encryption_key: key,
         p1_answers: engine.matchData.p1_answers,
         p2_answers: engine.matchData.p2_answers,
         p1_score: engine.matchData.p1_score,
         p2_score: engine.matchData.p2_score,
         p1_answered: true,
         p2_answered: true,
      });
      logger.logDbSave(true, result.match_id);
   } catch (err: any) {
      logger.logDbSave(false);
      logger.logAnomaly("error", `DB save failed: ${err.message}`, -1);
   }

   client.unsubscribe();
}
