export default function formatUsername(username?: string | null): string {
   if (!username?.trim()) return "";

   const parts = username.trim().split(/\s+/);

   if (parts.length >= 2) {
      const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const secondInitial = parts[1].charAt(0).toUpperCase();
      return `${first} ${secondInitial}.`;
   } else {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
   }
}
