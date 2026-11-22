import type { WordUpQuestion } from "../../utils/wordupQuestionGenerator/types";
import type { RegionCode } from "./locationEstimator";

export type RematchDisposition =
   | "likes_rematch"
   | "declines_rematch"
   | "sore_loser"
   | "random";

export type PersistenceTrait =
   | "never_gives_up"
   | "steady"
   | "tilts_when_behind"
   | "gives_up_if_crushed";

export interface BotPersonality {
   archetype: string;
   rematchPreference: RematchDisposition;
   persistence: PersistenceTrait;
   accuracy: number;
   minDelay: number;
   maxDelay: number;
   clutchModifier: number;
   region: RegionCode;
}

const ARCHETYPES: Array<{
   archetype: string;
   rematchPreference: RematchDisposition;
   persistence: PersistenceTrait;
   clutchModifier: number;
}> = [
   {
      archetype: "clutch_grinder",
      rematchPreference: "likes_rematch",
      persistence: "never_gives_up",
      clutchModifier: 0.08,
   },
   {
      archetype: "proud_competitor",
      rematchPreference: "sore_loser",
      persistence: "never_gives_up",
      clutchModifier: 0.05,
   },
   {
      archetype: "one_and_done",
      rematchPreference: "declines_rematch",
      persistence: "steady",
      clutchModifier: 0.0,
   },
   {
      archetype: "streaky_sprinter",
      rematchPreference: "likes_rematch",
      persistence: "tilts_when_behind",
      clutchModifier: -0.05,
   },
   {
      archetype: "casual_challenger",
      rematchPreference: "random",
      persistence: "steady",
      clutchModifier: 0.02,
   },
   {
      archetype: "front_runner",
      rematchPreference: "sore_loser",
      persistence: "gives_up_if_crushed",
      clutchModifier: -0.08,
   },
   {
      archetype: "chill_scholar",
      rematchPreference: "random",
      persistence: "never_gives_up",
      clutchModifier: 0.06,
   },
   {
      archetype: "busy_commuter",
      rematchPreference: "declines_rematch",
      persistence: "gives_up_if_crushed",
      clutchModifier: -0.03,
   },
];

/**
 * Generates a realistic personality calibrated to a target ELO rating.
 * Higher ELO bots have higher base accuracy and faster response windows,
 * with natural individual variance.
 */
export function generateBotPersonality(
   targetRating: number,
   region: RegionCode,
): BotPersonality {
   const clampedRating = Math.max(600, Math.min(2200, targetRating));
   // Normalize 600..1900 -> 0..1
   const t = Math.min(1, Math.max(0, (clampedRating - 600) / 1300));

   // Accuracy scales from ~0.62 at 600 ELO to ~0.95 at 1900+ ELO with ±0.05 jitter
   const jitter = (Math.random() - 0.5) * 0.1;
   const accuracy = parseFloat(
      Math.min(0.97, Math.max(0.58, 0.63 + t * 0.31 + jitter)).toFixed(2),
   );

   // Speed scales from slower (3.5s - 7.8s at 600 ELO) to fast (1.1s - 3.6s at 1900 ELO)
   const speedJitter = (Math.random() - 0.5) * 0.8;
   const minDelay = parseFloat(
      Math.max(0.8, 3.6 - t * 2.4 + speedJitter).toFixed(2),
   );
   const maxDelay = parseFloat(
      Math.max(minDelay + 1.2, 7.6 - t * 3.8 + speedJitter).toFixed(2),
   );

   const chosen = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

   return {
      archetype: chosen.archetype,
      rematchPreference: chosen.rematchPreference,
      persistence: chosen.persistence,
      accuracy,
      minDelay,
      maxDelay,
      clutchModifier: chosen.clutchModifier,
      region,
   };
}

/**
 * Simulates a round response from a synthetic profile taking into account:
 * - Base accuracy & speed
 * - Persistence trait (e.g., never gives up vs tilts when behind vs gives up if crushed)
 * - Final round clutch modifier
 * - Question prompt length / type complexity
 */
