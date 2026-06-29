import { supabase } from "../../lib/supabaseClient";
import { isProceduralCategory } from "./generatorRegistry";
import { wordupNetworkGate } from "../../components/wordup/WordUpView/services/wordupNetworkGate";

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

   const invokeResult = await wordupNetworkGate.enqueue(
      'post',
      'invoke question generator edge function',
      async () => {
         const { data, error } = await supabase.functions.invoke(
            "generate-match-questions",
            { body: { matchId, category, seed } },
         );
         if (error) throw error;
         return data;
      }
   ).catch((invokeError) => {
      console.error("[questionService] Edge function failed:", invokeError);
      return { error: invokeError };
   });

   if (invokeResult && 'error' in invokeResult) {
      // Fallback: generate locally if edge function is unavailable
      await generateLocally(matchId, category);
   }
}

async function generateLocally(matchId: string, category: string): Promise<void> {
   const { generateWordUpQuestions, generateSecretKey, encryptQuestions } =
      await import("../../utils/wordupQuestionGenerator");

   const rawQuestions = await generateWordUpQuestions(category);
   const secretKey = generateSecretKey();
   const encryptedStr = encryptQuestions(rawQuestions, secretKey);

   // Fetch the match metadata to determine the game_type and status
   const match = await wordupNetworkGate.enqueue(
      "get",
      `load match metadata for ID ${matchId}`,
      async () => {
         const { data, error } = await supabase
            .from("wordup_matches")
            .select("game_type, status")
            .eq("id", matchId)
            .single();
         if (error) throw error;
         return data;
      }
   );

   const newStatus = match?.game_type === "async" ? (match?.status || "waiting") : "countdown";

   try {
      await wordupNetworkGate.enqueue(
         "put",
         "save local questions and set status",
         {
            table: "wordup_matches",
            action: "update",
            payload: {
               questions: encryptedStr,
               encryption_key: secretKey,
               status: newStatus,
            },
            filter: { id: matchId }
         }
      );
   } catch (error) {
      console.error("[questionService] Local generation DB update failed:", error);
      throw error;
   }
}
