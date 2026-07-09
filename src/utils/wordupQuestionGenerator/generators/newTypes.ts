import type { WordUpQuestion } from "../types";
import { loadWordLists } from "../../../data/words";
import { mutateToFakeWord } from "../mutateWord";
import { calculateWordlePattern } from "../wordlePattern";
import { DEFINITIONS, THEME_GROUPS, COMPOUND_PARTS } from "../definitions";
import { getDiffCount, isValidFake, rand, shuffle } from "./math";

// -------------------------------------------------------------
// Real / Fake
// -------------------------------------------------------------
export const generateRealFake = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official, valid } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const isReal = Math.random() > 0.5;

   if (isReal) {
      return {
         type: "real_fake",
         prompt: word,
         choices: ["Real", "Fake"],
         answer: "Real",
         explanation: `"${word}" is a real English word.`,
      };
   }
   const fake = mutateToFakeWord(word, valid);
   return {
      type: "real_fake",
      prompt: fake,
      choices: ["Real", "Fake"],
      answer: "Fake",
      explanation: `"${fake}" is not a real English word — it was created by altering "${word}".`,
   };
};

// -------------------------------------------------------------
// Length
// -------------------------------------------------------------
export const generateLengthQuestion = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const correctLen = word.length;
   const choices = new Set<string>();
   choices.add(String(correctLen));
   while (choices.size < 4) {
      const offset = Math.floor(Math.random() * 5) - 2;
      const val = correctLen + offset;
      if (val >= 3 && val <= 11) choices.add(String(val));
   }
   return {
      type: "length",
      prompt: word,
      choices: Array.from(choices).sort((a, b) => Number(a) - Number(b)),
      answer: String(correctLen),
      explanation: `The word "${word}" has ${correctLen} letters.`,
   };
};

// -------------------------------------------------------------
// Missing Letter
// -------------------------------------------------------------
export const generateMissingLetter = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official, valid } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const missingIdx = rand(0, word.length - 1);
   const correctLetter = word[missingIdx];
   const promptChars = word.split("");
   promptChars[missingIdx] = "_";
   const promptStr = promptChars.join("");

   const choices = new Set<string>();
   choices.add(correctLetter);
   let attempts = 0;
   while (choices.size < 4 && attempts < 200) {
      attempts++;
      const code = 65 + Math.floor(Math.random() * 26);
      const candidateLetter = String.fromCharCode(code);
      const candidateWord =
         word.substring(0, missingIdx) +
         candidateLetter +
         word.substring(missingIdx + 1);
      if (candidateLetter !== correctLetter && valid.has(candidateWord)) {
         continue;
      }
      choices.add(candidateLetter);
   }
   while (choices.size < 4) {
      const code = 65 + Math.floor(Math.random() * 26);
      choices.add(String.fromCharCode(code));
   }
   return {
      type: "missing_letter",
      prompt: promptStr,
      choices: shuffle(Array.from(choices)),
      answer: correctLetter,
      explanation: `The missing letter is "${correctLetter}". The full word is "${word}".`,
   };
};

// -------------------------------------------------------------
// Reverse Wordle
// -------------------------------------------------------------
export const generateReverseWordle = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const randomWord = () => official[rand(0, official.length - 1)];

   let target = randomWord();
   let guess = randomWord();
   let pattern = calculateWordlePattern(target, guess);

   let minColored;
   if (target.length <= 3) minColored = 1;
   else if (target.length <= 5) minColored = 2;
   else minColored = 3;

   let attempts = 0;
   while (attempts < 150) {
      const coloredCount = (pattern.match(/🟩|🟨/g) || []).length;
      const allGreen = (pattern.match(/🟩/g) || []).length === target.length;
      if (coloredCount >= minColored && !allGreen) break;
      if (attempts > 50 && attempts % 30 === 0) {
         if (minColored > 1) minColored--;
         else target = randomWord();
      }
      guess = randomWord();
      pattern = calculateWordlePattern(target, guess);
      attempts++;
   }

   const choices = new Set<string>();
   choices.add(guess);
   while (choices.size < 4) {
      const dummy = randomWord();
      if (calculateWordlePattern(target, dummy) !== pattern) {
         choices.add(dummy);
      }
   }
   return {
      type: "reverse_wordle",
      prompt: pattern,
      subPrompt: `Target: ${target}`,
      choices: shuffle(Array.from(choices)),
      answer: guess,
      explanation: `The guess "${guess}" produces this pattern for the target "${target}".`,
   };
};

