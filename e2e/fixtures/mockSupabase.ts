// ── Supabase mock helpers for Playwright ───────────────────────────
// Intercepts network requests to supabase.co and returns controlled responses.

import type { Page } from "@playwright/test";

const SUPABASE_URL = "https://fhunogyceifqprpcosdg.supabase.co";

/**
 * Set up guest user in localStorage so the lobby doesn't block on auth.
 */
export async function setupGuestUser(page: Page): Promise<string> {
   const id = crypto.randomUUID();
   await page.evaluate(
      ({ uid, name }) => {
         localStorage.setItem("wordle_anon_id", uid);
         localStorage.setItem("wordle_anon_username", name);
         localStorage.setItem("wordle_guest_opted_in", "true");
         localStorage.setItem("wordle_guest_banner_last_dismissed", new Date().toISOString().split('T')[0]);
      },
      { uid: id, name: "E2ETestPlayer" },
   );
   return id;
}

/**
 * Stub all Supabase REST and RPC calls for bot-game simulation.
 * The queue RPC returns "queued" so the bot fallback timer fires.
 */
export async function mockSupabaseBotGame(page: Page, userId: string) {
   await page.route("**/*.supabase.co/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // RPC: join_wordup_queue → return queued
      if (url.includes("/rest/v1/rpc/join_wordup_queue")) {
         return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "queued", match_id: null, role: "player1" }),
         });
      }

      // RPC: get_user_skill
      if (url.includes("/rest/v1/rpc/get_user_skill")) {
         return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: String(1500),
         });
      }

      // RPC: get_wordup_entities_v2
      if (url.includes("/rest/v1/rpc/get_wordup_entities_v2")) {
         return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
         });
      }

      // Edge function: generate-match-questions → return empty
      if (url.includes("generate-match-questions")) {
         return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({}),
         });
      }

      // Any other POST (edge functions, etc.) → 200 empty
      if (method === "POST") {
         return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }

      // GET requests (selects, fetches) → return empty arrays/objects
      if (method === "GET") {
         return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }

      // PATCH/PUT (updates) → 200 ok
      if (method === "PATCH" || method === "PUT") {
         return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }

      await route.continue();
   });
}

/**
 * Stub all Supabase REST and RPC calls for PvP game simulation.
 * P1 → queued, P2 → matched with match_id.
 */
export async function mockSupabasePvPGame(
   page: Page,
   userId: string,
   role: "player1" | "player2",
   matchId: string,
) {
   await page.route("**/*.supabase.co/**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // RPC: join_wordup_queue
      if (url.includes("/rest/v1/rpc/join_wordup_queue")) {
         if (role === "player1") {
            return route.fulfill({
               status: 200,
               contentType: "application/json",
               body: JSON.stringify({ status: "queued", match_id: null, role: "player1" }),
            });
         } else {
            return route.fulfill({
               status: 200,
               contentType: "application/json",
               body: JSON.stringify({ status: "waiting", match_id: matchId, role: "player2" }),
            });
         }
      }

      // RPC: get_user_skill
      if (url.includes("/rest/v1/rpc/get_user_skill")) {
         return route.fulfill({ status: 200, contentType: "application/json", body: String(1500) });
      }

      // RPC: get_wordup_entities_v2
      if (url.includes("/rest/v1/rpc/get_wordup_entities_v2")) {
         return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      }

      // Match SELECT (loading match data)
      if (url.includes("/rest/v1/wordup_matches") && method === "GET") {
         return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
               id: matchId,
               category: "mixed",
               status: "waiting",
               player1_id: "p1-id",
               player2_id: "p2-id",
               game_type: "live",
               current_question_index: 0,
               p1_answers: [],
               p2_answers: [],
               questions: null,
               encrypted_questions: null,
               encryption_key: null,
               created_at: new Date().toISOString(),
            }),
         });
      }

      // Edge function: generate-match-questions
      if (url.includes("generate-match-questions")) {
         return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
      }

      // Auth / user endpoint
      if (url.includes("/auth/")) {
         return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }

      if (method === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      if (method === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      if (method === "PATCH" || method === "PUT") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });

      await route.continue();
   });
}

/**
 * Inject mock broadcast channel into the page to forward events
 * between two Playwright pages via window.__mockChannel.
 */
export async function installMockChannel(page: Page, matchId: string) {
   await page.evaluate((mId) => {
      const listeners: Record<string, Array<(payload: any) => void>> = {};

      window.__mockBroadcast = {
         on(event: string, cb: (payload: any) => void) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
         },
         send(event: string, payload: any) {
            (listeners[event] || []).forEach((cb) => cb(payload));
         },
      };

      // Override Supabase channel creation to use mock broadcast
      const origChannel = (window as any).supabase?.channel;
      if (origChannel) {
         (window as any).supabase.channel = () => ({
            on: () => ({ on: () => ({ subscribe: (cb: any) => cb?.("SUBSCRIBED") }) }),
         });
      }
   }, matchId);
}
