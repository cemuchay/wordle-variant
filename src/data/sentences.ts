export interface CuratedSentence {
   id: string;
   words: string[];
}

export const CURATED_SENTENCES: CuratedSentence[] = [
   // 3-word sentences
   { id: "3_1", words: ["THE", "CAT", "SLEEPS"] },
   { id: "3_2", words: ["DOGS", "LOVE", "BONES"] },
   { id: "3_3", words: ["YOU", "WIN", "GAMES"] },
   { id: "3_4", words: ["RAIN", "FALLS", "DOWN"] },

   // 4-word sentences
   { id: "4_1", words: ["THE", "WIND", "BLOWS", "COLD"] },
   { id: "4_2", words: ["MANY", "BIRDS", "CAN", "FLY"] },
   { id: "4_3", words: ["WILD", "BEARS", "EAT", "FISH"] },
   { id: "4_4", words: ["SOME", "FROGS", "ARE", "GREEN"] },

   // 5-word sentences
   { id: "5_1", words: ["HAPPY", "KIDS", "PLAY", "WITH", "TOYS"] },
   { id: "5_2", words: ["THIS", "GREAT", "GAME", "FEELS", "FUN"] },
   { id: "5_3", words: ["SHE", "WRITES", "POEMS", "EVERY", "NIGHT"] },
   { id: "5_4", words: ["FRESH", "WATER", "FLOWS", "FROM", "HILLS"] },

   // 6-word sentences
   { id: "6_1", words: ["YOU", "CAN", "PLAY", "THIS", "GREAT", "GAME"] },
   { id: "6_2", words: ["LIGHT", "SHINES", "THROUGH", "THE", "DARK", "CLOUDS"] },
   { id: "6_3", words: ["YOUNG", "BOYS", "RIDE", "FAST", "RED", "BIKES"] },

   // 7-word sentences
   { id: "7_1", words: ["QUICK", "BROWN", "FOX", "JUMPS", "OVER", "LAZY", "DOG"] },
   { id: "7_2", words: ["THEY", "BUILT", "NEW", "HOMES", "NEAR", "THE", "RIVER"] },
   { id: "7_3", words: ["SMALL", "CHILDREN", "LAUGH", "WHILE", "PLAYING", "IN", "SAND"] }, // wait, "IN" is 2 letters!
   { id: "7_3_fixed", words: ["SMALL", "CHILDREN", "LAUGH", "WHILE", "PLAYING", "OUT", "DOORS"] }, // 3l "OUT", 5l "DOORS"

   // 8-word sentences
   { id: "8_1", words: ["STRONG", "WINDS", "MAKE", "TALL", "TREES", "BEND", "VERY", "LOW"] },
   { id: "8_2", words: ["TEACHERS", "GUIDE", "THEIR", "STUDENTS", "TOWARD", "BRIGHT", "NEW", "PATHS"] },

   // 9-word sentences
   { id: "9_1", words: ["THREE", "SMALL", "FISH", "SWIM", "UNDER", "THE", "DEEP", "BLUE", "LAKE"] },
   { id: "9_2", words: ["EVERY", "MORNING", "THE", "OLD", "MAN", "WALKS", "HIS", "LOYAL", "DOG"] },

   // 10-word sentences
   { id: "10_1", words: ["SEVEN", "SMART", "PUPILS", "WRITE", "SHORT", "WORDS", "FOR", "THEIR", "DAILY", "CLASS"] },
   { id: "10_2", words: ["COLD", "WINTER", "SNOW", "COVERS", "THE", "ENTIRE", "FOREST", "WITH", "WHITE", "SHEETS"] }
];

export function getRandomCuratedSentence(wordCount: number): CuratedSentence | null {
   const candidates = CURATED_SENTENCES.filter(s => s.words.length === wordCount);
   if (candidates.length === 0) return null;
   return candidates[Math.floor(Math.random() * candidates.length)];
}
