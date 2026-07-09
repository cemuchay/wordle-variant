// ── Supabase channel wrapper for real Realtime mode ────────────────
// Uses supabase-js client with service-role key for direct DB access.

import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { sleep } from "./simUtils";

export interface MatchClientHandlers {
   onPlayerAnswered?: (payload: { role: string; answers: any[]; my_score: number; opp_score: number }) => void;
   onAdvanceRound?: (payload: { nextIdx: number }) => void;
   onMatchUpdate?: (match: any) => void;
}

export class SimMatchClient {
   private supabase: SupabaseClient;
   private channel: RealtimeChannel | null = null;
   private handlers: MatchClientHandlers = {};
   public userId: string;
   public role: "player1" | "player2" | null = null;
   public matchId: string | null = null;

   constructor(supabaseUrl: string, serviceRoleKey: string, userId: string) {
      this.supabase = createClient(supabaseUrl, serviceRoleKey, {
         auth: { persistSession: false, autoRefreshToken: false },
         realtime: { params: { log_level: "error" } },
      });
      this.userId = userId;
   }

   get client(): SupabaseClient {
      return this.supabase;
   }

   async createBotMatch(userId: string, category: string): Promise<{ matchId: string }> {
      const { data, error } = await this.supabase.rpc("join_wordup_queue", {
         p_user_id: userId,
         p_category: category,
      });
      if (error) throw new Error(`join_wordup_queue failed: ${error.message}`);
      return data;
   }

   async joinQueue(userId: string, category: string): Promise<any> {
      const { data, error } = await this.supabase.rpc("join_wordup_queue", {
         p_user_id: userId,
         p_category: category,
      });
      if (error) throw new Error(`join_wordup_queue failed: ${error.message}`);
      return data;
   }

   async getMatch(matchId: string): Promise<any> {
      const { data, error } = await this.supabase
         .from("wordup_matches")
         .select("*")
         .eq("id", matchId)
         .single();
      if (error) throw new Error(`getMatch failed: ${error.message}`);
      return data;
   }

   async updateMatch(matchId: string, updates: Record<string, any>): Promise<void> {
      const { error } = await this.supabase
         .from("wordup_matches")
         .update(updates)
         .eq("id", matchId);
      if (error) throw new Error(`updateMatch failed: ${error.message}`);
   }

   subscribe(matchId: string, handlers: MatchClientHandlers): void {
      this.handlers = handlers;
      this.matchId = matchId;

      this.channel = this.supabase.channel(`wordup_match_${matchId}`);

      this.channel
         .on("broadcast", { event: "player_answered" }, ({ payload }: any) => {
            this.handlers.onPlayerAnswered?.(payload);
         })
         .on("broadcast", { event: "advance_round" }, ({ payload }: any) => {
            this.handlers.onAdvanceRound?.(payload);
         })
         .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "wordup_matches",
            filter: `id=eq.${matchId}`,
         }, ({ new: match }: any) => {
            this.handlers.onMatchUpdate?.(match);
         });

      this.channel.subscribe((status) => {
         if (status !== "SUBSCRIBED") {
            console.warn(`[SimMatchClient] Channel status: ${status}`);
         }
      });
   }

   async sendAnswer(
      role: "player1" | "player2",
      answers: any[],
      myScore: number,
      oppScore: number,
   ): Promise<void> {
      await this.channel?.send({
         type: "broadcast",
         event: "player_answered",
         payload: { role, answers, my_score: myScore, opp_score: oppScore },
      });
   }

   async broadcastAdvanceRound(nextIdx: number): Promise<void> {
      await this.channel?.send({
         type: "broadcast",
         event: "advance_round",
         payload: { nextIdx },
      });
   }

   async waitForCondition(
      condition: () => boolean | Promise<boolean>,
      timeoutMs = 10000,
      pollMs = 100,
   ): Promise<boolean> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
         if (await condition()) return true;
         await sleep(pollMs);
      }
      return false;
   }

   unsubscribe(): void {
      this.supabase.removeChannel(this.channel!);
      this.channel = null;
   }
}
