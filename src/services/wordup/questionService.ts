import { supabase } from "../../lib/supabaseClient";
import { isProceduralCategory } from "./generatorRegistry";

/**
 * Generates questions for a match.
 * - Procedural categories (capitals_clash, element_arena, etc.) → edge function (server-side)
 * - Legacy word categories (mixed, 5_letters, etc.) → client-side generation (unchanged)
 */
export async function generateMatchQuestions(matchId: string, category: string): Promise<void> {
   if (isProceduralCategory(category)) {
      await generateViaEdgeFunction(matchId, category);
   } else {
      await generateLocally(matchId, category);
   }
}

async function generateViaEdgeFunction(matchId: string, category: string): Promise<void> {
   const seed = `${matchId}-${category}`;

   const { error: invokeError } = await supabase.functions.invoke(
      "generate-match-questions",
      { body: { matchId, category, seed } },
   );

   if (invokeError) {
      console.error("[questionService] Edge function failed:", invokeError);
      // Fallback: generate locally if edge function is unavailable
      await generateLocally(matchId, category);
   }
}

async function generateLocally(matchId: string, category: string): Promise<void> {
   const { generateWordUpQuestions, generateSecretKey, encryptQuestions } =
      await import("../../utils/wordupQuestionGenerator");

   const rawQuestions = generateWordUpQuestions(category);
   const secretKey = generateSecretKey();
   const encryptedStr = encryptQuestions(rawQuestions, secretKey);

   const { error } = await supabase
      .from("wordup_matches")
      .update({
         questions: encryptedStr,
         encryption_key: secretKey,
         status: "countdown",
      })
      .eq("id", matchId);

   if (error) {
      console.error("[questionService] Local generation DB update failed:", error);
      throw error;
   }
}
