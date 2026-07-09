#!/usr/bin/env tsx
// ── Game Simulator CLI ─────────────────────────────────────────────
// Usage: npx tsx scripts/gameSimulator.ts --mode bot --runs 10
//        npx tsx scripts/gameSimulator.ts --mode pvp --mock --runs 5
//        npx tsx scripts/gameSimulator.ts --mode bot --runs 100 --report

import { runBotSimulation } from "./simBotGame";
import { runPvpSimulation } from "./simPvPGame";
import { SimLogger } from "./simLogger";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

function parseArgs() {
   const args = process.argv.slice(2);
   const get = (flag: string): string | undefined => {
      const idx = args.indexOf(flag);
      return idx >= 0 ? args[idx + 1] : undefined;
   };
   const has = (flag: string): boolean => args.includes(flag);

   return {
      mode: (get("--mode") ?? get("-m") ?? "bot") as "bot" | "pvp",
      category: get("--category") ?? get("-c") ?? "mixed",
      runs: parseInt(get("--runs") ?? get("-n") ?? "1", 10),
      seed: get("--seed") ? parseInt(get("--seed")!, 10) : undefined,
      mock: has("--mock"),
      report: has("--report"),
   };
}

async function main() {
   const opts = parseArgs();

   console.log(`═══════════════════════════════════════════`);
   console.log(`  WORDUP GAME SIMULATOR`);
   console.log(`  Mode: ${opts.mode}${opts.mock ? " (mock)" : ""}`);
   console.log(`  Category: ${opts.category}`);
   console.log(`  Runs: ${opts.runs}`);
   if (opts.seed) console.log(`  Seed: ${opts.seed}`);
   console.log(`═══════════════════════════════════════════\n`);

   const logger = new SimLogger();

   if (opts.mode === "bot") {
      await runBotSimulation({
         category: opts.category,
         runs: opts.runs,
         seed: opts.seed,
         logger,
      });
   } else {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      await runPvpSimulation({
         category: opts.category,
         runs: opts.runs,
         seed: opts.seed,
         mock: opts.mock,
         logger,
         supabaseUrl,
         serviceRoleKey,
      });
   }

   if (opts.report || opts.runs > 1) {
      logger.printSummary();
   }

   const s = logger.summary();
   process.exit(s.failed > 0 ? 1 : 0);
}

main().catch((err) => {
   console.error("Fatal error:", err);
   process.exit(1);
});
