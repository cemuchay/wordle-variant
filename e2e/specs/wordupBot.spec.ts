// ── E2E: Bot game via real engine dispatch ─────────────────────────
// Seeds the engine's reducer state and Zustand store, then verifies
// the first click goes through the real handleAnswerSelect (proven by
// score appearing in the store).  Subsequent rounds are advanced by
// dispatching engine events directly.

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
   test("click goes through real handleAnswerSelect and scores points", async ({ page }) => {
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

      // Check what stores are available
      const storesAvail = await page.evaluate(() => ({
         live: !!(window as any).__liveStore,
         app: !!(window as any).__appStore,
      }));
      console.log("Stores available:", JSON.stringify(storesAvail));

      // Navigate to WordUp by seeding app store state directly
      await page.waitForFunction(() => !!(window as any).__appStore && !!(window as any).__liveStore, null, { timeout: 10000 });

      await page.evaluate(() => {
         // Set ALL state flags that control WordUp visibility
         const app = (window as any).__appStore;
         if (!app) return;
         app.setState({
            isWordUpOpen: true,
            isMoreOpen: true,
            wordupMode: "live",
         });
         if (app.setWordupMode) app.setWordupMode("live");
         if (app.setWordUpOpen) app.setWordUpOpen(true);
      });

      await page.waitForTimeout(5000);

      // Check what's available after navigation
      const debug = await page.evaluate(() => ({
         gameDispatch: !!(window as any).__gameDispatch,
         liveStore: !!(window as any).__liveStore,
         appStore: !!(window as any).__appStore,
         body: (document.body?.textContent || "").substring(0, 200),
      }));
      console.log("After navigation:", JSON.stringify(debug));

      if (!debug.gameDispatch) {
         // Engine dispatch not available — set it up ourselves by patching the hook
         console.log("WARNING: __gameDispatch not found. Falling back to store-only mode.");
      }

      const matchId = "e2e-bot-" + crypto.randomUUID().slice(0, 8);

      await page.evaluate(({ mid, questions }) => {
         const d = (window as any).__gameDispatch;
         const store = (window as any).__liveStore;

         d({ type: "SET_MATCH_DATA", data: {
            id: mid, category: "mixed", status: "active",
            is_bot_match: true, bot_profile: "average",
            game_type: "live-bot", current_question_index: 0,
            p1_answers: [], p2_answers: [], p1_answered: false, p2_answered: false,
            p1_score: 0, p2_score: 0,
            player1_id: "test-player-1", player2_id: "test-player-2",
         }});
         d({ type: "SET_QUESTIONS", questions });
         d({ type: "SET_PHASE", phase: "playing" });
         d({ type: "SET_ROUND", round: 0, timeLeft: 10, maxTime: 10 });
         d({ type: "CLEAR_ANSWER" });
         d({ type: "HIDE_REVEAL" });

         if (store) {
            store.setState({
               view: "battle", matchId: mid, role: "player1", questions, currentIdx: 0,
               opponentStats: { username: "Bot", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
            });
         }
      }, { mid: matchId, questions: QUESTIONS });

      await page.waitForTimeout(2000);

      // Verify question renders
      await expect(page.getByText("capital of France").first()).toBeVisible({ timeout: 5000 });

      // Click correct answer → goes through real handleAnswerSelect
      await page.locator("button").filter({ hasText: "Paris" }).click();
      await page.waitForTimeout(1000);

      // Verify the engine processed it via S.current or state
      const engineState = await page.evaluate(() => {
         // Check matchData from the engine's reducer (via Zustand sync)
         const store = (window as any).__liveStore;
         const s = store?.getState();
         return {
            p1_answers: s?.matchData?.p1_answers?.length ?? 0,
            p1_score: s?.matchData?.p1_score ?? -1,
            p1_answered: s?.matchData?.p1_answered ?? false,
         };
      });
      console.log("Engine state after click:", JSON.stringify(engineState));

      expect(engineState.p1_score).toBeGreaterThan(0);
      expect(engineState.p1_answered).toBe(true);

      // Manually advance rounds via dispatch
      for (let round = 1; round < 7; round++) {
         await page.evaluate(({ r, questions }) => {
            const d = (window as any).__gameDispatch;
            const store = (window as any).__liveStore;
            const q = questions[r];

            d({ type: "SET_ROUND", round: r, timeLeft: 10, maxTime: 10 });
            d({ type: "CLEAR_ANSWER" });
            d({ type: "HIDE_REVEAL" });

            if (store) {
               store.setState({
                  currentIdx: r,
                  selectedAnswer: null,
                  revealAnswers: false,
                  timeLeft: 10,
                  maxTime: 10,
               });
            }
         }, { r: round, questions: QUESTIONS });

         await page.waitForTimeout(500);

         // Click the correct answer for this round
         const q = QUESTIONS[round];
         await expect(page.getByText(q.prompt).first()).toBeVisible({ timeout: 5000 });
         await page.locator("button").filter({ hasText: q.answer }).click();
         await page.waitForTimeout(500);
      }

      await page.screenshot({ path: "e2e/screenshots/engine-bot-final.png", fullPage: true });
   });
});
