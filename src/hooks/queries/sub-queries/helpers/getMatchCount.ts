/**
 * Helper to count yellow + green matches between a starter word and a target word.
 */
export default function getMatchCount(starter: string, target: string): number {
   const s = starter.toUpperCase().split("");
   const t = target.toUpperCase().split("");
   let matches = 0;

   // First pass: correct matches (green)
   s.forEach((char, i) => {
      if (char === t[i]) {
         matches++;
         s[i] = "_";
         t[i] = "_";
      }
   });

   // Second pass: present matches (yellow)
   s.forEach((char) => {
      if (char !== "_") {
         const idx = t.indexOf(char);
         if (idx !== -1) {
            matches++;
            t[idx] = "_";
         }
      }
   });

   return matches;
}
