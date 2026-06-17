// src/utils/wordupQuestionGenerator.ts

import { getWordLists } from "../data/words";

export interface WordUpQuestion {
   type: "real_fake" | "length" | "missing_letter" | "reverse_wordle" | "definition" | "anagram" | "pattern";
   prompt: string;
   subPrompt?: string; // Additional context (e.g., target word in reverse Wordle)
   choices: string[];
   answer: string;
}

// -------------------------------------------------------------
// 1. Encryption / Decryption Helpers (XOR Base64)
// -------------------------------------------------------------

export const generateSecretKey = (): string => {
   const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let key = "";
   for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return key;
};

export const encryptQuestions = (questions: WordUpQuestion[], key: string): string => {
   const str = JSON.stringify(questions);
   let result = "";
   for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
   }
   return btoa(encodeURIComponent(result));
};

export const decryptQuestions = (encryptedStr: string, key: string): WordUpQuestion[] => {
   const decoded = decodeURIComponent(atob(encryptedStr));
   let result = "";
   for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
   }
   return JSON.parse(result);
};

// -------------------------------------------------------------
// 2. Pre-curated Definitions Database (for Question Type 5)
// -------------------------------------------------------------
const DEFINITIONS: Record<string, string> = {
   "AUTHOR": "A person who writes books, stories, or articles.",
   "PILOT": "A person who operates the flying controls of an aircraft.",
   "DOCTOR": "A qualified practitioner of medicine; a physician.",
   "POET": "A person who writes poems.",
   "COMPUTER": "An electronic device for storing and processing data.",
   "OCEAN": "A very large expanse of sea, in particular, each of the main areas of saline water.",
   "ELEPHANT": "A very large plant-eating mammal with a prehensile trunk and long ivory tusks.",
   "GUITAR": "A stringed musical instrument, with six or twelve strings, played by plucking or strumming.",
   "ASTRONAUT": "A person who is trained to travel in a spacecraft.",
   "BAKER": "A person who makes and sells bread, cake, and pastry.",
   "TEACHER": "A person who helps students to acquire knowledge, competence, or virtue.",
   "LIBRARY": "A building or room containing collections of books, periodicals, and sometimes films.",
   "MOUNTAIN": "A large natural elevation of the earth's surface rising abruptly from the surrounding level.",
   "VOLCANO": "A mountain or hill, typically conical, having a crater or vent through which lava, rock fragments, hot vapor, and gas are or have been erupted from the earth's crust.",
   "JOURNALIST": "A person who writes for newspapers, magazines, or news websites or prepares news to be broadcast.",
   "CHEMIST": "An expert in chemistry, or a person engaged in chemical research or experiments.",
   "SCIENTIST": "A person who is studying or has expert knowledge of one or more of the natural or physical sciences.",
   "SOLDIER": "A person who serves in an army.",
   "DENTIST": "A person qualified to treat the diseases and other conditions that affect the teeth and gums.",
   "ENGINEER": "A person who designs, builds, or maintains engines, machines, or public works.",
   "FIREMAN": "A person whose job is to extinguish fires.",
   "LAWYER": "A person who practices or studies law; an attorney or counselor.",
   "ARTIST": "A person who creates paintings or drawings as a profession or hobby.",
   "ACTOR": "A person whose profession is acting on the stage, in films, or on television.",
   "MUSICIAN": "A person who plays a musical instrument, especially as a profession, or is musically talented.",
   "FARMER": "A person who owns or manages a farm.",
   "CHEF": "A professional cook, typically the chief cook in a restaurant or hotel.",
   "WAITER": "A man whose job is to serve customers at their tables in a restaurant.",
   "NURSE": "A person trained to care for the sick or infirm, especially in a hospital.",
   "POLICE": "The civil force of a state or municipal government, responsible for the prevention and detection of crime.",
   "BREAD": "Food made of flour, water, and yeast mixed together and baked.",
   "CHEESE": "A food made from the pressed curds of milk.",
   "APPLE": "The round fruit of a tree of the rose family, which typically has thin green or red skin and crisp white flesh.",
   "BANANA": "A long curved fruit which grows in clusters and has soft pulpy flesh and yellow skin.",
   "COFFEE": "A hot drink made from the roasted and ground seeds (coffee beans) of a tropical shrub.",
   "CHICKEN": "A domestic fowl kept for its eggs or meat.",
   "SCHOOL": "An institution for educating children.",
   "CAMERA": "A device for recording visual images in the form of photographs, film, or video signals.",
   "TELEPHONE": "A system for transmitting voices over a distance using wire or radio.",
   "BICYCLE": "A vehicle consisting of two wheels held in a frame one behind the other, propelled by pedals."
};

