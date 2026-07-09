// -------------------------------------------------------------
// 4. Mutation Helper (for Question Type 1: Real/Fake)
// -------------------------------------------------------------
const vowels = ["A", "E", "I", "O", "U"];
const consonants = [
   "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
   "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
];

export const mutateToFakeWord = (word: string, validSet: Set<string>): string => {
   const wordChars = word.split("");

   for (let attempt = 0; attempt < 50; attempt++) {
      const idx = Math.floor(Math.random() * wordChars.length);
      const originalChar = wordChars[idx];
      const pool = vowels.includes(originalChar) ? vowels : consonants;
      const filteredPool = pool.filter((c) => c !== originalChar);
      const replacement =
         filteredPool[Math.floor(Math.random() * filteredPool.length)];

      const copy = [...wordChars];
      copy[idx] = replacement;
      const candidate = copy.join("");

      if (!validSet.has(candidate)) {
         return candidate;
      }
   }

   return word + "R"; // fallback fake suffix
};
