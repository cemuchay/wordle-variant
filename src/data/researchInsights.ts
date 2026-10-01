/**
 * Research insights and data compiled from official wordlist analysis (research/report_*.md and research/optimal-starters.md).
 * Covers lengths 3 through 10.
 */

// Optimal starters ranked by information entropy per word length from research/optimal-starters.md
export const OPTIMAL_STARTERS_BY_LENGTH: Record<number, string[]> = {
  3: ['EAT', 'MAE', 'TAO', 'TAS', 'EAR', 'TOE', 'RAT', 'TAR', 'TAN', 'RAS'],
  4: ['SALE', 'TEAS', 'SANE', 'TALE', 'LATE', 'RATE', 'EARS', 'LANE', 'SOLE', 'TOES'],
  5: ['RAISE', 'SLATE', 'CRATE', 'TRACE', 'ARISE', 'STARE', 'SNARE', 'AROSE', 'CRANE', 'STALE'],
  6: ['SLATER', 'TRADES', 'SORTED', 'LITRES', 'TRACES', 'SANDER', 'LADIES', 'ARMIES', 'SACRED', 'ROUTES'],
  7: ['PARTIES', 'RETAINS', 'PANTIES', 'PIRATES', 'CENTRES', 'DETAILS', 'MARINES', 'RELATES', 'CANDLES', 'ENTRIES'],
  8: ['CALORIES', 'ARTICLES', 'TRAINEES', 'CURTAINS', 'MATRICES', 'DOCTRINE', 'ARTERIES', 'COUNTIES', 'ROUTINES', 'CREATINE'],
  9: ['CENTURIES', 'PENALTIES', 'SECRETION', 'COUNTRIES', 'REALITIES', 'SELECTION', 'COASTLINE', 'FACTORIES', 'ROYALTIES', 'SOLITAIRE'],
  10: ['CATEGORIES', 'SECURITIES', 'CIGARETTES', 'DECORATING', 'PEDIATRICS', 'RESPECTING', 'DECREASING', 'CONSTRAINT', 'RELOCATING', 'LOCALITIES'],
};

