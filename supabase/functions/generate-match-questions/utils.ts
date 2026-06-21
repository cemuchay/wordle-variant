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
