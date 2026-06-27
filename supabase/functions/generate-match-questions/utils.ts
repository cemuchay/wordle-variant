export function createSeededRandom(seed: number): () => number {
   let s = seed;
   return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967296;
   };
}

export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
   const result = [...arr];
   for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
   }
   return result;
}

export function hashSeed(str: string): number {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
   }
   return Math.abs(hash);
}

export function smartFakeAnswers(correct: number, rng: () => number): number[] {
   const candidates = [
      correct + 1, correct - 1, correct + 2, correct - 2,
      correct + 5, correct - 5, correct + 10, correct - 10,
      Math.floor(correct * 0.9), Math.ceil(correct * 1.1),
   ].filter((x) => x >= 0 && x !== correct);
   return [...new Set(candidates)].sort(() => rng() - 0.5).slice(0, 3);
}

export function isNumeric(str: string): boolean {
   const cleanStr = str.replace(/[$,%\s]/g, "").replace(/,/g, "");
   if (!cleanStr) return false;
   return !isNaN(Number(cleanStr));
}

export function getNumericDistractors(correctValueStr: string, rng: () => number): string[] {
   const cleanStr = correctValueStr.replace(/[$,%\s]/g, "").replace(/,/g, "");
   const correct = parseFloat(cleanStr);
   if (isNaN(correct)) return [];

   const hasPercent = correctValueStr.includes("%");
   const hasDollar = correctValueStr.includes("$");
   const formatVal = (val: number) => {
      let s = String(val);
      if (hasPercent) s += "%";
      if (hasDollar) s = "$" + s;
      return s;
   };

   const isYear = Number.isInteger(correct) && correct >= 1000 && correct <= 2100 && !hasPercent && !hasDollar;

   const candidates: number[] = [];
   if (isYear) {
      const offsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25];
      for (const offset of offsets) {
         candidates.push(correct + offset);
      }
   } else {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(correct) || 1)));
      const offsets = [
         magnitude, -magnitude,
         magnitude * 0.5, -magnitude * 0.5,
         magnitude * 0.2, -magnitude * 0.2,
         magnitude * 0.1, -magnitude * 0.1,
         magnitude * 0.05, -magnitude * 0.05,
      ];
      for (const offset of offsets) {
         candidates.push(correct + offset);
         candidates.push(correct - offset);
      }
      candidates.push(correct * 0.9);
      candidates.push(correct * 1.1);
      candidates.push(correct * 0.8);
      candidates.push(correct * 1.2);
   }

   const uniqueCandidates = [...new Set(candidates)]
      .map((x) => {
         if (Number.isInteger(correct)) {
            return Math.round(x);
         }
         return parseFloat(x.toFixed(2));
      })
      .filter((x) => x !== correct && x >= 0)
      .map(formatVal);

   return seededShuffle(uniqueCandidates, rng);
}

export function getBelievableMisspelling(word: string, rng: () => number): string {
   if (word.length < 4) return word;
   const chars = word.split("");
   const strategy = Math.floor(rng() * 4);

   if (strategy === 0) {
      // 1. Swap two adjacent characters (avoiding first and last if possible)
      const idx = 1 + Math.floor(rng() * Math.max(1, chars.length - 3));
      const tmp = chars[idx];
      chars[idx] = chars[idx + 1];
      chars[idx + 1] = tmp;
      return chars.join("");
   } else if (strategy === 1) {
      // 2. Double a consonant
      const consonants = "bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ";
      const indices: number[] = [];
      for (let i = 0; i < chars.length; i++) {
         if (consonants.includes(chars[i])) indices.push(i);
      }
      if (indices.length > 0) {
         const idx = indices[Math.floor(rng() * indices.length)];
         chars.splice(idx, 0, chars[idx]);
         return chars.join("");
      }
   } else if (strategy === 2) {
      // 3. Remove one double letter (e.g. ll -> l, tt -> t)
      for (let i = 0; i < chars.length - 1; i++) {
         if (chars[i] === chars[i + 1]) {
            chars.splice(i, 1);
            return chars.join("");
         }
      }
   }
   
   // 4. Vowel swap (e.g., e -> a, a -> e, i -> y, o -> u)
   const vowelMap: Record<string, string> = {
      a: "e", e: "a", i: "y", o: "u", u: "o",
      A: "E", E: "A", I: "Y", O: "U", U: "O"
   };
   const vowelIndices: number[] = [];
   for (let i = 0; i < chars.length; i++) {
      if (vowelMap[chars[i]]) vowelIndices.push(i);
   }
   if (vowelIndices.length > 0) {
      const idx = vowelIndices[Math.floor(rng() * vowelIndices.length)];
      chars[idx] = vowelMap[chars[idx]];
      return chars.join("");
   }

   return word;
}