// -------------------------------------------------------------
// 3. Wordle Pattern Calculator (for Question Type 4)
// -------------------------------------------------------------
export const calculateWordlePattern = (target: string, guess: string): string => {
   const len = target.length;
   const result = new Array(len).fill("⬜");
   const targetUsed = new Array(len).fill(false);
   const guessUsed = new Array(len).fill(false);

   // Green pass
   for (let i = 0; i < len; i++) {
      if (guess[i] === target[i]) {
         result[i] = "🟩";
         targetUsed[i] = true;
         guessUsed[i] = true;
      }
   }

   // Yellow pass
   for (let i = 0; i < len; i++) {
      if (guessUsed[i]) continue;
      for (let j = 0; j < len; j++) {
         if (targetUsed[j]) continue;
         if (guess[i] === target[j]) {
            result[i] = "🟨";
            targetUsed[j] = true;
            break;
         }
      }
   }

   return result.join("");
};

// -------------------------------------------------------------
// 4. Mutation Helper (for Question Type 1: Real/Fake)
// -------------------------------------------------------------
const mutateToFakeWord = (word: string, validSet: Set<string>): string => {
   const vowels = ["A", "E", "I", "O", "U"];
   const consonants = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z"];
   const wordChars = word.split("");

   for (let attempt = 0; attempt < 50; attempt++) {
      const idx = Math.floor(Math.random() * wordChars.length);
      const originalChar = wordChars[idx];
      const pool = vowels.includes(originalChar) ? vowels : consonants;
      const filteredPool = pool.filter((c) => c !== originalChar);
      const replacement = filteredPool[Math.floor(Math.random() * filteredPool.length)];

      const copy = [...wordChars];
      copy[idx] = replacement;
      const candidate = copy.join("");

      if (!validSet.has(candidate)) {
         return candidate;
      }
   }

   return word + "R"; // fallback fake suffix
};

// -------------------------------------------------------------
// 5. Main Question Generator Engine
// -------------------------------------------------------------
export const generateWordUpQuestions = (category: string): WordUpQuestion[] => {
   // Determine word lengths to sample based on matchmaking category
   let allowedLengths = [3, 4, 5, 6, 7, 8, 9, 10];
   if (category === "3_letters") allowedLengths = [3];
   else if (category === "4_letters") allowedLengths = [4];
   else if (category === "5_letters") allowedLengths = [5];
   else if (category === "6_letters") allowedLengths = [6];
   else if (category === "7_plus") allowedLengths = [7, 8, 9, 10];
   else if (category === "mixed" || category === "quick_match") allowedLengths = [4, 5, 6, 7];

   const questions: WordUpQuestion[] = [];

   // Define the question types to sample from
   // We will randomize the types so that they feel fresh
   const possibleTypes: WordUpQuestion["type"][] = [
      "real_fake",
      "length",
      "missing_letter",
      "reverse_wordle",
      "definition",
      "anagram",
      "pattern"
   ];

   // Shuffle types list
   const shuffledTypes = [...possibleTypes].sort(() => Math.random() - 0.5);

   for (let i = 0; i < 7; i++) {
      // Pick type
      const type = shuffledTypes[i % shuffledTypes.length];
      const length = allowedLengths[Math.floor(Math.random() * allowedLengths.length)];
      const { official, valid } = getWordLists(length);

      const randomWord = () => official[Math.floor(Math.random() * official.length)];

      if (type === "real_fake") {
         const isReal = Math.random() > 0.5;
         const word = randomWord();
         if (isReal) {
            questions.push({
               type: "real_fake",
               prompt: word,
               choices: ["Real", "Fake"],
               answer: "Real"
            });
         } else {
            const fake = mutateToFakeWord(word, valid);
            questions.push({
               type: "real_fake",
               prompt: fake,
               choices: ["Real", "Fake"],
               answer: "Fake"
            });
         }
      } 
      else if (type === "length") {
         const word = randomWord();
         const correctLen = word.length;
         const choices = new Set<string>();
         choices.add(String(correctLen));

         while (choices.size < 4) {
            const offset = Math.floor(Math.random() * 5) - 2; // -2 to +2
            const val = correctLen + offset;
            if (val >= 3 && val <= 11) {
               choices.add(String(val));
            }
         }

         questions.push({
            type: "length",
            prompt: word,
            choices: Array.from(choices).sort((a, b) => Number(a) - Number(b)),
            answer: String(correctLen)
         });
      } 
      else if (type === "missing_letter") {
         const word = randomWord();
         const missingIdx = Math.floor(Math.random() * word.length);
         const correctLetter = word[missingIdx];
         
         const promptChars = word.split("");
         promptChars[missingIdx] = "_";
         const promptStr = promptChars.join("");

         const choices = new Set<string>();
         choices.add(correctLetter);
         while (choices.size < 4) {
            const code = 65 + Math.floor(Math.random() * 26); // A-Z
            choices.add(String.fromCharCode(code));
         }

         questions.push({
            type: "missing_letter",
            prompt: promptStr,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: correctLetter
         });
      } 
      else if (type === "reverse_wordle") {
         // Target word
         const target = randomWord();
         // Choose a guess word of the same length
         let guess = randomWord();
         let pattern = calculateWordlePattern(target, guess);

         // We want a pattern that is not all white or all green (to make it interesting)
         let attempts = 0;
         while ((pattern.replace(/⬜/g, "").length === 0 || pattern.replace(/🟩/g, "").length === 0) && attempts < 10) {
            guess = randomWord();
            pattern = calculateWordlePattern(target, guess);
            attempts++;
         }

         const choices = new Set<string>();
         choices.add(guess);

         // Add 3 incorrect guesses of the same length
         while (choices.size < 4) {
            const dummy = randomWord();
            if (calculateWordlePattern(target, dummy) !== pattern) {
               choices.add(dummy);
            }
         }

         questions.push({
            type: "reverse_wordle",
            prompt: pattern,
            subPrompt: `Target: ${target}`,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: guess
         });
      } 
      else if (type === "definition") {
         // Find a word in our definition list
         const keys = Object.keys(DEFINITIONS);
         const chosenWord = keys[Math.floor(Math.random() * keys.length)];
         const definition = DEFINITIONS[chosenWord];

         const choices = new Set<string>();
         choices.add(chosenWord);

         while (choices.size < 4) {
            const dummy = keys[Math.floor(Math.random() * keys.length)];
            choices.add(dummy);
         }

         questions.push({
            type: "definition",
            prompt: definition,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: chosenWord
         });
      } 
      else if (type === "anagram") {
         const word = randomWord();
         // Scramble word characters
         let scrambled = word.split("").sort(() => Math.random() - 0.5).join("");
         while (scrambled === word && word.length > 2) {
            scrambled = word.split("").sort(() => Math.random() - 0.5).join("");
         }

         const choices = new Set<string>();
         choices.add(word);

         // Add 3 other words of same length
         while (choices.size < 4) {
            const dummy = randomWord();
            choices.add(dummy);
         }

         questions.push({
            type: "anagram",
            prompt: scrambled,
            choices: Array.from(choices).sort(() => Math.random() - 0.5),
            answer: word
         });
      } 
      else {
         // type === "pattern"
         const word = randomWord();
         const patternsList = [
            { query: "Contains 'PH'?", test: (w: string) => w.includes("PH") },
            { query: "Contains 'ING'?", test: (w: string) => w.includes("ING") },
            { query: "Contains double letters?", test: (w: string) => {
               for (let j = 0; j < w.length - 1; j++) {
                  if (w[j] === w[j + 1]) return true;
               }
               return false;
            }},
            { query: "Contains 'QU'?", test: (w: string) => w.includes("QU") },
            { query: "Has exactly 2 vowels?", test: (w: string) => {
               const v = w.match(/[AEIOU]/g);
               return v ? v.length === 2 : false;
            }},
            { query: "Contains the letter 'X', 'Z', or 'Q'?", test: (w: string) => /[XZQ]/.test(w) }
         ];

         const p = patternsList[Math.floor(Math.random() * patternsList.length)];
         const answerBool = p.test(word);

         questions.push({
            type: "pattern",
            prompt: word,
            subPrompt: p.query,
            choices: ["True", "False"],
            answer: answerBool ? "True" : "False"
         });
      }
   }

   return questions;
};

