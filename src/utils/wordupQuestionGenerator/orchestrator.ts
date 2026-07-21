import type { WordUpQuestion } from "./types";
import { generateMathQuestion } from "./generators/math";
import { generateOddOneOutQuestion } from "./generators/oddOneOut";
import {
   generateRealFake,
   generateLengthQuestion,
   generateMissingLetter,
   generateReverseWordle,
   generateDefinitionQuestion,
   generateAnagram,
   generateAnagramScrambled,
   generatePatternQuestion,
   generateVowelDrop,
   generateRhymeMatch,
   generateLetterCount,
   generateWordLadder,
   generateSynonymMatch,
   generateWordChain,
   generateLetterShift,
   generateCompoundBreak,
   generateWordWithin,
   generateCryptogram,
   generateCategorySort,
   generateLetterAddRemove,
} from "./generators/newTypes";

const ALLOWED_LENGTHS_DEFAULT = [3, 4, 5, 6, 7, 8, 9, 10];

const resolveAllowedLengths = (category: string): number[] => {
   switch (category) {
      case "3_letters": return [3];
      case "4_letters": return [4];
      case "5_letters": return [5];
      case "6_letters": return [6];
      case "7_plus": return [7, 8, 9, 10];
      default: return ALLOWED_LENGTHS_DEFAULT;
   }
};

const getTypeByWeight = (
   isSpecificType: boolean,
   category: string,
): WordUpQuestion["type"] => {
   if (isSpecificType) {
      return category as WordUpQuestion["type"];
   }
   const typeWeights: { type: WordUpQuestion["type"]; weight: number }[] = [
      { type: "anagram", weight: 0.6 },
      { type: "anagram_scrambled", weight: 0.5 },
      { type: "real_fake", weight: 0.9 },
      { type: "pattern", weight: 0.9 },
      { type: "length", weight: 1.0 },
      { type: "missing_letter", weight: 1.0 },
      { type: "reverse_wordle", weight: 0.2 },
      { type: "definition", weight: 1.0 },
      { type: "math", weight: 0 },
      { type: "odd_one_out", weight: 0.8 },
      { type: "vowel_drop", weight: 0.8 },
      { type: "rhyme_match", weight: 0.8 },
      { type: "letter_count", weight: 0.5 },
      { type: "word_ladder", weight: 0.8 },
      { type: "synonym_match", weight: 0.8 },
      { type: "word_chain", weight: 0.8 },
      { type: "letter_shift", weight: 0 },
      { type: "compound_break", weight: 0.7 },
      { type: "word_within", weight: 0.5 },
      { type: "cryptogram", weight: 0.7 },
      { type: "category_sort", weight: 0.3 },
      { type: "letter_add_remove", weight: 0.7 },
   ];
   const totalWeight = typeWeights.reduce((sum, item) => sum + item.weight, 0);
   let randomVal = Math.random() * totalWeight;
   for (const item of typeWeights) {
      if (randomVal < item.weight) return item.type;
      randomVal -= item.weight;
   }
   return "anagram";
};

const TYPE_GENERATORS: Record<
   string,
   (allowedLengths: number[]) => WordUpQuestion | Promise<WordUpQuestion>
> = {
   real_fake: (a) => generateRealFake(a),
   length: (a) => generateLengthQuestion(a),
   missing_letter: (a) => generateMissingLetter(a),
   reverse_wordle: (a) => generateReverseWordle(a),
   definition: () => generateDefinitionQuestion(),
   anagram: (a) => generateAnagram(a),
   anagram_scrambled: (a) => generateAnagramScrambled(a),
   pattern: (a) => generatePatternQuestion(a),
   math: () => generateMathQuestion(),
   odd_one_out: (a) => generateOddOneOutQuestion(a),
   vowel_drop: (a) => generateVowelDrop(a),
   rhyme_match: (a) => generateRhymeMatch(a),
   letter_count: (a) => generateLetterCount(a),
   word_ladder: (a) => generateWordLadder(a),
   synonym_match: () => generateSynonymMatch(),
   word_chain: (a) => generateWordChain(a),
   letter_shift: (a) => generateLetterShift(a),
   compound_break: () => generateCompoundBreak(),
   word_within: (a) => generateWordWithin(a),
   cryptogram: (a) => generateCryptogram(a),
   category_sort: () => generateCategorySort(),
   letter_add_remove: (a) => generateLetterAddRemove(a),
};

const shuffleChoices = (q: WordUpQuestion): WordUpQuestion => ({
   ...q,
   choices: [...q.choices].sort(() => Math.random() - 0.5),
});

export const generateWordUpQuestions = async (
   category: string,
   count: number = 7,
): Promise<WordUpQuestion[]> => {
   const specificTypes: WordUpQuestion["type"][] = [
      "real_fake", "length", "missing_letter", "reverse_wordle",
      "definition", "anagram", "anagram_scrambled", "pattern",
      "math", "odd_one_out", "vowel_drop", "rhyme_match",
      "letter_count", "word_ladder", "synonym_match", "word_chain",
      "letter_shift", "compound_break", "word_within", "cryptogram",
      "category_sort", "letter_add_remove",
   ];
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const isSpecificType = specificTypes.includes(category as any);
   const allowedLengths = resolveAllowedLengths(category);

   const questions: WordUpQuestion[] = [];

   for (let i = 0; i < count; i++) {
      let type: WordUpQuestion["type"];
      let attempts = 0;
      do {
         type = getTypeByWeight(isSpecificType, category);
         attempts++;
      } while (i > 0 && type === questions[i - 1].type && attempts < 10);

      const generator = TYPE_GENERATORS[type];
      if (!generator) continue;

      const question = await generator(allowedLengths);
      questions.push(shuffleChoices(question));
   }

   return questions;
};
