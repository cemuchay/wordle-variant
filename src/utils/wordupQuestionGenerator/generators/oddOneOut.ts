import { loadWordLists } from "../../../data/words";
import type { WordUpQuestion } from "../types";
import { mutateToFakeWord } from "../mutateWord";
import { rand, shuffle } from "./math";

export const generateOddOneOutQuestion = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
   const { official, valid } = await loadWordLists(length);

   const randomWord = (lists: { official: string[] }) =>
      lists.official[Math.floor(Math.random() * lists.official.length)];

   const subType = rand(0, 3);

   if (subType === 0) {
      const choicesSet = new Set<string>();
      while (choicesSet.size < 3) {
         choicesSet.add(randomWord({ official }));
      }

      let fake = "";
      let attempts = 0;
      while (attempts < 50) {
         const baseWord = randomWord({ official });
         const candidate = mutateToFakeWord(baseWord, valid);
         if (!choicesSet.has(candidate)) {
            fake = candidate;
            break;
         }
         attempts++;
      }
      if (!fake) fake = "WURD";

      choicesSet.add(fake);
      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: "ALL OF THESE ARE VALID WORDS EXCEPT:",
         choices,
         answer: fake,
         explanation: `"${fake}" is not a real word — it was created by altering a real word.`,
      };
   } else if (subType === 1) {
      const choicesSet = new Set<string>();
      while (choicesSet.size < 3) {
         choicesSet.add(randomWord({ official }));
      }

      let wrongOption = "";
      const useDifferentLength = Math.random() > 0.5;
      if (useDifferentLength) {
         const allOtherLengths = [3, 4, 5, 6, 7, 8, 9, 10].filter((len) => len !== length);
         const diffLen = allOtherLengths[Math.floor(Math.random() * allOtherLengths.length)];
         const diffList = await loadWordLists(diffLen);
         wrongOption = diffList.official[Math.floor(Math.random() * diffList.official.length)];
      } else {
         let attempts = 0;
         while (attempts < 50) {
            const baseWord = randomWord({ official });
            const candidate = mutateToFakeWord(baseWord, valid);
            if (!choicesSet.has(candidate)) {
               wrongOption = candidate;
               break;
            }
            attempts++;
         }
         if (!wrongOption) wrongOption = "Z" + "Z".repeat(length - 1);
      }

      choicesSet.add(wrongOption);
      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: `ALL OF THESE ARE VALID ${length}-LETTER WORDS EXCEPT:`,
         choices,
         answer: wrongOption,
         explanation: `"${wrongOption}" does not belong — it is not a valid ${length}-letter word.`,
      };
   } else if (subType === 2) {
      const realWord = randomWord({ official });
      const choicesSet = new Set<string>();
      choicesSet.add(realWord);

      let attempts = 0;
      while (choicesSet.size < 4 && attempts < 100) {
         const baseWord = randomWord({ official });
         const fakeCandidate = mutateToFakeWord(baseWord, valid);
         choicesSet.add(fakeCandidate);
         attempts++;
      }
      while (choicesSet.size < 4) {
         choicesSet.add("X" + "X".repeat(length - 1) + choicesSet.size);
      }

      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: "WHICH OF THE FOLLOWING IS A VALID WORD?",
         choices,
         answer: realWord,
         explanation: `"${realWord}" is the only real English word among the options.`,
      };
   } else {
      const realWord = randomWord({ official });
      const choicesSet = new Set<string>();
      choicesSet.add(realWord);

      const useDifferentLength = Math.random() > 0.5;
      if (useDifferentLength) {
         let attempts = 0;
         while (choicesSet.size < 4 && attempts < 100) {
            const allOtherLengths = [3, 4, 5, 6, 7, 8, 9, 10].filter((len) => len !== length);
            const diffLen = allOtherLengths[Math.floor(Math.random() * allOtherLengths.length)];
            const diffList = await loadWordLists(diffLen);
            const diffWord = diffList.official[Math.floor(Math.random() * diffList.official.length)];
            choicesSet.add(diffWord);
            attempts++;
         }
      } else {
         let attempts = 0;
         while (choicesSet.size < 4 && attempts < 100) {
            const baseWord = randomWord({ official });
            const fakeCandidate = mutateToFakeWord(baseWord, valid);
            choicesSet.add(fakeCandidate);
            attempts++;
         }
      }
      while (choicesSet.size < 4) {
         choicesSet.add("Q" + "Q".repeat(length - 1) + choicesSet.size);
      }

      const choices = shuffle(Array.from(choicesSet));

      return {
         type: "odd_one_out",
         prompt: `WHICH OF THE FOLLOWING IS A VALID ${length}-LETTER WORD?`,
         choices,
         answer: realWord,
         explanation: `"${realWord}" is the only valid ${length}-letter word among the options.`,
      };
   }
};
