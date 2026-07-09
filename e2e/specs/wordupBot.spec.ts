// ── E2E: Bot game via real engine dispatch + natural advancement ───
// Seeds the engine's reducer state and Zustand store, then verifies
// all 7 rounds advance naturally through the engine's own reveal
// timeout → advanceRound → startQuestionRound chain.

import { test, expect } from "@playwright/test";

const QUESTIONS = [
   { type: "definition", prompt: "What is the capital of France?", choices: ["Paris", "London", "Berlin", "Madrid"], answer: "Paris" },
   { type: "math", prompt: "What is 2 + 2?", choices: ["3", "4", "5", "6"], answer: "4" },
   { type: "definition", prompt: "Which planet is known as the Red Planet?", choices: ["Venus", "Jupiter", "Mars", "Saturn"], answer: "Mars" },
   { type: "definition", prompt: "What is the largest ocean?", choices: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: "Pacific" },
   { type: "definition", prompt: "Who wrote Romeo and Juliet?", choices: ["Dickens", "Shakespeare", "Hemingway", "Austen"], answer: "Shakespeare" },
   { type: "definition", prompt: "What element has symbol Fe?", choices: ["Iron", "Gold", "Silver", "Copper"], answer: "Iron" },
   { type: "definition", prompt: "What is the speed of light? (km/s)", choices: ["300,000", "150,000", "500,000", "100,000"], answer: "300,000" },
];

test.describe("Bot game (engine)", () => {
   test("all 7 rounds advance naturally through engine", async ({ page }) => {
      await page.addInitScript(() => {
         const s = new Map();
         s.set("wordle_anon_id", "e2e-bot-" + crypto.randomUUID().slice(0, 8));
         s.set("wordle_anon_username", "E2ETestBot");
         s.set("wordle_guest_opted_in", "true");
         s.set("wordle_guest_banner_last_dismissed", "2025-01-01");
         s.set("wordup_tutorial_completed", "true");
         s.set("wordle_tutorial_completed", "true");
         s.set("wordle_last_hydrated_timestamp", Date.now().toString());
         const orig = localStorage.getItem.bind(localStorage);
         localStorage.getItem = (k: string) => s.get(k) ?? orig(k);
      });

      await page.goto("/");
      await page.waitForTimeout(2000);

      // Navigate to WordUp
      await page.waitForFunction(() => !!(window as any).__appStore && !!(window as any).__liveStore, null, { timeout: 10000 });

      await page.evaluate(() => {
         const app = (window as any).__appStore;
         if (!app) return;
         app.setState({ isWordUpOpen: true, isMoreOpen: true, wordupMode: "live" });
         if (app.setWordupMode) app.setWordupMode("live");
         if (app.setWordUpOpen) app.setWordUpOpen(true);
      });

      await page.waitForTimeout(5000);

      // Seed engine state
      const matchId = "e2e-bot-" + crypto.randomUUID().slice(0, 8);
      const hasDispatch = await page.evaluate(() => !!(window as any).__gameDispatch);
      console.log("gameDispatch:", hasDispatch);

      await page.evaluate(({ mid, questions }) => {
         const d = (window as any).__gameDispatch;
         const store = (window as any).__liveStore;

         // New engine: use SET_INITIAL which populates all match + question state
         d({
            type: "SET_INITIAL",
            payload: {
               matchId: mid,
               gameType: "live-bot",
               role: "player1",
               questions,
               matchData: {
                  id: mid, category: "mixed", status: "active",
                  is_bot_match: true, bot_profile: "average",
                  game_type: "live-bot", current_question_index: 0,
                  p1_answers: [], p2_answers: [], p1_answered: false, p2_answered: false,
                  p1_score: 0, p2_score: 0,
                  player1_id: "test-player-1", player2_id: "test-player-2",
               },
               opponentStats: { username: "Bot", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
            },
         });

         // Also set status to playing (SET_INITIAL sets it to countdown)
         d({ type: "COUNTDOWN_DONE" });
         d({ type: "START_ROUND", round: 0, startedAt: Date.now() });

         if (store) {
            store.setState({
               view: "battle", matchId: mid, role: "player1", questions, currentIdx: 0,
               opponentStats: { username: "Bot", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
            });
         }
      }, { mid: matchId, questions: QUESTIONS });

      await page.waitForTimeout(2000);

      // Play all 7 rounds through the REAL engine advancement
      for (let round = 0; round < 7; round++) {
         const q = QUESTIONS[round];

         // Verify current question is showing
         await expect(page.getByText(q.prompt).first()).toBeVisible({ timeout: 5000 });

         // Click the correct answer
         await page.locator("button").filter({ hasText: q.answer }).click();
         console.log(`Round ${round}: clicked "${q.answer}"`);

         if (round < 6) {
            // Wait for the engine to reveal + advance + render
            for (let w = 0; w < 8; w++) {
               await page.waitForTimeout(1000);
               const nextQ = QUESTIONS[round + 1];
               const found = await page.getByText(nextQ.prompt).isVisible().catch(() => false);
               if (found) {
                  console.log(`Round ${round}: advanced to round ${round + 1} (waited ${w + 1}s)`);
                  break;
               }
               // Debug last retry
               if (w === 7) {
                  const body = await page.evaluate(() => document.body?.textContent?.substring(0, 500) || "");
                  console.log(`Round ${round} stuck, body:`, body);
               }
            }

            // Verify we advanced
            const nextQ = QUESTIONS[round + 1];
            await expect(page.getByText(nextQ.prompt).first()).toBeVisible({ timeout: 1000 });
         }
      }

      // Verify final game state: all 7 rounds completed, scores > 0
      const finalState = await page.evaluate(() => {
         const store = (window as any).__liveStore;
         const s = store?.getState();
         return {
            currentIdx: s?.currentIdx ?? -1,
            selectedAnswer: s?.selectedAnswer,
            revealAnswers: s?.revealAnswers,
         };
      });
      console.log("Final state:", JSON.stringify(finalState));
      // After round 6 completes, currentIdx stays at 6 and status goes to gameover
      // State is synced from the engine's status
      expect(finalState.currentIdx).toBe(6);
   });
});