// Top positional letters and their relative weight derived from research reports (report_3.md to report_10.md)
// Format: Record<length, Record<positionIndex, Record<char, frequencyWeight>>>
export const POSITIONAL_LETTER_WEIGHTS: Record<number, Record<number, Record<string, number>>> = {
  3: {
    0: { B: 66, S: 64, T: 49, C: 47, P: 43, M: 41, R: 38, F: 34, D: 32, L: 29 },
    1: { A: 171, O: 133, E: 110, I: 76, U: 67 },
    2: { T: 81, E: 67, N: 61, D: 47, R: 46, Y: 44, P: 36, S: 31, M: 26, G: 24 },
  },
  4: {
    0: { S: 213, B: 138, C: 124, P: 118, T: 104, M: 99, F: 88, R: 85, D: 84, L: 72 },
    1: { A: 325, O: 297, E: 279, I: 226, U: 153, R: 60, L: 43 },
    2: { R: 187, L: 147, N: 146, T: 117, S: 109, A: 96, E: 88, M: 74, C: 73, D: 70 },
    3: { E: 379, S: 228, T: 148, D: 126, Y: 116, R: 80, N: 79, K: 76, P: 58, L: 52 },
  },
  5: {
    0: { S: 366, C: 198, B: 173, T: 149, P: 142, A: 141, F: 136, G: 115, D: 111, M: 107, R: 105, L: 88 },
    1: { A: 304, O: 279, R: 267, E: 242, I: 202, L: 201, U: 186, H: 144 },
    2: { A: 307, I: 266, O: 244, E: 177, U: 165, R: 163, N: 139, L: 112, T: 111, S: 80 },
    3: { E: 318, N: 182, S: 171, A: 163, L: 162, I: 158, R: 152, T: 139, C: 133, O: 132 },
    4: { E: 424, Y: 364, T: 253, R: 212, L: 156, D: 118, N: 118, H: 115, S: 105, A: 64 },
  },
  6: {
    0: { S: 312, C: 200, B: 178, P: 167, R: 149, D: 146, M: 144, T: 138, F: 136, A: 122 },
    1: { A: 387, E: 350, O: 327, I: 243, R: 195, L: 184, U: 174, H: 86 },
    2: { R: 263, A: 225, N: 186, I: 156, T: 155, L: 154, E: 149, O: 135, C: 125, S: 116 },
    3: { I: 318, E: 239, T: 191, A: 167, L: 137, N: 132, R: 131, O: 128, S: 127, U: 110 },
    4: { E: 739, N: 211, L: 186, R: 164, O: 139, I: 121, A: 117, T: 106, D: 84 },
    5: { S: 534, E: 307, D: 290, R: 282, T: 226, Y: 220, N: 119, L: 93 },
  },
  7: {
    0: { S: 325, C: 255, P: 206, D: 193, R: 169, B: 146, T: 144, M: 133, A: 126, F: 118 },
    1: { O: 388, A: 387, E: 363, I: 265, R: 202, U: 194, L: 169 },
    2: { R: 334, N: 246, A: 218, L: 186, C: 177, T: 162, S: 155, E: 146, I: 133, O: 110 },
    3: { T: 279, I: 264, A: 262, E: 240, R: 182, O: 164, L: 146, N: 142, S: 127, U: 120 },
    4: { I: 377, A: 289, E: 272, N: 220, R: 205, O: 181, T: 144, L: 139, S: 128 },
    5: { E: 760, N: 295, R: 202, L: 172, O: 128, I: 121, T: 115, D: 102 },
    6: { S: 704, D: 323, R: 266, E: 236, T: 218, Y: 186, N: 109 },
  },
  8: {
    0: { C: 266, S: 257, P: 217, D: 184, R: 161, M: 135, T: 130, B: 129, A: 116, F: 98 },
    1: { O: 395, A: 382, E: 360, I: 232, R: 180, U: 151, L: 141 },
    2: { R: 301, N: 257, A: 216, L: 189, C: 177, S: 157, T: 146, E: 138, O: 126, I: 110 },
    3: { T: 287, A: 257, E: 248, I: 241, R: 194, O: 161, L: 133, N: 131, S: 118, U: 99 },
    4: { I: 345, A: 291, E: 266, N: 211, T: 189, R: 184, O: 171, L: 133, S: 118 },
    5: { O: 327, I: 288, E: 261, A: 222, N: 216, R: 188, T: 149, L: 134 },
    6: { E: 692, N: 278, R: 194, L: 162, T: 117, O: 108, I: 99 },
    7: { S: 792, D: 310, R: 241, E: 198, T: 189, Y: 142 },
  },
  9: {
    0: { C: 235, S: 219, P: 188, D: 162, R: 141, M: 116, T: 112, B: 104, A: 96, F: 82 },
    1: { O: 326, A: 314, E: 298, I: 192, R: 148, U: 124, L: 116 },
    2: { R: 248, N: 212, A: 178, L: 156, C: 146, S: 129, T: 120, E: 114, O: 104, I: 91 },
    3: { T: 236, A: 211, E: 204, I: 198, R: 160, O: 133, L: 110, N: 108, S: 97, U: 81 },
    4: { I: 284, A: 239, E: 219, N: 174, T: 155, R: 151, O: 141, L: 110, S: 97 },
    5: { O: 269, I: 237, E: 215, A: 183, N: 178, R: 155, T: 123, L: 110 },
    6: { I: 294, A: 231, E: 208, T: 166, O: 148, N: 140, R: 128 },
    7: { E: 570, N: 229, R: 160, L: 133, T: 96, O: 89 },
    8: { S: 651, D: 255, R: 198, E: 163, T: 155, Y: 117 },
  },
  10: {
    0: { C: 176, S: 164, P: 141, D: 122, R: 106, M: 87, T: 84, B: 78, A: 72, F: 62 },
    1: { O: 245, A: 236, E: 224, I: 144, R: 111, U: 93, L: 87 },
    2: { R: 186, N: 159, A: 134, L: 117, C: 110, S: 97, T: 90, E: 86, O: 78, I: 68 },
    3: { T: 177, A: 158, E: 153, I: 149, R: 120, O: 100, L: 83, N: 81, S: 73, U: 61 },
    4: { I: 213, A: 179, E: 164, N: 131, T: 116, R: 113, O: 106, L: 83, S: 73 },
    5: { O: 202, I: 178, E: 161, A: 137, N: 134, R: 116, T: 92, L: 83 },
    6: { I: 221, A: 173, E: 156, T: 125, O: 111, N: 105, R: 96 },
    7: { A: 218, E: 194, I: 186, T: 144, N: 126, O: 109, R: 92 },
    8: { E: 428, N: 172, R: 120, L: 100, T: 72, O: 67 },
    9: { S: 489, D: 191, R: 149, E: 122, T: 116, Y: 88 },
  },
};