export function simulatePersonalityBotResponse(
   question: WordUpQuestion,
   personality: BotPersonality | null | undefined,
   duration: number = 10.0,
   roundIdx: number = 0,
   playerScore: number = 0,
   botScore: number = 0,
): { correct: boolean; time_taken: number; points: number; gaveUp?: boolean } {
   const p: BotPersonality = personality || {
      archetype: "casual_challenger",
      rematchPreference: "random",
      persistence: "steady",
      accuracy: 0.75,
      minDelay: 2.8,
      maxDelay: 6.2,
      clutchModifier: 0.0,
      region: "NG",
   };

   const scoreDeficit = playerScore - botScore; // positive means bot is losing
   const isFinalRound = (roundIdx + 1) % 7 === 0;
   const isLateGame = (roundIdx % 7) >= 4;

   let effectiveAccuracy = p.accuracy;
   let effectiveMinDelay = p.minDelay;
   let effectiveMaxDelay = p.maxDelay;

   // Apply persistence behavioral modifiers in late game
   if (isLateGame && scoreDeficit > 20) {
      if (p.persistence === "never_gives_up") {
         // Locks in: slightly more accurate and focused
         effectiveAccuracy = Math.min(0.98, effectiveAccuracy + 0.08);
         effectiveMaxDelay = Math.max(effectiveMinDelay + 0.8, effectiveMaxDelay * 0.85);
      } else if (p.persistence === "tilts_when_behind" && scoreDeficit > 35) {
         // Rushes answers and makes more mistakes
         effectiveAccuracy = Math.max(0.42, effectiveAccuracy - 0.18);
         effectiveMinDelay = Math.max(0.7, effectiveMinDelay * 0.72);
         effectiveMaxDelay = Math.max(effectiveMinDelay + 0.7, effectiveMaxDelay * 0.72);
      } else if (p.persistence === "gives_up_if_crushed" && scoreDeficit > 60) {
         // 35% chance to mentally check out / not answer on time
         if (Math.random() < 0.35) {
            return {
               correct: false,
               time_taken: duration,
               points: 0,
               gaveUp: true,
            };
         }
         effectiveAccuracy = Math.max(0.45, effectiveAccuracy - 0.15);
      }
   }

   if (isFinalRound) {
      effectiveAccuracy = Math.min(0.98, Math.max(0.45, effectiveAccuracy + (p.clutchModifier || 0)));
   }

   // Adjust delay slightly for complex question types or long prompts
   const promptLengthFactor =
      (question?.prompt?.length || 0) > 85 ? 0.65 : (question?.prompt?.length || 0) > 50 ? 0.3 : 0;
   const typeComplexityFactor =
      question?.type === "math" || question?.type === "reverse_wordle" || question?.type === "cryptogram"
         ? 0.55
         : 0;

   const minD = Math.min(duration - 1.2, effectiveMinDelay + promptLengthFactor + typeComplexityFactor);
   const maxD = Math.min(duration - 0.4, Math.max(minD + 0.8, effectiveMaxDelay + promptLengthFactor + typeComplexityFactor));

   const correct = Math.random() < effectiveAccuracy;
   const time_taken = parseFloat(
      (Math.random() * (maxD - minD) + minD).toFixed(2),
   );

   let points = 0;
   if (correct) {
      const eff = Math.max(0, time_taken - 1.5);
      const denom = duration - 1.5;
      const basePts = Math.max(
         11,
         Math.round(20 * (1 - eff / (denom > 0 ? denom : duration))),
      );
      points = isFinalRound ? basePts * 2 : basePts;
   }

   return { correct, time_taken, points };
}

/**
 * Determines whether a bot will proactively initiate a rematch request after a match ends,
 * and how long (in ms) after game-over it waits before clicking "Request Rematch".
 */
export function evaluateProactiveBotRematch(
   personality: BotPersonality | null | undefined,
   botWon: boolean,
   isDraw: boolean,
   scoreDiff: number,
   consecutiveRematches: number = 0,
): { shouldRequest: boolean; delayMs: number } {
   if (!personality || consecutiveRematches >= 3) {
      return { shouldRequest: false, delayMs: 0 };
   }

   const fatigueFactor = Math.pow(0.65, consecutiveRematches);
   const isCloseGame = Math.abs(scoreDiff) <= 25 || isDraw;
   let probability: number;

   switch (personality.rematchPreference) {
      case "likes_rematch":
         probability = isCloseGame ? 0.62 : 0.45;
         break;
      case "sore_loser":
         probability = !botWon && !isDraw ? 0.68 : isDraw ? 0.4 : 0.12;
         break;
      case "random":
         probability = isCloseGame ? 0.35 : 0.22;
         break;
      case "declines_rematch":
      default:
         probability = 0;
         break;
   }

   // If the bot has "never_gives_up" and lost a close game, slightly boost rematch desire
   if (personality.persistence === "never_gives_up" && !botWon && isCloseGame && personality.rematchPreference !== "declines_rematch") {
      probability = Math.min(0.85, probability + 0.15);
   }

   const finalProb = probability * fatigueFactor;
   const shouldRequest = Math.random() < finalProb;
   // Human-like delay: 1.8s to 4.2s after gameover screen appears
   const delayMs = Math.round(1800 + Math.random() * 2400);

   return { shouldRequest, delayMs };
}

/**
 * Determines how a bot responds when the human player clicks "Request Rematch".
 * Can return:
 * - "accept": Bot accepts the rematch after `delayMs`
 * - "decline": Bot explicitly declines the rematch after `delayMs`
 * - "ignore": Bot ignores (simulating a user who already left the gameover screen)
 */
export function evaluateBotResponseToUserRematch(
   personality: BotPersonality | null | undefined,
   botWon: boolean,
   isDraw: boolean,
   consecutiveRematches: number = 0,
): { action: "accept" | "decline" | "ignore"; delayMs: number } {
   const pref = personality?.rematchPreference || "random";
   const fatiguePenalty = consecutiveRematches * 0.22;

   let acceptProb = 0.5;
   switch (pref) {
      case "likes_rematch":
         acceptProb = 0.82 - fatiguePenalty;
         break;
      case "sore_loser":
         acceptProb = (!botWon || isDraw ? 0.85 : 0.22) - fatiguePenalty;
         break;
      case "random":
         acceptProb = 0.52 - fatiguePenalty;
         break;
      case "declines_rematch":
         acceptProb = 0.1 - fatiguePenalty;
         break;
   }

   const delayMs = Math.round(1200 + Math.random() * 2300);

   if (Math.random() < Math.max(0.05, acceptProb)) {
      return { action: "accept", delayMs };
   }

   // When not accepting: 80% explicit decline, 20% ignore (let timer expire)
   const action = Math.random() < 0.8 ? "decline" : "ignore";
   return { action, delayMs };
}

