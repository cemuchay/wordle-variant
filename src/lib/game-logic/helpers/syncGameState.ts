import { supabase } from "@/lib/supabaseClient";
import { calculateSkillIndex } from "..";

export const syncGameStateSub = async (
   userId: string,
   date: string | null,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   payload: any,
) => {
   if (!date) return;

   // DB-side guard: don't overwrite if server already has equal or better data
   const { data: existing } = await supabase
      .from("scores")
      .select("guesses, hints_used, hint_record")
      .eq("user_id", userId)
      .eq("game_date", date)
      .maybeSingle();

   if (existing) {
      const existingCount = existing.guesses?.length ?? 0;
      const incomingCount = payload.guesses?.length ?? 0;

      // Server has MORE guesses — client is stale, abort
      if (existingCount > incomingCount) return;

      if (existingCount === incomingCount) {
         // Server has hint but client doesn't — don't roll back
         if (existing.hints_used && !payload.usedHint) return;

         // Both have same hint state — already synced, skip
         if (
            existing.hints_used === payload.usedHint &&
            JSON.stringify(existing.hint_record) ===
               JSON.stringify(payload.hintRecord)
         )
            return;
      }
   }

   const isGameOver = payload.status !== "playing";

   const skillScore = isGameOver
      ? calculateSkillIndex({
           attempts: payload.guesses.length,
           maxAttempts: payload.config.maxAttempts,
           usedHint: payload.usedHint,
           guesses: payload.guesses,
           gameDate: date,
           hintRecord: payload.hintRecord,
        }).finalScore
      : 0;

   const { error } = await supabase.from("scores").upsert(
      {
         user_id: userId,
         game_date: date,
         guesses: payload.guesses,
         status: payload.status,
         hints_used: payload.usedHint,
         hint_record: payload.hintRecord,
         word_length: payload.config.length,
         skill_score: skillScore,
         attempts: payload.guesses.length,
         game_message: payload.gameMessage,
      },
      { onConflict: "user_id, game_date" },
   );

   if (error) {
      console.error("Cloud sync failed:", error.message);
      throw error;
   }

   return skillScore;
};
