// ── Structured logging + state diffing ─────────────────────────────

export type AnomalyLevel = "warn" | "error" | "info";

export interface Anomaly {
   run: number;
   round: number;
   level: AnomalyLevel;
   message: string;
   expected?: any;
   actual?: any;
}

export interface SimRunReport {
   run: number;
   mode: string;
   category: string;
   anomalies: Anomaly[];
   rounds: any[];
   totalDurationMs: number;
   success: boolean;
}

export class SimLogger {
   runs: SimRunReport[] = [];
   private currentRun: SimRunReport | null = null;

   startRun(run: number, mode: string, category: string) {
      console.log(`\n═══════════════════════════════════════════`);
      console.log(`  ${mode.toUpperCase()} GAME — Run ${run}`);
      console.log(`  Category: ${category}`);
      console.log(`═══════════════════════════════════════════\n`);
      this.currentRun = {
         run, mode, category,
         anomalies: [], rounds: [],
         totalDurationMs: 0, success: true,
      };
   }

   endRun(totalDurationMs: number) {
      if (this.currentRun) {
         this.currentRun.totalDurationMs = totalDurationMs;
         this.currentRun.success = this.currentRun.anomalies.filter(a => a.level === "error").length === 0;
         this.runs.push(this.currentRun);
         console.log(`\n  Duration: ${(totalDurationMs / 1000).toFixed(1)}s`);
         if (this.currentRun.anomalies.length > 0) {
            console.log(`  Anomalies: ${this.currentRun.anomalies.length}`);
            for (const a of this.currentRun.anomalies) {
               console.log(`    [${a.level.toUpperCase()}] ${a.message}`);
            }
         } else {
            console.log(`  \x1b[32mNo anomalies detected.\x1b[0m`);
         }
         console.log(`═══════════════════════════════════════════\n`);
         this.currentRun = null;
      }
   }

   logQuestions(questions: { prompt: string; answer: string }[]) {
      console.log(`  Questions generated: ${questions.length}`);
      questions.forEach((q, i) => {
         console.log(`    R${i}: "${q.prompt}" → ${q.answer}`);
      });
      console.log();
   }

   logRoundStart(round: number) {
      const label = round === 6 ? `━━━ Round ${round} (DOUBLE POINTS) ━━━` : `━━━ Round ${round} ━━━`;
      console.log(`  ${label}`);
   }

   logAnswer(player: string, choice: string, correct: boolean, pts: number) {
      const mark = correct ? "✓" : "✗";
      console.log(`  ${player} chooses: ${choice} ${mark} (${pts}pts)`);
   }

   logBotSim(br: { correct: boolean; time_taken: number }, elapsed: number) {
      console.log(`  Bot simulated: answer in ${br.time_taken.toFixed(1)}s, ${br.correct ? "correct" : "incorrect"}`);
   }

   logBroadcast(from: string, event: string) {
      console.log(`  → ${from} broadcasts: "${event}"`);
   }

   logReceive(to: string, event: string) {
      console.log(`  ← ${to} receives: "${event}"`);
   }

   logScoreUpdate(p1Score: number, p2Score: number, delta: number) {
      const sign = delta >= 0 ? "+" : "";
      console.log(`  Scores: P1=${p1Score}  P2=${p2Score}  Δ=${sign}${delta}`);
   }

   logRoundEnd(round: number) {
      console.log();
   }

   logGameOver(p1Score: number, p2Score: number) {
      const winner = p1Score > p2Score ? "You 🎉" : p1Score < p2Score ? "Bot 🤖" : "Tie 🤝";
      console.log(`  ═══════════════════════════════════════════`);
      console.log(`  GAME OVER`);
      console.log(`  P1 (You):  ${p1Score}pts`);
      console.log(`  P2 (Bot):  ${p2Score}pts`);
      console.log(`  Winner: ${winner}`);
   }

   logDbSave(success: boolean, matchId?: string) {
      if (success) {
         console.log(`  \x1b[32mSaved to DB\x1b[0m ${matchId ? `(${matchId.slice(0, 8)}...)` : ""}`);
      } else {
         console.log(`  \x1b[31mDB save failed — state preserved for retry\x1b[0m`);
      }
   }

   logStateSync(status: "ok" | "mismatch", diffs: number) {
      if (status === "ok") {
         console.log(`  State sync: \x1b[32m✓\x1b[0m`);
      } else {
         console.log(`  State sync: \x1b[31m✗ (${diffs} diff(s))\x1b[0m`);
      }
   }

   logAnomaly(level: AnomalyLevel, message: string, round: number, expected?: any, actual?: any) {
      const a: Anomaly = { run: this.currentRun?.run ?? 0, round, level, message, expected, actual };
      this.currentRun?.anomalies.push(a);
      const sym = level === "error" ? "✗" : level === "warn" ? "⚠" : "ℹ";
      console.log(`  ${sym} [${level.toUpperCase()}] ${message}`);
      if (expected !== undefined && actual !== undefined) {
         console.log(`    expected: ${JSON.stringify(expected)}`);
         console.log(`    actual:   ${JSON.stringify(actual)}`);
      }
   }

   addRound(data: any) {
      this.currentRun?.rounds.push(data);
   }

   summary(): { total: number; passed: number; failed: number; anomalies: Anomaly[] } {
      const total = this.runs.length;
      const passed = this.runs.filter(r => r.success).length;
      const failed = total - passed;
      const anomalies = this.runs.flatMap(r => r.anomalies);
      return { total, passed, failed, anomalies };
   }

   printSummary() {
      const s = this.summary();
      if (s.total <= 1) return;
      console.log(`\n═══════════════════════════════════════════`);
      console.log(`  SIMULATION SUMMARY`);
      console.log(`  Runs: ${s.total}  Passed: ${s.passed}  Failed: ${s.failed}`);
      if (s.anomalies.length > 0) {
         console.log(`  Anomalies: ${s.anomalies.length}`);
         for (const a of s.anomalies) {
            console.log(`    [${a.level.toUpperCase()}] Run ${a.run} R${a.round}: ${a.message}`);
         }
      } else {
         console.log(`  No anomalies detected.`);
      }
      console.log(`═══════════════════════════════════════════\n`);
   }
}

// ── State diffing ─────────────────────────────────────────────────

const DIFF_SKIP_KEYS = new Set([
   "question_started_at", "completed_at", "created_at", "selectedAnswer",
   "savedAt", "timeLeft", "maxTime",
]);

export function diffState(label: string, a: any, b: any, path = ""): Anomaly[] {
   const result: Anomaly[] = [];
   const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
   for (const key of allKeys) {
      if (DIFF_SKIP_KEYS.has(key)) continue;
      const fullPath = path ? `${path}.${key}` : key;
      if (typeof a?.[key] === "object" && typeof b?.[key] === "object" && a?.[key] !== null && b?.[key] !== null) {
         if (Array.isArray(a[key]) && Array.isArray(b[key])) {
            if (a[key].length !== b[key].length) {
               result.push({ run: 0, round: 0, level: "error", message: `${label} ${fullPath} length mismatch`, expected: a[key].length, actual: b[key].length });
            }
         } else {
            result.push(...diffState(label, a[key], b[key], fullPath));
         }
      } else if (a?.[key] !== b?.[key]) {
         result.push({ run: 0, round: 0, level: "error", message: `${label} ${fullPath} mismatch`, expected: a?.[key], actual: b?.[key] });
      }
   }
   return result;
}