// -------------------------------------------------------------
// Definition
// -------------------------------------------------------------
export const generateDefinitionQuestion = (): WordUpQuestion => {
   const keys = Object.keys(DEFINITIONS);
   const chosenWord = keys[rand(0, keys.length - 1)];
   const definition = DEFINITIONS[chosenWord];
   const choices = new Set<string>();
   choices.add(chosenWord);
   while (choices.size < 4) {
      const dummy = keys[rand(0, keys.length - 1)];
      choices.add(dummy);
   }
   return {
      type: "definition",
      prompt: definition,
      choices: shuffle(Array.from(choices)),
      answer: chosenWord,
      explanation: `The word "${chosenWord}" means: ${definition}`,
   };
};

// -------------------------------------------------------------
// Anagram
// -------------------------------------------------------------
export const generateAnagram = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const randomWord = () => official[rand(0, official.length - 1)];

   const word = randomWord();
   let scrambled = shuffle(word.split("")).join("");
   while (scrambled === word && word.length > 2) {
      scrambled = shuffle(word.split("")).join("");
   }
   const choices = new Set<string>();
   choices.add(word);
   while (choices.size < 4) {
      choices.add(randomWord());
   }
   return {
      type: "anagram",
      prompt: scrambled,
      choices: shuffle(Array.from(choices)),
      answer: word,
      explanation: `"${scrambled}" unscrambled is "${word}".`,
   };
};

// -------------------------------------------------------------
// Anagram Scrambled
// -------------------------------------------------------------
export const generateAnagramScrambled = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const randomWord = () => official[rand(0, official.length - 1)];

   const word = randomWord();
   let scrambled = shuffle(word.split("")).join("");
   while (scrambled === word && word.length > 2) {
      scrambled = shuffle(word.split("")).join("");
   }

   const scrambleWord = (w: string) => shuffle(w.split("")).join("");
   const choices = new Set<string>();
   choices.add(scrambled);

   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const chars = word.split("");
      const numReplacements = word.length > 4 ? 2 : 1;
      const replacedIndices = new Set<number>();
      for (let r = 0; r < numReplacements; r++) {
         let replaceIdx = Math.floor(Math.random() * chars.length);
         while (replacedIndices.has(replaceIdx)) {
            replaceIdx = Math.floor(Math.random() * chars.length);
         }
         replacedIndices.add(replaceIdx);
         let replacement = chars[replaceIdx];
         while (replacement === chars[replaceIdx]) {
            replacement = String.fromCharCode(65 + Math.floor(Math.random() * 26));
         }
         chars[replaceIdx] = replacement;
      }
      const mutatedScramble = scrambleWord(chars.join(""));
      if (isValidFake(scrambled, mutatedScramble)) {
         choices.add(mutatedScramble);
      }
   }
   let fallbackAttempts = 0;
   while (choices.size < 4 && fallbackAttempts < 50) {
      fallbackAttempts++;
      const fallbackChoice = scrambleWord(word) + (word.length > 4 ? "XY" : "X");
      if (isValidFake(scrambled, fallbackChoice)) {
         choices.add(fallbackChoice);
      }
   }
   return {
      type: "anagram_scrambled",
      prompt: word,
      choices: shuffle(Array.from(choices)),
      answer: scrambled,
      explanation: `"${scrambled}" is a valid scrambled version of "${word}".`,
   };
};

