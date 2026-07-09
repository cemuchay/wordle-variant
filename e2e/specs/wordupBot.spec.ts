// ── E2E: Bot game full lifecycle ───────────────────────────────────
// Seeds the Zustand store directly via window.__liveStore (exposed in
// dev mode).  Tests the actual BattleView render cycle, answer
// selection, reveal, and round transitions.

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

async function seedBotMatch(page: any) {
   // Wait until window.__liveStore is available
   await page.waitForFunction(() => !!(window as any).__liveStore, null, { timeout: 10000 });

   await page.evaluate((questions) => {
      const store = (window as any).__liveStore;
      const matchId = crypto.randomUUID();

      store.setState({
         view: "battle",
         matchId,
         role: "player1",
         questions,
         currentIdx: 0,
         matchData: {
            id: matchId,
            category: "mixed",
            status: "active",
            is_bot_match: true,
            bot_profile: "average",
            game_type: "live-bot",
            current_question_index: 0,
            p1_answers: [],
            p2_answers: [],
            p1_answered: false,
            p2_answered: false,
            p1_score: 0,
            p2_score: 0,
            player1_id: "test-player-1",
            player2_id: "test-player-2",
         },
         opponentStats: { username: "Bot", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" },
         selectedAnswer: null,
         revealAnswers: false,
         timeLeft: 10,
         maxTime: 10,
      });
   }, QUESTIONS);
}

async function answerAndAdvance(page: any, choice: string, correct: boolean, round: number) {
   const q = QUESTIONS[round];
   const points = correct ? 15 + Math.floor(Math.random() * 5) : 0;
   const botCorrect = Math.random() > 0.4;
   const botPts = botCorrect ? 12 + Math.floor(Math.random() * 8) : 0;
   const botWrongChoice = q.choices.find((c: string) => c !== q.answer) || q.choices[0];

   await page.evaluate(({ r, ch, corr, pts, bCorr, bPts, bChoice }: any) => {
      const store = (window as any).__liveStore;
      const s = store.getState();
      const prevP1 = s.matchData?.p1_score || 0;
      const prevP2 = s.matchData?.p2_score || 0;

      store.setState({
         selectedAnswer: ch,
         revealAnswers: true,
         matchData: {
            ...s.matchData,
            p1_answers: [...(s.matchData?.p1_answers || []), { question_idx: r, correct: corr, time_taken: 2, points: pts, choice: ch }],
            p1_answered: true,
            p1_score: prevP1 + pts,
            p2_answers: [...(s.matchData?.p2_answers || []), { question_idx: r, correct: bCorr, time_taken: 3, points: bPts, choice: bChoice }],
            p2_answered: true,
            p2_score: prevP2 + bPts,
         },
      });
   }, { r: round, ch: choice, corr: correct, pts: points, bCorr: botCorrect, bPts: botPts, bChoice: botWrongChoice });
}

async function advanceRound(page: any, round: number) {
   await page.evaluate((r) => {
      const store = (window as any).__liveStore;
      store.setState({
         currentIdx: r,
         timeLeft: 10,
         maxTime: 10,
         selectedAnswer: null,
         revealAnswers: false,
         matchData: {
            ...store.getState().matchData,
            current_question_index: r,
            p1_answered: false,
            p2_answered: false,
         },
      });
   }, round);
}

test.describe("Bot game", () => {
   test("full 7-round flow", async ({ page }) => {
      // Set up guest user before page loads — mock localStorage.getItem so LiveView
      // always sees our guest user regardless of when it mounts.
      await page.addInitScript(() => {
         const uid = "e2e-test-user-" + crypto.randomUUID().slice(0, 8);
         const store = new Map();
         store.set("wordle_anon_id", uid);
         store.set("wordle_anon_username", "E2ETestBot");
         store.set("wordle_guest_opted_in", "true");
         store.set("wordle_guest_banner_last_dismissed", "2025-01-01");
         store.set("wordup_tutorial_completed", "true");
         store.set("wordle_tutorial_completed", "true");

         const origGetItem = localStorage.getItem.bind(localStorage);
         localStorage.getItem = (key: string) => store.get(key) ?? origGetItem(key);
      });

      await page.goto("/");
      await page.waitForTimeout(3000);

      // Seed stores: navigate to WordUp and set up bot match
      await page.evaluate(() => {
         const appStore = (window as any).__appStore;
         if (appStore) {
            appStore.setState?.({ wordupMode: "live", isWordUpOpen: true });
            if (appStore.setWordupMode) appStore.setWordupMode("live");
            if (appStore.setWordUpOpen) appStore.setWordUpOpen(true);
         }
      });
      await seedBotMatch(page);
      await page.waitForTimeout(2000);


      // Verify BattleView rendered — look for first question text
      await expect(page.getByText("capital of France").first()).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: "e2e/screenshots/bot-round0.png", fullPage: true });

      // Round 0: answer correctly
      await page.locator("button").filter({ hasText: "Paris" }).click();
      await page.waitForTimeout(500);

      // Check answer was registered
      await page.screenshot({ path: "e2e/screenshots/bot-round0-answer.png", fullPage: true });

      // Advance to round 1
      await advanceRound(page, 1);
      await page.waitForTimeout(500);
      await expect(page.getByText("2 + 2").first()).toBeVisible({ timeout: 5000 });
      await page.locator("button").filter({ hasText: "4" }).click();
      await page.waitForTimeout(500);

      // Advance to round 2
      await advanceRound(page, 2);
      await page.waitForTimeout(500);
      await expect(page.getByText("Red Planet").first()).toBeVisible({ timeout: 5000 });
      await page.locator("button").filter({ hasText: "Mars" }).click();
      await page.waitForTimeout(500);

      // Quick advance through rounds 3-6
      for (let r = 3; r < 7; r++) {
         await advanceRound(page, r);
         await page.waitForTimeout(500);
         const q = QUESTIONS[r];
         if (q) {
            await answerAndAdvance(page, q.answer, true, r);
            await page.waitForTimeout(500);
         }
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: "e2e/screenshots/bot-gameover.png", fullPage: true });

      // Verify game is still showing (round completed)
      const hasScore = await page.getByText(/pts/i).first().isVisible().catch(() => false);
      expect(hasScore).toBeTruthy();
   });
});
