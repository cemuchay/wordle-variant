// ── E2E: Live PvP smoke test ────────────────────────────────────────
// Verifies two browser contexts can load the app and stores are available.

import { test, expect } from "@playwright/test";

test.describe("Live PvP (store)", () => {
   test("two pages load and stores are accessible", async ({ browser }) => {
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

      // Wait for stores on both pages
      await page1.waitForFunction(() => !!(window as any).__appStore && !!(window as any).__liveStore, null, { timeout: 10000 });
      await page2.waitForFunction(() => !!(window as any).__appStore && !!(window as any).__liveStore, null, { timeout: 10000 });

      // Verify stores are accessible
      const hasStore1 = await page1.evaluate(() => !!(window as any).__liveStore);
      const hasStore2 = await page2.evaluate(() => !!(window as any).__liveStore);
      expect(hasStore1).toBe(true);
      expect(hasStore2).toBe(true);

      await ctx1.close();
      await ctx2.close();
   });
});
