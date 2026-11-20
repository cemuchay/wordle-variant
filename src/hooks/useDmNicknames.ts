import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { safeLocalStorage } from "../utils/storage";
import {
   normalizeNickname,
   type DmNicknameRow,
   type DmNicknamesMap,
} from "../utils/dmNicknames";
import {
   clearDmNickname,
   fetchDmNicknamesForGroups,
   setDmNickname,
} from "../services/dmCustomizationService";

const cacheKey = (userId: string) => `dm_nicknames_${userId}`;

const readCachedNicknames = (userId?: string): DmNicknamesMap => {
   if (!userId) return {};
   try {
      const raw = safeLocalStorage.getItem(cacheKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as DmNicknamesMap) : {};
   } catch {
      return {};
   }
};

const writeCachedNicknames = (userId: string | undefined, map: DmNicknamesMap) => {
   if (!userId) return;
   try {
      safeLocalStorage.setItem(cacheKey(userId), JSON.stringify(map));
   } catch {
      // Ignore storage quota errors
   }
};

export function useDmNicknames(userId: string | undefined, dmGroupIds: string[]) {
   const [nicknamesByGroup, setNicknamesByGroup] = useState<DmNicknamesMap>(() =>
      readCachedNicknames(userId),
   );

   const groupIdsKey = useMemo(
      () => [...dmGroupIds].sort().join(","),
      [dmGroupIds],
   );

   useEffect(() => {
      if (!userId || !groupIdsKey) return;
      const ids = groupIdsKey.split(",").filter(Boolean);
      const idSet = new Set(ids);
      let cancelled = false;

      void fetchDmNicknamesForGroups(ids)
         .then((map) => {
            if (cancelled) return;
            setNicknamesByGroup(map);
            writeCachedNicknames(userId, map);
         })
         .catch((err) => {
            console.warn("Failed to fetch DM nicknames:", err);
         });

      const channel = supabase
         .channel(`dm-nicknames-${userId}`)
         .on(
            "postgres_changes",
            {
               event: "*",
               schema: "public",
               table: "dm_nicknames",
            },
            (payload) => {
               const row = (payload.new || payload.old) as Partial<DmNicknameRow> | undefined;
               if (!row?.group_id || !idSet.has(row.group_id)) return;

               setNicknamesByGroup((prev) => {
                  const groupId = row.group_id!;
                  const targetUserId = row.target_user_id;
                  if (!targetUserId) return prev;

                  const nextGroup = { ...(prev[groupId] ?? {}) };
                  if (payload.eventType === "DELETE" || !row.nickname) {
                     delete nextGroup[targetUserId];
                  } else {
                     nextGroup[targetUserId] = row.nickname;
                  }

                  const next: DmNicknamesMap = { ...prev, [groupId]: nextGroup };
                  writeCachedNicknames(userId, next);
                  return next;
               });
            },
         )
         .subscribe();

      return () => {
         cancelled = true;
         void supabase.removeChannel(channel);
      };
   }, [userId, groupIdsKey]);

   const saveNickname = useCallback(
      async (groupId: string, targetUserId: string, rawNickname: string) => {
         if (!userId) return;
         const cleaned = normalizeNickname(rawNickname);
         if (!cleaned) {
            await clearDmNickname(groupId, targetUserId);
            setNicknamesByGroup((prev) => {
               const nextGroup = { ...(prev[groupId] ?? {}) };
               delete nextGroup[targetUserId];
               const next = { ...prev, [groupId]: nextGroup };
               writeCachedNicknames(userId, next);
               return next;
            });
            return;
         }

         const saved = await setDmNickname(groupId, targetUserId, cleaned, userId);
         setNicknamesByGroup((prev) => {
            const nextGroup = {
               ...(prev[groupId] ?? {}),
               [targetUserId]: saved.nickname,
            };
            const next = { ...prev, [groupId]: nextGroup };
            writeCachedNicknames(userId, next);
            return next;
         });
      },
      [userId],
   );

   const removeNickname = useCallback(
      async (groupId: string, targetUserId: string) => {
         if (!userId) return;
         await clearDmNickname(groupId, targetUserId);
         setNicknamesByGroup((prev) => {
            const nextGroup = { ...(prev[groupId] ?? {}) };
            delete nextGroup[targetUserId];
            const next = { ...prev, [groupId]: nextGroup };
            writeCachedNicknames(userId, next);
            return next;
         });
      },
      [userId],
   );

   return {
      nicknamesByGroup,
      saveNickname,
      removeNickname,
   };
}