// -------------------------------------------------------------
// Pattern
// -------------------------------------------------------------
export const generatePatternQuestion = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const wordLetters = Array.from(new Set(word.split("")));
   const randomChar = wordLetters[rand(0, wordLetters.length - 1)];
   const firstOccurIdx = word.indexOf(randomChar) + 1;

   const patternsList = [
      { query: "Contains 'PH'?", test: (w: string) => w.includes("PH") },
      { query: "Contains 'ING'?", test: (w: string) => w.includes("ING") },
      {
         query: "Contains exactly double letters?",
         test: (w: string) => {
            const counts: Record<string, number> = {};
            for (const char of w) counts[char] = (counts[char] || 0) + 1;
            return Object.values(counts).includes(2);
         },
      },
      {
         query: "Contains exactly triple letters?",
         test: (w: string) => {
            const counts: Record<string, number> = {};
            for (const char of w) counts[char] = (counts[char] || 0) + 1;
            return Object.values(counts).includes(3);
         },
      },
      { query: "Contains 'QU'?", test: (w: string) => w.includes("QU") },
      {
         query: "Has exactly 2 vowels?",
         test: (w: string) => {
            const v = w.match(/[AEIOU]/g);
            return v ? v.length === 2 : false;
         },
      },
      {
         query: "Contains the letter 'X', 'Z', or 'Q'?",
         test: (w: string) => /[XZQ]/.test(w),
      },
      {
         query: `First occurrence of '${randomChar}' is at position ${firstOccurIdx}?`,
         test: (w: string) => w.indexOf(randomChar) + 1 === firstOccurIdx,
      },
      {
         query: `First occurrence of '${randomChar}' is at position ${firstOccurIdx === 1 ? 2 : firstOccurIdx - 1}?`,
         test: (w: string) =>
            w.indexOf(randomChar) + 1 === (firstOccurIdx === 1 ? 2 : firstOccurIdx - 1),
      },
   ];

   const p = patternsList[rand(0, patternsList.length - 1)];
   const answerBool = p.test(word);
   return {
      type: "pattern",
      prompt: word,
      subPrompt: p.query,
      choices: ["True", "False"],
      answer: answerBool ? "True" : "False",
      explanation: `The word "${word}" ${answerBool ? "does" : "does not"} satisfy: ${p.query}`,
   };
};

// -------------------------------------------------------------
// Vowel Drop
// -------------------------------------------------------------
export const generateVowelDrop = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const randomWord = () => official[rand(0, official.length - 1)];
   const word = randomWord();
   const prompt = word.replace(/[AEIOU]/g, "_");
   const choices = new Set<string>();
   choices.add(word);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const dummy = randomWord();
      if (dummy.length === word.length) choices.add(dummy);
   }
   while (choices.size < 4) choices.add(randomWord());
   return {
      type: "vowel_drop",
      prompt,
      choices: shuffle(Array.from(choices)),
      answer: word,
      explanation: `"${word}" with vowels removed is "${prompt}".`,
   };
};

