// ── E2E: Live PvP with seeded stores ──────────────────────────────
// Two pages, seeded with the same match data via window stores.
// Verifies both independently render BattleView.  Full answer exchange
// requires the game engine's React lifecycle and is better suited for
// the headless simulator (scripts/).

import { test, expect } from "@playwright/test";

const QUESTIONS = [
   { type: "definition", prompt: "Capital of France?", choices: ["Paris", "London", "Berlin", "Madrid"], answer: "Paris" },
   { type: "definition", prompt: "2 + 2 = ?", choices: ["3", "4", "5", "6"], answer: "4" },
];

test.describe("Live PvP render", () => {
   test("two pages both show same battle question", async ({ browser }) => {
      const ctx1 = await browser.newContext();
      const ctx2 = await browser.newContext();

      for (const ctx of [ctx1, ctx2]) {
         ctx.addInitScript(() => {
            const store = new Map();
            store.set("wordle_anon_id", crypto.randomUUID().slice(0, 12));
            store.set("wordle_anon_username", "Player");
            store.set("wordle_guest_opted_in", "true");
            store.set("wordle_guest_banner_last_dismissed", "2025-01-01");
            store.set("wordup_tutorial_completed", "true");
            store.set("wordle_tutorial_completed", "true");
            store.set("wordle_last_hydrated_timestamp", Date.now().toString());
            const origGet = localStorage.getItem.bind(localStorage);
            localStorage.getItem = (key: string) => store.get(key) ?? origGet(key);
         });
      }

      const page1 = await ctx1.newPage();
      const page2 = await ctx2.newPage();

      await page1.goto("/");
      await page2.goto("/");
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);

      // Seed stores
      const matchId = "e2e-pvp-" + Date.now();
      for (const p of [page1, page2]) {
         await p.evaluate(({ mid, questions }) => {
            const appStore = (window as any).__appStore;
            if (appStore) {
               appStore.setState?.({ wordupMode: "live", isWordUpOpen: true });
               if (appStore.setWordupMode) appStore.setWordupMode("live");
               if (appStore.setWordUpOpen) appStore.setWordUpOpen(true);
            }
            const store = (window as any).__liveStore;
            if (!store) return;
            store.setState({
               view: "battle", matchId: mid, role: "player1", questions,
               currentIdx: 0,
               matchData: {
                  id: mid, category: "mixed", status: "active",
                  game_type: "live", current_question_index: 0,
                  p1_answers: [], p2_answers: [],
                  p1_answered: false, p2_answered: false,
                  p1_score: 0, p2_score: 0,
               },
               opponentStats: { username: "Opponent", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
               selectedAnswer: null, revealAnswers: false, timeLeft: 10, maxTime: 10,
            });
         }, { mid: matchId, questions: QUESTIONS });
      }
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Both pages should show the question
      await expect(page1.getByText("Capital of France?").first()).toBeVisible({ timeout: 5000 });
      await expect(page2.getByText("Capital of France?").first()).toBeVisible({ timeout: 5000 });

      // Both show same score
      const s1 = await page1.evaluate(() => (window as any).__liveStore?.getState()?.matchData?.p1_score);
      const s2 = await page2.evaluate(() => (window as any).__liveStore?.getState()?.matchData?.p1_score);
      expect(s1).toBe(s2);

      await ctx1.close();
      await ctx2.close();
   });
});
