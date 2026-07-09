// ── E2E: Live PvP via real engine dispatch ─────────────────────────
// Two pages, each with engine dispatched match state.  Answer clicks
// go through the real handleAnswerSelect.  Full engine lifecycle
// (reveal, advance) runs naturally on each page.

import { test, expect } from "@playwright/test";

const QUESTIONS = [
   { type: "definition", prompt: "Capital of France?", choices: ["Paris", "London", "Berlin", "Madrid"], answer: "Paris" },
   { type: "definition", prompt: "2 + 2 = ?", choices: ["3", "4", "5", "6"], answer: "4" },
];

async function navigateToWordUp(page: any) {
   await page.waitForFunction(() => !!(window as any).__appStore && !!(window as any).__liveStore, null, { timeout: 10000 });
   await page.evaluate(() => {
      const app = (window as any).__appStore;
      if (!app) return;
      app.setState({ isWordUpOpen: true, isMoreOpen: true, wordupMode: "live" });
      if (app.setWordupMode) app.setWordupMode("live");
      if (app.setWordUpOpen) app.setWordUpOpen(true);
   });
   await page.waitForFunction(() => !!(window as any).__gameDispatch, null, { timeout: 15000 });
}

async function seedEngineForLiveMatch(page: any, role: "player1" | "player2", matchId: string) {
   await page.evaluate(({ r, mid, qs }) => {
      const d = (window as any).__gameDispatch;
      const store = (window as any).__liveStore;

      // Engine state
      d({ type: "SET_MATCH_DATA", data: {
         id: mid, category: "mixed", status: "active",
         game_type: "live", current_question_index: 0,
         p1_answers: [], p2_answers: [],
         p1_answered: false, p2_answered: false,
         p1_score: 0, p2_score: 0,
         player1_id: "p1-e2e", player2_id: "p2-e2e",
      }});
      d({ type: "SET_QUESTIONS", questions: qs });
      d({ type: "SET_PHASE", phase: "playing" });
      d({ type: "SET_ROUND", round: 0, timeLeft: 10, maxTime: 10 });
      d({ type: "CLEAR_ANSWER" });
      d({ type: "HIDE_REVEAL" });

      // Zustand sync
      if (store) {
         store.setState({
            view: "battle", matchId: mid, role: r, questions: qs, currentIdx: 0,
            opponentStats: { username: r === "player1" ? "Player2" : "Player1", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
         });
      }
   }, { r: role, mid: matchId, qs: QUESTIONS });
}

test.describe("Live PvP (engine)", () => {
   test("two pages answer independently through real engine", async ({ browser }) => {
      const ctx1 = await browser.newContext();
      const ctx2 = await browser.newContext();

      const initScript = () => {
         const s = new Map();
         s.set("wordle_anon_id", crypto.randomUUID().slice(0, 12));
         s.set("wordle_anon_username", "Player");
         s.set("wordle_guest_opted_in", "true");
         s.set("wordle_guest_banner_last_dismissed", "2025-01-01");
         s.set("wordup_tutorial_completed", "true");
         s.set("wordle_tutorial_completed", "true");
         s.set("wordle_last_hydrated_timestamp", Date.now().toString());
         const orig = localStorage.getItem.bind(localStorage);
         localStorage.getItem = (k: string) => s.get(k) ?? orig(k);
      };
      ctx1.addInitScript(initScript);
      ctx2.addInitScript(initScript);

      const page1 = await ctx1.newPage();
      const page2 = await ctx2.newPage();

      await page1.goto("/");
      await page2.goto("/");
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Navigate both to WordUp
      await navigateToWordUp(page1);
      await navigateToWordUp(page2);

      const matchId = "e2e-pvp-" + Date.now();
      await seedEngineForLiveMatch(page1, "player1", matchId);
      await seedEngineForLiveMatch(page2, "player2", matchId);
      await page1.waitForTimeout(1000);
      await page2.waitForTimeout(1000);

      // Both show question
      await expect(page1.getByText("Capital of France?").first()).toBeVisible({ timeout: 5000 });
      await expect(page2.getByText("Capital of France?").first()).toBeVisible({ timeout: 5000 });

      // Each page answers independently through real handleAnswerSelect
      await page1.locator("button").filter({ hasText: "Paris" }).click();
      await page2.locator("button").filter({ hasText: "London" }).click();
      await page1.waitForTimeout(500);
      await page2.waitForTimeout(500);

      // Verify each engine tracked their own answer
      const p1Ans = await page1.evaluate(() => {
         const s = (window as any).__liveStore?.getState();
         return s?.matchData?.p1_answers?.length;
      });
      const p2Ans = await page2.evaluate(() => {
         const s = (window as any).__liveStore?.getState();
         return s?.matchData?.p2_answers?.length;
      });
      expect(p1Ans).toBe(1);
      expect(p2Ans).toBe(1);

      await ctx1.close();
      await ctx2.close();
   });
});