// -------------------------------------------------------------
// Rhyme Match
// -------------------------------------------------------------
export const generateRhymeMatch = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const randomWord = () => official[rand(0, official.length - 1)];

   const findRhyme = (word: string, list: string[]) => {
      const suffixLen = word.length >= 5 ? 3 : 2;
      const suffix = word.substring(word.length - suffixLen);
      const rhymes = list.filter((w) => w.endsWith(suffix) && w !== word);
      return { suffix, rhymes };
   };

   let word = randomWord();
   let { suffix, rhymes } = findRhyme(word, official);
   let attempts = 0;
   while (rhymes.length === 0 && attempts < 50) {
      attempts++;
      word = randomWord();
      ({ suffix, rhymes } = findRhyme(word, official));
   }
   if (rhymes.length === 0) {
      return {
         type: "rhyme_match",
         prompt: "Which word rhymes with BAKE?",
         choices: shuffle(["LAKE", "BOOK", "CAR", "SUN"]),
         answer: "LAKE",
         explanation: '"LAKE" rhymes with "BAKE".',
      };
   }
   const rhymingWord = rhymes[rand(0, rhymes.length - 1)];
   const choices = new Set<string>();
   choices.add(rhymingWord);
   let decoyAttempts = 0;
   while (choices.size < 4 && decoyAttempts < 100) {
      decoyAttempts++;
      const dummy = randomWord();
      if (!dummy.endsWith(suffix)) choices.add(dummy);
   }
   while (choices.size < 4) choices.add(randomWord());
   return {
      type: "rhyme_match",
      prompt: `Which word rhymes with ${word}?`,
      choices: shuffle(Array.from(choices)),
      answer: rhymingWord,
      explanation: `"${rhymingWord}" rhymes with "${word}" (both end with "${suffix}").`,
   };
};

