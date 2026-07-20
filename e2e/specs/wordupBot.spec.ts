// ── E2E: Bot game smoke test ────────────────────────────────────────
// Verifies the app loads, WordUp can be opened, and stores are available.

import { test, expect } from "@playwright/test";

const QUESTIONS = [
   { type: "definition", prompt: "Capital of France?", choices: ["Paris", "London", "Berlin", "Madrid"], answer: "Paris" },
   { type: "math", prompt: "2 + 2 = ?", choices: ["3", "4", "5", "6"], answer: "4" },
];

test.describe("Bot game (store)", () => {
   test("app loads and store can be seeded for bot match", async ({ page }) => {
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

      // Wait for zustand stores to be exposed
      await page.waitForFunction(() => !!(window as any).__appStore && !!(window as any).__liveStore, null, { timeout: 10000 });

      // Open WordUp
      await page.evaluate(() => {
         const app = (window as any).__appStore;
         if (!app) return;
         app.setState({ isWordUpOpen: true, wordupMode: "live" });
         if (app.setWordupMode) app.setWordupMode("live");
         if (app.setWordUpOpen) app.setWordUpOpen(true);
      });

      await page.waitForTimeout(3000);

      // Seed store with bot match state
      const matchId = "e2e-bot-" + crypto.randomUUID().slice(0, 8);
      const storeSeeded = await page.evaluate(({ mid, qs }) => {
         const store = (window as any).__liveStore;
         if (!store) return false;
         store.setState({
            view: "battle",
            matchId: mid,
            role: "player1",
            questions: qs,
            currentIdx: 0,
            matchData: {
               id: mid, category: "mixed", status: "active",
               is_bot_match: true, bot_profile: "average",
               game_type: "live-bot", current_question_index: 0,
               p1_answers: [], p2_answers: [], p1_answered: false, p2_answered: false,
               p1_score: 0, p2_score: 0,
               player1_id: "test-player-1", player2_id: "test-player-2",
            },
            opponentStats: { username: "Bot", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
         });
         return true;
      }, { mid: matchId, qs: QUESTIONS });

      expect(storeSeeded).toBe(true);

      // Verify store was seeded
      const storeState = await page.evaluate(() => {
         const s = (window as any).__liveStore?.getState();
         return s ? { view: s.view, questionCount: s.questions?.length, role: s.role } : null;
      });
      expect(storeState).toEqual({ view: "battle", questionCount: 2, role: "player1" });
   });
});