/**
 * Gets the research-backed optimal starter for a given word length.
 */
export function getCuratedOptimalStarter(wordLength: number, candidatePool: string[] = []): string {
  const starters = OPTIMAL_STARTERS_BY_LENGTH[wordLength];
  if (starters && starters.length > 0) {
    if (candidatePool.length > 0) {
      const match = starters.find((w) => candidatePool.includes(w));
      if (match) return match;
    }
    return starters[0];
  }
  return candidatePool[0] || 'CRANE';
}

/**
 * Gets positional letter frequency weight.
 */
export function getPositionalWeight(char: string, pos: number, length: number): number {
  const lengthWeights = POSITIONAL_LETTER_WEIGHTS[length];
  if (!lengthWeights) return 1;
  const posWeights = lengthWeights[pos];
  if (!posWeights) return 1;
  return posWeights[char.toUpperCase()] || 0;
}

/**
 * Calculates elimination score and entropy partition value for any word
 * relative to a set of remaining candidate words.
 */
export function calculateWordEliminationScore(
  word: string,
  remainingCandidates: string[],
  wordLength: number,
  isCandidate: boolean
): {
  totalScore: number;
  strategicScore: number;
  testedDistinguishingLetters: string[];
  testedCount: number;
  positionalBonus: number;
} {
  const numCandidates = remainingCandidates.length;
  if (numCandidates <= 1) {
    return {
      totalScore: 100,
      strategicScore: 100,
      testedDistinguishingLetters: [],
      testedCount: 0,
      positionalBonus: 0,
    };
  }

  // Count occurrences of each letter across the remaining candidate words
  const candidateLetterCounts = new Map<string, number>();
  remainingCandidates.forEach((cand) => {
    const uniqueInWord = new Set(cand.split(''));
    uniqueInWord.forEach((ch) => {
      candidateLetterCounts.set(ch, (candidateLetterCounts.get(ch) || 0) + 1);
    });
  });

  const wordUniqueChars = new Set(word.split(''));
  let strategicScore = 0;
  const testedDistinguishingLetters: string[] = [];

  candidateLetterCounts.forEach((count, char) => {
    // Distinguishing letter: present in some, but NOT all candidates
    if (count > 0 && count < numCandidates) {
      if (wordUniqueChars.has(char)) {
        // Information theory entropy partition efficiency: count * (N - count)
        // Highest when a letter cuts the remaining pool in half (~50%)
        const partitionGain = count * (numCandidates - count);
        strategicScore += partitionGain;
        testedDistinguishingLetters.push(`${char} (x${count})`);
      }
    }
  });

  // Calculate positional score using empirical research weights
  let positionalBonus = 0;
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const weight = getPositionalWeight(char, i, wordLength);
    positionalBonus += weight * 0.05;
  }

  // Direct candidate solve bonus: high value when pool is small (<= 4)
  let candidateBonus = 0;
  if (isCandidate) {
    if (numCandidates <= 2) candidateBonus = 200;
    else if (numCandidates <= 4) candidateBonus = 75;
    else if (numCandidates <= 10) candidateBonus = 25;
    else candidateBonus = 10;
  }

  const testedCount = testedDistinguishingLetters.length;
  // Combine strategic partition entropy + candidate win equity + positional research weight + unique letter variety
  const totalScore = strategicScore + candidateBonus + positionalBonus + wordUniqueChars.size * 2;

  return {
    totalScore,
    strategicScore,
    testedDistinguishingLetters,
    testedCount,
    positionalBonus,
  };
}