// -------------------------------------------------------------
// Letter Count
// -------------------------------------------------------------
export const generateLetterCount = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const isVowelCount = Math.random() > 0.5;
   let count: number;
   let prompt: string;
   if (isVowelCount) {
      count = (word.match(/[AEIOU]/g) || []).length;
      prompt = `How many vowels are in the word ${word}?`;
   } else {
      count = (word.match(/[BCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
      prompt = `How many consonants are in the word ${word}?`;
   }
   const choices = new Set<string>();
   choices.add(String(count));
   let countAttempts = 0;
   while (choices.size < 4 && countAttempts < 50) {
      countAttempts++;
      const offset = Math.floor(Math.random() * 5) - 2;
      const val = count + offset;
      if (val >= 0 && val <= word.length) choices.add(String(val));
   }
   while (choices.size < 4) choices.add(String(count + choices.size));
   return {
      type: "letter_count",
      prompt,
      choices: Array.from(choices).sort((a, b) => Number(a) - Number(b)),
      answer: String(count),
      explanation: `The word "${word}" has ${count} ${isVowelCount ? "vowel" : "consonant"}${count !== 1 ? "s" : ""}.`,
   };
};

// -------------------------------------------------------------
// Word Ladder
// -------------------------------------------------------------
export const generateWordLadder = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const randomWord = () => official[rand(0, official.length - 1)];

   let word = randomWord();
   let candidates = official.filter(
      (w) => w.length === word.length && getDiffCount(word, w) === 1,
   );
   let attempts = 0;
   while (candidates.length === 0 && attempts < 50) {
      attempts++;
      word = randomWord();
      candidates = official.filter(
         (w) => w.length === word.length && getDiffCount(word, w) === 1,
      );
   }
   if (candidates.length === 0) {
      return {
         type: "word_ladder",
         prompt: "Which word is exactly one letter edit away from CAT?",
         choices: shuffle(["BAT", "BOOK", "CAR", "DOG"]),
         answer: "BAT",
         explanation: 'Change "C" in "CAT" to "B" to get "BAT".',
      };
   }
   const correctWord = candidates[rand(0, candidates.length - 1)];
   const choices = new Set<string>();
   choices.add(correctWord);
   let decoyAttempts = 0;
   while (choices.size < 4 && decoyAttempts < 150) {
      decoyAttempts++;
      const dummy = randomWord();
      if (dummy.length === word.length && getDiffCount(word, dummy) >= 2) {
         choices.add(dummy);
      }
   }
   while (choices.size < 4) choices.add(randomWord());
   return {
      type: "word_ladder",
      prompt: `Which word is exactly one letter edit away from ${word}?`,
      choices: shuffle(Array.from(choices)),
      answer: correctWord,
      explanation: `Change one letter in "${word}" to get "${correctWord}".`,
   };
};

// -------------------------------------------------------------
// Synonym Match
// -------------------------------------------------------------
export const generateSynonymMatch = async (): Promise<WordUpQuestion> => {
   const themeKeys = Object.keys(THEME_GROUPS).filter(
      (k) => THEME_GROUPS[k].length <= 6,
   );
   let theme = themeKeys[rand(0, themeKeys.length - 1)];
   let words = THEME_GROUPS[theme];
   let attempts = 0;
   while (words.length < 2 && attempts < 20) {
      attempts++;
      theme = themeKeys[rand(0, themeKeys.length - 1)];
      words = THEME_GROUPS[theme];
   }
   const shuffled = shuffle(words);
   const displayWord = shuffled[0];
   const correctWord = shuffled[1];

   const choices = new Set<string>();
   choices.add(correctWord);
   let decoyAttempts = 0;
   while (choices.size < 4 && decoyAttempts < 100) {
      decoyAttempts++;
      const otherTheme = themeKeys[rand(0, themeKeys.length - 1)];
      if (otherTheme === theme) continue;
      const otherWords = THEME_GROUPS[otherTheme];
      const pick = otherWords[rand(0, otherWords.length - 1)];
      if (pick !== displayWord) choices.add(pick);
   }
   while (choices.size < 4) choices.add("UNKNOWN");
   return {
      type: "synonym_match",
      prompt: `Which word is related to ${displayWord}?`,
      choices: shuffle(Array.from(choices)),
      answer: correctWord,
      explanation: `"${displayWord}" and "${correctWord}" are related (theme: ${theme}).`,
   };
};

// -------------------------------------------------------------
// Word Chain
// -------------------------------------------------------------
export const generateWordChain = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const suffix = word.substring(word.length - 2);

   let candidates: string[] = [];
   for (const len of allowedLengths) {
      const list = (await loadWordLists(len)).official;
      candidates.push(...list.filter((w) => w.startsWith(suffix) && w !== word));
   }

   let fallbackWord = word;
   let fallbackSuffix = suffix;
   let attempts = 0;
   while (candidates.length === 0 && attempts < 30) {
      attempts++;
      fallbackWord = official[rand(0, official.length - 1)];
      fallbackSuffix = fallbackWord.substring(fallbackWord.length - 2);
      for (const len of allowedLengths) {
         const list = (await loadWordLists(len)).official;
         candidates.push(
            ...list.filter((w) => w.startsWith(fallbackSuffix) && w !== fallbackWord),
         );
      }
   }

   const correct =
      candidates.length > 0
         ? candidates[rand(0, candidates.length - 1)]
         : fallbackSuffix + "AY";

   const choices = new Set<string>();
   choices.add(correct);
   let decoyAttempts = 0;
   while (choices.size < 4 && decoyAttempts < 100) {
      decoyAttempts++;
      const len = allowedLengths[rand(0, allowedLengths.length - 1)];
      const list = (await loadWordLists(len)).official;
      const dummy = list[rand(0, list.length - 1)];
      if (!dummy.startsWith(fallbackSuffix)) choices.add(dummy);
   }
   while (choices.size < 4) choices.add(fallbackSuffix + "AB");
   return {
      type: "word_chain",
      prompt: `Which word starts with the last 2 letters of ${fallbackWord}?`,
      subPrompt: `Last 2 letters: "${fallbackSuffix}"`,
      choices: shuffle(Array.from(choices)),
      answer: correct,
      explanation: `"${correct}" starts with "${fallbackSuffix}", the last 2 letters of "${fallbackWord}".`,
   };
};