// -------------------------------------------------------------
// 6. Bot Behavior Simulation Configurations
// -------------------------------------------------------------
export interface BotProfile {
   name: string;
   accuracy: number; // 0 to 1
   minDelay: number; // in seconds
   maxDelay: number; // in seconds
}

export const BOT_PROFILES: Record<string, BotProfile> = {
   slow_thinker: { name: "Slow Thinker (Bot)", accuracy: 0.60, minDelay: 6.0, maxDelay: 9.0 },
   average: { name: "Average Player (Bot)", accuracy: 0.75, minDelay: 4.0, maxDelay: 7.5 },
   fast: { name: "Speedy Bot", accuracy: 0.85, minDelay: 2.0, maxDelay: 5.0 },
   master: { name: "Dictionary Master (Bot)", accuracy: 0.95, minDelay: 1.5, maxDelay: 3.5 },
   impossible: { name: "DeepWord (AI Bot)", accuracy: 1.00, minDelay: 0.5, maxDelay: 1.8 }
};

export const getRandomBotProfile = (): string => {
   const keys = Object.keys(BOT_PROFILES);
   return keys[Math.floor(Math.random() * keys.length)];
};
export const simulateBotResponse = (
   _question: WordUpQuestion,
   profileKey: string
): { correct: boolean; time_taken: number; points: number } => {
   const profile = BOT_PROFILES[profileKey] || BOT_PROFILES.average;
   const correct = Math.random() < profile.accuracy;
   
   // Random delay
   const time_taken = parseFloat(
      (Math.random() * (profile.maxDelay - profile.minDelay) + profile.minDelay).toFixed(2)
   );

   let points = 0;
   if (correct) {
      // Correct = 100 points
      // Speed bonus = up to +50 points (linearly scales from 0s to 10s)
      const speedBonus = Math.max(0, Math.round((1.0 - time_taken / 10.0) * 50));
      points = 100 + speedBonus;
   }

   return { correct, time_taken, points };
};
