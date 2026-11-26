import { supabase } from "../../lib/supabaseClient";
import {
   addRecentEntityIds,
   addRecentPrompts,
   addRecentQuestionIds,
   extractEntityIds,
   extractPromptKeys,
   extractQuestionIds,
   getRecentEntityIds,
   getRecentQuestionIds,
   isQuestionUuid,
} from "./recentQuestions";

export interface QuestionRequestContext {
   userId?: string;
   excludeQuestionIds: string[];
   excludeEntityIds: string[];
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
   extraExcludeEntityIds: string[] = [],
): Promise<QuestionRequestContext> {
   const userId = await getSessionUserId();
   const excludeQuestionIds = Array.from(
      new Set([...getRecentQuestionIds(category), ...extraExcludeIds.filter(isQuestionUuid)]),
   );
   const excludeEntityIds = Array.from(
      new Set([...getRecentEntityIds(category), ...extraExcludeEntityIds.filter(isQuestionUuid)]),
   );
   return { userId, excludeQuestionIds, excludeEntityIds };
}

/**
 * Marks questions as played: updates the local ring buffers immediately and
 * (for signed-in users) refreshes server-side seen history. Fire-and-forget.
 */
export function recordPlayedQuestions(
   category: string,
   questions: Array<{ id?: unknown; entityId?: unknown; prompt?: unknown }> | null | undefined,
   extraEntityIds: unknown[] = [],
): void {
   const ids = extractQuestionIds(questions);
   const entityIds = [
      ...extractEntityIds(questions),
      ...extraEntityIds.filter(isQuestionUuid),
   ];
   const prompts = extractPromptKeys(questions);

   if (ids.length > 0) {
      addRecentQuestionIds(category, ids);
   }
   if (entityIds.length > 0) {
      addRecentEntityIds(category, entityIds);
   }
   if (prompts.length > 0) {
      addRecentPrompts(category, prompts);
   }

   if (ids.length === 0) return;
   void (async () => {
      try {
         if (!(await getSessionUserId())) return;
         await supabase.rpc("record_my_handcrafted_seen", { p_question_ids: ids });
      } catch {
         /* non-critical */
      }
   })();
}