// -------------------------------------------------------------
// Letter Shift
// -------------------------------------------------------------
export const generateLetterShift = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official, valid } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const shift = rand(1, 3);
   const shifted = word
      .split("")
      .map((ch) => {
         const code = ch.charCodeAt(0) + shift;
         return String.fromCharCode(code > 90 ? code - 26 : code);
      })
      .join("");

   const choices = new Set<string>();
   choices.add(word);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const dummy = official[rand(0, official.length - 1)];
      if (dummy !== word && valid.has(dummy)) choices.add(dummy);
   }
   while (choices.size < 4) choices.add(official[rand(0, official.length - 1)]);
   return {
      type: "letter_shift",
      prompt: `Each letter has been shifted forward by ${shift} in the alphabet. What is the original word?`,
      subPrompt: shifted,
      choices: shuffle(Array.from(choices)),
      answer: word,
      explanation: `"${word}" shifted by ${shift} letter(s) gives "${shifted}".`,
   };
};

// -------------------------------------------------------------
// Compound Break
// -------------------------------------------------------------
export const generateCompoundBreak = (): WordUpQuestion => {
   const entry = COMPOUND_PARTS[rand(0, COMPOUND_PARTS.length - 1)];
   const [compound, partA, partB] = entry;
   const askForA = Math.random() > 0.5;
   const correct = askForA ? partA : partB;
   const otherPart = askForA ? partB : partA;

   const choices = new Set<string>();
   choices.add(correct);
   let attempts = 0;
   while (choices.size < 4 && attempts < 50) {
      attempts++;
      const other = COMPOUND_PARTS[rand(0, COMPOUND_PARTS.length - 1)];
      const candidate = askForA ? other[1] : other[2];
      if (candidate !== correct) choices.add(candidate);
   }
   while (choices.size < 4) choices.add("ZERO");
   return {
      type: "compound_break",
      prompt: `Which word combines with "${otherPart}" to form "${compound}"?`,
      choices: shuffle(Array.from(choices)),
      answer: correct,
      explanation: `"${otherPart}" + "${correct}" = "${compound}".`,
   };
};

// -------------------------------------------------------------
// Word Within
// -------------------------------------------------------------
export const generateWordWithin = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const longLengths = allowedLengths.filter((l) => l >= 7);
   if (longLengths.length === 0) {
      return {
         type: "word_within",
         prompt: "Which word can be found inside SUNFLOWER?",
         choices: shuffle(["SUN", "MOON", "STAR", "SKY"]),
         answer: "SUN",
         explanation: '"SUN" is hidden inside "SUNFLOWER".',
      };
   }
   const longLen = longLengths[rand(0, longLengths.length - 1)];
   const { official } = await loadWordLists(longLen);
   const longWord = official[rand(0, official.length - 1)];

   const shortLengths = allowedLengths.filter((l) => l >= 3 && l <= 5);
   const subCandidates: string[] = [];
   for (const slen of shortLengths) {
      const list = (await loadWordLists(slen)).official;
      for (const w of list) {
         if (w.length < longWord.length && longWord.includes(w)) {
            subCandidates.push(w);
         }
      }
   }

   let fallbackWord = longWord;
   let fallbackAttempts = 0;
   while (subCandidates.length === 0 && fallbackAttempts < 20) {
      fallbackAttempts++;
      fallbackWord = official[rand(0, official.length - 1)];
      for (const slen of shortLengths) {
         const list = (await loadWordLists(slen)).official;
         for (const w of list) {
            if (w.length < fallbackWord.length && fallbackWord.includes(w)) {
               subCandidates.push(w);
            }
         }
      }
   }

   const correct =
      subCandidates.length > 0
         ? subCandidates[rand(0, subCandidates.length - 1)]
         : fallbackWord.substring(0, Math.min(3, fallbackWord.length));

   const choices = new Set<string>();
   choices.add(correct);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const slen = shortLengths[rand(0, shortLengths.length - 1)];
      const list = (await loadWordLists(slen)).official;
      const dummy = list[rand(0, list.length - 1)];
      if (dummy !== correct && !fallbackWord.includes(dummy)) choices.add(dummy);
   }
   while (choices.size < 4) choices.add("XYZ");
   return {
      type: "word_within",
      prompt: `Which word can be found inside "${fallbackWord}"?`,
      choices: shuffle(Array.from(choices)),
      answer: correct,
      explanation: `"${correct}" is hidden inside "${fallbackWord}".`,
   };
};

