// ── Mock channel layer for deterministic PvP simulation ────────────

import type { Answer } from "./simEngine";

export type MockEvent =
   | { type: "player_answered"; role: "player1" | "player2"; answers: Answer[]; myScore: number; oppScore: number }
   | { type: "advance_round"; nextIdx: number };

export class MockMatchClient {
   private partner: MockMatchClient | null = null;
   public inbox: MockEvent[] = [];
   public outbox: MockEvent[] = [];
   private delayMs: number;

   constructor(delayMs = 0) {
      this.delayMs = delayMs;
   }

   link(other: MockMatchClient): void {
      this.partner = other;
      other.partner = this;
   }

   async send(event: MockEvent): Promise<void> {
      this.outbox.push(event);
      if (!this.partner) return;
      if (this.delayMs > 0) {
         setTimeout(() => this.partner!.inbox.push(event), this.delayMs);
      } else {
         this.partner.inbox.push(event);
      }
   }

   async receive(timeoutMs = 1000): Promise<MockEvent | null> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
         if (this.inbox.length > 0) return this.inbox.shift()!;
         await new Promise((r) => setTimeout(r, 5));
      }
      return null;
   }

   async drainInbox(): Promise<MockEvent[]> {
      const events = [...this.inbox];
      this.inbox = [];
      return events;
   }
}
