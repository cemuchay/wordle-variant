import { supabase } from "../lib/supabaseClient";
import {
   MAX_WORD_EFFECTS_PER_DM,
   normalizeEffectEmoji,
   normalizeTriggerWord,
   type DmWordEffect,
} from "../utils/wordEffects";
import {
   normalizeNickname,
   type DmNicknameRow,
   type DmNicknamesMap,
} from "../utils/dmNicknames";

export async function fetchDmWordEffects(groupId: string): Promise<DmWordEffect[]> {
   const { data, error } = await supabase
      .from("dm_word_effects")
      .select("id, group_id, trigger_word, emoji, created_by, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

   if (error) throw error;
   return (data ?? []) as DmWordEffect[];
}

export async function upsertDmWordEffect(
   groupId: string,
   rawTriggerWord: string,
   rawEmoji: string,
   userId: string,
   existingCount?: number,
): Promise<DmWordEffect> {
   const triggerWord = normalizeTriggerWord(rawTriggerWord);
   const emoji = normalizeEffectEmoji(rawEmoji);

   if (!triggerWord) {
      throw new Error("Please enter a word or phrase.");
   }
   if (!emoji) {
      throw new Error("Please choose an emoji.");
   }

   // Check if an effect with this trigger word already exists in this DM (case-insensitive)
   const { data: existing } = await supabase
      .from("dm_word_effects")
      .select("id")
      .eq("group_id", groupId)
      .ilike("trigger_word", triggerWord)
      .maybeSingle();

   if (existing?.id) {
      const { data, error } = await supabase
         .from("dm_word_effects")
         .update({ trigger_word: triggerWord, emoji, created_by: userId })
         .eq("id", existing.id)
         .select("id, group_id, trigger_word, emoji, created_by, created_at")
         .single();

      if (error) throw error;
      return data as DmWordEffect;
   }

   if (typeof existingCount === "number" && existingCount >= MAX_WORD_EFFECTS_PER_DM) {
      throw new Error(`You can add up to ${MAX_WORD_EFFECTS_PER_DM} word effects per DM.`);
   }

   const { data, error } = await supabase
      .from("dm_word_effects")
      .insert({
         group_id: groupId,
         trigger_word: triggerWord,
         emoji,
         created_by: userId,
      })
      .select("id, group_id, trigger_word, emoji, created_by, created_at")
      .single();

   if (error) throw error;
   return data as DmWordEffect;
}

export async function deleteDmWordEffect(effectId: string): Promise<void> {
   const { error } = await supabase
      .from("dm_word_effects")
      .delete()
      .eq("id", effectId);

   if (error) throw error;
}

export async function fetchDmNicknamesForGroups(groupIds: string[]): Promise<DmNicknamesMap> {
   if (groupIds.length === 0) return {};

   const { data, error } = await supabase
      .from("dm_nicknames")
      .select("group_id, target_user_id, nickname, updated_by, updated_at")
      .in("group_id", groupIds);

   if (error) throw error;

   const map: DmNicknamesMap = {};
   for (const row of (data ?? []) as DmNicknameRow[]) {
      if (!map[row.group_id]) map[row.group_id] = {};
      map[row.group_id][row.target_user_id] = row.nickname;
   }
   return map;
}

export async function setDmNickname(
   groupId: string,
   targetUserId: string,
   rawNickname: string,
   updatedBy: string,
): Promise<DmNicknameRow> {
   const nickname = normalizeNickname(rawNickname);
   if (!nickname) {
      throw new Error("Nickname cannot be empty.");
   }

   const { data, error } = await supabase
      .from("dm_nicknames")
      .upsert(
         {
            group_id: groupId,
            target_user_id: targetUserId,
            nickname,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
         },
         { onConflict: "group_id,target_user_id" },
      )
      .select("group_id, target_user_id, nickname, updated_by, updated_at")
      .single();

   if (error) throw error;
   return data as DmNicknameRow;
}

export async function clearDmNickname(
   groupId: string,
   targetUserId: string,
): Promise<void> {
   const { error } = await supabase
      .from("dm_nicknames")
      .delete()
      .eq("group_id", groupId)
      .eq("target_user_id", targetUserId);

   if (error) throw error;
}