// -------------------------------------------------------------
// Cryptogram
// -------------------------------------------------------------
const DOUBLE_LETTER_PATTERNS = ["LL", "SS", "EE", "OO", "TT"];

const scanWordlistForDoubleLetter = (
   wordlist: string[],
   patterns: string[],
): string | null => {
   if (wordlist.length === 0) return null;
   const start = Math.floor(Math.random() * wordlist.length);
   for (let i = 0; i < wordlist.length; i++) {
      const word = wordlist[(start + i) % wordlist.length];
      if (patterns.some((p) => word.includes(p))) return word;
   }
   return null;
};

export const generateCryptogram = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official, valid } = await loadWordLists(length);

   let word: string;
   let attempts = 0;
   do {
      word = official[rand(0, official.length - 1)];
      attempts++;
   } while (attempts < 50 && !/([A-Z])\1/.test(word));

   if (!/([A-Z])\1/.test(word)) {
      const scanned = scanWordlistForDoubleLetter(official, DOUBLE_LETTER_PATTERNS);
      if (scanned) word = scanned;
   }

   const doublePositions: number[] = [];
   for (let i = 0; i < word.length - 1; i++) {
      if (word[i] === word[i + 1]) doublePositions.push(i);
   }

   const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
   const shuffled = shuffle([...letters]);
   const cipherMap: Record<string, string> = {};
   for (let i = 0; i < 26; i++) {
      cipherMap[letters[i]] = shuffled[i];
   }
   const encoded = word
      .split("")
      .map((ch) => cipherMap[ch] || ch)
      .join("");

   const choices = new Set<string>();
   choices.add(word);
   let choiceAttempts = 0;
   while (choices.size < 4 && choiceAttempts < 100) {
      choiceAttempts++;
      const dummy = official[rand(0, official.length - 1)];
      if (dummy === word || !valid.has(dummy)) continue;
      const hasDoubleAtCorrectPos = doublePositions.some(
         (pos) => dummy[pos] === dummy[pos + 1],
      );
      if (!hasDoubleAtCorrectPos) choices.add(dummy);
   }
   while (choices.size < 4) {
      const dummy = official[rand(0, official.length - 1)];
      if (dummy !== word) choices.add(dummy);
   }
   return {
      type: "cryptogram",
      prompt: "Decode the secret message! Each letter has been replaced with another.",
      subPrompt: `Coded: ${encoded}`,
      choices: shuffle(Array.from(choices)),
      answer: word,
      explanation: `"${word}" encoded as "${encoded}" using a substitution cipher.`,
   };
};

// -------------------------------------------------------------
// Category Sort
// -------------------------------------------------------------
export const generateCategorySort = (): WordUpQuestion => {
   const themeKeys = Object.keys(THEME_GROUPS);
   const mainThemeIdx = rand(0, themeKeys.length - 1);
   let otherThemeIdx = rand(0, themeKeys.length - 1);
   while (otherThemeIdx === mainThemeIdx) {
      otherThemeIdx = rand(0, themeKeys.length - 1);
   }
   const mainTheme = themeKeys[mainThemeIdx];
   const otherTheme = themeKeys[otherThemeIdx];
   const mainWords = shuffle(THEME_GROUPS[mainTheme]).slice(0, 3);
   const oddWord = shuffle(THEME_GROUPS[otherTheme])[0];

   return {
      type: "category_sort",
      prompt: "Which word does NOT belong with the others?",
      choices: shuffle([...mainWords, oddWord]),
      answer: oddWord,
      explanation: `"${oddWord}" belongs to "${otherTheme}", while the others belong to "${mainTheme}".`,
   };
};

