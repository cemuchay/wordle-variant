export type { WordUpQuestion } from "./types";
export { getQuestionImageUrl } from "./types";

export {
   decryptAESGCM,
   decryptMatchQuestions,
   generateSecretKey,
   encryptQuestions,
   decryptQuestions,
} from "./encryption";

export { calculateWordlePattern } from "./wordlePattern";

export { generateMathQuestion } from "./generators/math";
export { generateOddOneOutQuestion } from "./generators/oddOneOut";

export {
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

export { generateWordUpQuestions } from "./orchestrator";

export type { BotProfile } from "./botProfiles";
export {
   BOT_PROFILES,
   getRandomBotProfile,
   simulateBotResponse,
} from "./botProfiles";
