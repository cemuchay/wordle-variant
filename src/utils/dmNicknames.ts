export interface DmNicknameRow {
   group_id: string;
   target_user_id: string;
   nickname: string;
   updated_by: string;
   updated_at: string;
}

/** Map of groupId -> (targetUserId -> nickname) */
export type DmNicknamesMap = Record<string, Record<string, string>>;

export const MAX_DM_NICKNAME_LENGTH = 32;

/**
 * Normalizes a custom DM nickname: trims edges, collapses internal whitespace,
 * and clamps to MAX_DM_NICKNAME_LENGTH.
 */
export function normalizeNickname(raw: string): string {
   return raw.trim().replace(/\s+/g, " ").slice(0, MAX_DM_NICKNAME_LENGTH);
}

/**
 * Resolves the display name for a user inside a specific DM conversation.
 * Falls back to `fallbackUsername` when no custom nickname is set for that DM.
 */
export function resolveDmDisplayName(
   groupId: string | null | undefined,
   userId: string | null | undefined,
   fallbackUsername: string,
   nicknamesByGroup: DmNicknamesMap,
): string {
   if (!groupId || !userId) return fallbackUsername;
   const custom = nicknamesByGroup[groupId]?.[userId];
   if (custom && custom.trim().length > 0) {
      return custom;
   }
   return fallbackUsername;
}