// -------------------------------------------------------------
// Letter Add/Remove
// -------------------------------------------------------------
interface WordPair {
   base: string;
   result: string;
}

const FALLBACK_REMOVE_POOL: WordPair[] = [
   { base: "BREAD", result: "READ" },
   { base: "BEACH", result: "EACH" },
   { base: "PLANET", result: "PLANE" },
   { base: "START", result: "TART" },
   { base: "TRAIN", result: "RAIN" },
];

const FALLBACK_ADD_POOL: WordPair[] = [
   { base: "READ", result: "BREAD" },
   { base: "EACH", result: "BEACH" },
   { base: "PLANE", result: "PLANET" },
   { base: "TART", result: "START" },
   { base: "RAIN", result: "TRAIN" },
];

const checkRemoval = (word: string, validSet: Set<string>): WordPair | null => {
   for (let i = 0; i < word.length; i++) {
      const candidate = word.substring(0, i) + word.substring(i + 1);
      if (candidate.length >= 3 && validSet.has(candidate)) {
         return { base: word, result: candidate };
      }
   }
   return null;
};

const checkAddition = (
   word: string,
   validSet: Set<string>,
   maxLen: number,
): WordPair | null => {
   if (word.length >= maxLen) return null;
   for (let i = 0; i <= word.length; i++) {
      for (let c = 65; c <= 90; c++) {
         const letter = String.fromCharCode(c);
         const candidate = word.substring(0, i) + letter + word.substring(i);
         if (candidate.length <= 10 && validSet.has(candidate)) {
            return { base: word, result: candidate };
         }
      }
   }
   return null;
};

export const generateLetterAddRemove = async (
   allowedLengths: number[],
): Promise<WordUpQuestion> => {
   const length = allowedLengths[rand(0, allowedLengths.length - 1)];
   const { official, valid } = await loadWordLists(length);
   const word = official[rand(0, official.length - 1)];
   const useRemove = Math.random() > 0.5;
   const maxLen = Math.max(...allowedLengths);

   let pair: WordPair | null = useRemove
      ? checkRemoval(word, valid)
      : checkAddition(word, valid, maxLen);

   let retries = 0;
   while (!pair && retries < 30) {
      retries++;
      const newWord = official[rand(0, official.length - 1)];
      pair = useRemove
         ? checkRemoval(newWord, valid)
         : checkAddition(newWord, valid, maxLen);
   }

   if (!pair) {
      const pool = useRemove ? FALLBACK_REMOVE_POOL : FALLBACK_ADD_POOL;
      const validFallbacks = pool.filter((p) => p.result.length <= maxLen);
      const safePool = validFallbacks.length > 0 ? validFallbacks : pool;
      pair = safePool[rand(0, safePool.length - 1)];
   }

   const isRemove = pair.base.length > pair.result.length;
   const prompt = isRemove
      ? `Remove one letter from "${pair.base}" to make a valid word.`
      : `Add one letter to "${pair.base}" to make a valid word.`;
   const correctAnswer = pair.result;

   const choices = new Set<string>();
   choices.add(correctAnswer);
   let attempts = 0;
   while (choices.size < 4 && attempts < 100) {
      attempts++;
      const len = allowedLengths[rand(0, allowedLengths.length - 1)];
      const list = (await loadWordLists(len)).official;
      const dummy = list[rand(0, list.length - 1)];
      const diffLen = Math.abs(dummy.length - correctAnswer.length);
      if (diffLen <= 1 && !pair.base.includes(dummy)) choices.add(dummy);
   }
   while (choices.size < 4) choices.add(correctAnswer + "X");
   return {
      type: "letter_add_remove",
      prompt,
      choices: shuffle(Array.from(choices)),
      answer: correctAnswer,
      explanation: isRemove
         ? `Remove a letter from "${pair.base}" to get "${pair.result}".`
         : `Add a letter to "${pair.base}" to get "${pair.result}".`,
   };
};
