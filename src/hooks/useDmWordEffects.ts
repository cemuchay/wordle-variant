import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { safeLocalStorage } from "../utils/storage";
import type { DmWordEffect } from "../utils/wordEffects";
import {
   deleteDmWordEffect,
   fetchDmWordEffects,
   upsertDmWordEffect,
} from "../services/dmCustomizationService";

const cacheKey = (groupId: string) => `dm_word_effects_${groupId}`;

const readCachedEffects = (groupId: string): DmWordEffect[] => {
   try {
      const raw = safeLocalStorage.getItem(cacheKey(groupId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
   } catch {
      return [];
   }
};

const writeCachedEffects = (groupId: string, effects: DmWordEffect[]) => {
   try {
      safeLocalStorage.setItem(cacheKey(groupId), JSON.stringify(effects));
   } catch {
      // Ignore storage quota errors
   }
};

export function useDmWordEffects(
   groupId: string | null,
   isDM: boolean,
   userId?: string,
) {
   const [effectsByGroup, setEffectsByGroup] = useState<Record<string, DmWordEffect[]>>({});
   const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null);

   const activeGroupId = isDM && groupId ? groupId : null;
   const effects: DmWordEffect[] = activeGroupId
      ? (effectsByGroup[activeGroupId] ?? readCachedEffects(activeGroupId))
      : [];
   const isLoading = Boolean(activeGroupId && loadingGroupId === activeGroupId);

   useEffect(() => {
      if (!activeGroupId) return;
      let cancelled = false;

      const load = async () => {
         setLoadingGroupId(activeGroupId);
         try {
            const rows = await fetchDmWordEffects(activeGroupId);
            if (cancelled) return;
            setEffectsByGroup((prev) => ({ ...prev, [activeGroupId]: rows }));
            writeCachedEffects(activeGroupId, rows);
         } catch (err) {
            console.warn("Failed to fetch DM word effects:", err);
         } finally {
            if (!cancelled) {
               setLoadingGroupId((curr) => (curr === activeGroupId ? null : curr));
            }
         }
      };

      void load();

      const channel = supabase
         .channel(`dm-word-effects-${activeGroupId}`)
         .on(
            "postgres_changes",
            {
               event: "*",
               schema: "public",
               table: "dm_word_effects",
               filter: `group_id=eq.${activeGroupId}`,
            },
            () => {
               void fetchDmWordEffects(activeGroupId)
                  .then((rows) => {
                     if (cancelled) return;
                     setEffectsByGroup((prev) => ({ ...prev, [activeGroupId]: rows }));
                     writeCachedEffects(activeGroupId, rows);
                  })
                  .catch(() => { /* ignore transient realtime refresh errors */ });
            },
         )
         .subscribe();

      return () => {
         cancelled = true;
         void supabase.removeChannel(channel);
      };
   }, [activeGroupId]);

   const addEffect = useCallback(
      async (triggerWord: string, emoji: string): Promise<DmWordEffect> => {
         if (!activeGroupId || !userId) {
            throw new Error("Word effects are only available in DM conversations.");
         }
         const currentList = effectsByGroup[activeGroupId] ?? readCachedEffects(activeGroupId);
         const saved = await upsertDmWordEffect(
            activeGroupId,
            triggerWord,
            emoji,
            userId,
            currentList.length,
         );
         setEffectsByGroup((prev) => {
            const list = prev[activeGroupId] ?? readCachedEffects(activeGroupId);
            const filtered = list.filter((e) => e.id !== saved.id);
            const next = [saved, ...filtered];
            writeCachedEffects(activeGroupId, next);
            return { ...prev, [activeGroupId]: next };
         });
         return saved;
      },
      [activeGroupId, userId, effectsByGroup],
   );

   const removeEffect = useCallback(
      async (effectId: string): Promise<void> => {
         if (!activeGroupId) return;
         await deleteDmWordEffect(effectId);
         setEffectsByGroup((prev) => {
            const list = prev[activeGroupId] ?? readCachedEffects(activeGroupId);
            const next = list.filter((e) => e.id !== effectId);
            writeCachedEffects(activeGroupId, next);
            return { ...prev, [activeGroupId]: next };
         });
      },
      [activeGroupId],
   );

   return {
      effects,
      isLoading,
      addEffect,
      removeEffect,
   };
}
