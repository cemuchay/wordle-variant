import { supabase } from "../../lib/supabaseClient";
import { addRecentQuestionIds, extractQuestionIds, getRecentQuestionIds, isQuestionUuid } from "./recentQuestions";

export interface QuestionRequestContext {
   userId?: string;
   excludeQuestionIds: string[];
}

async function getSessionUserId(): Promise<string | undefined> {
   try {
      const { data } = await supabase.auth.getSession();
      const id = data?.session?.user?.id;
      return isQuestionUuid(id) ? id : undefined;
   } catch {
      return undefined;
   }
}

/** Extra body fields for `generate-match-questions` that prevent cross-match repetition. */
export async function getQuestionRequestContext(
   category: string,
   extraExcludeIds: string[] = [],
): Promise<QuestionRequestContext> {
   const userId = await getSessionUserId();
   const excludeQuestionIds = Array.from(
      new Set([...getRecentQuestionIds(category), ...extraExcludeIds.filter(isQuestionUuid)]),
   );
   return { userId, excludeQuestionIds };
}

/**
 * Marks questions as played: updates the local ring buffer immediately and
 * (for signed-in users) refreshes server-side seen history. Fire-and-forget.
 */
export function recordPlayedQuestions(
   category: string,
   questions: Array<{ id?: unknown }> | null | undefined,
): void {
   const ids = extractQuestionIds(questions);
   if (ids.length === 0) return;
   addRecentQuestionIds(category, ids);
   void (async () => {
      try {
         if (!(await getSessionUserId())) return;
         await supabase.rpc("record_my_handcrafted_seen", { p_question_ids: ids });
      } catch {
         /* non-critical */
      }
   })();
}
