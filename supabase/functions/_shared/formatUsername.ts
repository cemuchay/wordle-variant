export default function formatUsername(username?: string | null): string {
   if (!username?.trim()) return "";

   const parts = username.trim().split(/\s+/);

   return parts.length >= 2 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0];
}
