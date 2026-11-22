import type { WordUpQuestion } from "./types";
import {
   generateBotPersonality,
   simulatePersonalityBotResponse,
   type BotPersonality,
} from "../../wordup/shared/botPersonality";
import { estimateUserLocation } from "../../wordup/shared/locationEstimator";

export interface BotProfile {
   name: string;
   accuracy: number;
   minDelay: number;
   maxDelay: number;
}

/**
 * Legacy compatibility map for external simulator scripts and fallback lookups.
 * Hardcoded bot nicknames have been replaced by dynamic Faker.js synthetic user profiles.
 */
export const BOT_PROFILES: Record<string, BotProfile> = {
   slow_thinker: { name: "Player", accuracy: 0.67, minDelay: 5.0, maxDelay: 8.2 },
   average: { name: "Player", accuracy: 0.75, minDelay: 3.0, maxDelay: 6.5 },
   fast: { name: "Player", accuracy: 0.85, minDelay: 1.5, maxDelay: 3.2 },
   master: { name: "Player", accuracy: 0.94, minDelay: 1.0, maxDelay: 2.5 },
   impossible: { name: "Player", accuracy: 0.98, minDelay: 0.8, maxDelay: 2.0 },
};

export const getRandomBotProfile = (): string => {
   const keys = Object.keys(BOT_PROFILES);
   return keys[Math.floor(Math.random() * keys.length)];
};

export const simulateBotResponse = (
   question: WordUpQuestion,
   profileOrPersonality?: string | BotPersonality | null,
   duration: number = 10.0,
   roundIdx: number = 0,
   playerScore: number = 0,
   botScore: number = 0,
): { correct: boolean; time_taken: number; points: number; gaveUp?: boolean } => {
   if (profileOrPersonality && typeof profileOrPersonality === "object") {
      return simulatePersonalityBotResponse(
         question,
         profileOrPersonality,
         duration,
         roundIdx,
         playerScore,
         botScore,
      );
   }

   const preset =
      typeof profileOrPersonality === "string" && BOT_PROFILES[profileOrPersonality]
         ? BOT_PROFILES[profileOrPersonality]
         : null;

   const syntheticPersonality: BotPersonality = preset
      ? {
           archetype: "steady_competitor",
           rematchPreference: "random",
           persistence: "steady",
           accuracy: preset.accuracy,
           minDelay: preset.minDelay,
           maxDelay: preset.maxDelay,
           clutchModifier: 0,
           region: estimateUserLocation().countryCode,
        }
      : generateBotPersonality(1000, estimateUserLocation().countryCode);

   return simulatePersonalityBotResponse(
      question,
      syntheticPersonality,
      duration,
      roundIdx,
      playerScore,
      botScore,
   );
};
