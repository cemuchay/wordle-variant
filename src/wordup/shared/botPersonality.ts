import type { WordUpQuestion } from "../../utils/wordupQuestionGenerator/types";
import type { RegionCode } from "./locationEstimator";
import {
   getCachedTopicTelemetry,
   type TopicResponseTelemetry,
} from "./topicTelemetryService";

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
   speedMultiplier: number;
}> = [
   {
      archetype: "clutch_grinder",
      rematchPreference: "likes_rematch",
      persistence: "never_gives_up",
      clutchModifier: 0.08,
      speedMultiplier: 0.9,
   },
   {
      archetype: "proud_competitor",
      rematchPreference: "sore_loser",
      persistence: "never_gives_up",
      clutchModifier: 0.05,
      speedMultiplier: 0.88,
   },
   {
      archetype: "one_and_done",
      rematchPreference: "declines_rematch",
      persistence: "steady",
      clutchModifier: 0.0,
      speedMultiplier: 0.96,
   },
   {
      archetype: "streaky_sprinter",
      rematchPreference: "likes_rematch",
      persistence: "tilts_when_behind",
      clutchModifier: -0.05,
      speedMultiplier: 0.8,
   },
   {
      archetype: "casual_challenger",
      rematchPreference: "random",
      persistence: "steady",
      clutchModifier: 0.02,
      speedMultiplier: 1.0,
   },
   {
      archetype: "front_runner",
      rematchPreference: "sore_loser",
      persistence: "gives_up_if_crushed",
      clutchModifier: -0.08,
      speedMultiplier: 0.86,
   },
   {
      archetype: "chill_scholar",
      rematchPreference: "random",
      persistence: "never_gives_up",
      clutchModifier: 0.06,
      speedMultiplier: 1.04,
   },
   {
      archetype: "busy_commuter",
      rematchPreference: "declines_rematch",
      persistence: "gives_up_if_crushed",
      clutchModifier: -0.03,
      speedMultiplier: 0.94,
   },
];

/**
 * Generates a realistic personality calibrated to a target ELO rating.
 * Uses snappy, human-realistic response windows (0.85s - 3.8s) so bots frequently
 * answer first and match real human reflex speeds.
 */
export function generateBotPersonality(
   targetRating: number,
   region: RegionCode,
): BotPersonality {
   const clampedRating = Math.max(600, Math.min(2200, targetRating));
   // Normalize 600..1900 -> 0..1
   const t = Math.min(1, Math.max(0, (clampedRating - 600) / 1300));

   const chosen = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

   // Accuracy scales from ~0.64 at 600 ELO to ~0.95 at 1900+ ELO with ±0.05 jitter
   const jitter = (Math.random() - 0.5) * 0.1;
   const accuracy = parseFloat(
      Math.min(0.97, Math.max(0.6, 0.64 + t * 0.3 + jitter)).toFixed(2),
   );

   // Fast human speed window:
   // At 600 ELO: minDelay ~1.15s - 1.45s, maxDelay ~3.1s - 4.0s
   // At 1900 ELO: minDelay ~0.75s - 0.95s, maxDelay ~2.1s - 2.7s
   const speedJitter = (Math.random() - 0.5) * 0.25;
   const rawMin = (1.35 - t * 0.5 + speedJitter) * chosen.speedMultiplier;
   const rawMax = (3.55 - t * 1.25 + speedJitter) * chosen.speedMultiplier;

   const minDelay = parseFloat(Math.max(0.75, rawMin).toFixed(2));
   const maxDelay = parseFloat(Math.max(minDelay + 1.0, rawMax).toFixed(2));

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
 * Simulates a round response from a synthetic profile using:
 * 1. Per-topic human telemetry (p25 fast recognition, median typical speed, p75 deliberation)
 * 2. A right-skewed human reaction distribution so the bot frequently answers BEFORE the user (~50% of rounds)
 * 3. Personality & persistence traits (never_gives_up, tilts_when_behind, gives_up_if_crushed)
 */
export function simulatePersonalityBotResponse(
   question: WordUpQuestion,
   personality: BotPersonality | null | undefined,
   duration: number = 10.0,
   roundIdx: number = 0,
   playerScore: number = 0,
   botScore: number = 0,
   topicTelemetry?: TopicResponseTelemetry | null,
   category: string = "mixed",
): { correct: boolean; time_taken: number; points: number; gaveUp?: boolean } {
   const p: BotPersonality = personality || {
      archetype: "casual_challenger",
      rematchPreference: "random",
      persistence: "steady",
      accuracy: 0.76,
      minDelay: 1.15,
      maxDelay: 3.2,
      clutchModifier: 0.0,
      region: "NG",
   };

   const telemetry = topicTelemetry || getCachedTopicTelemetry(category);

   const scoreDeficit = playerScore - botScore; // positive means bot is losing
   const isFinalRound = (roundIdx + 1) % 7 === 0;
   const isLateGame = (roundIdx % 7) >= 4;

   // Blend bot's personal accuracy (75%) with the topic's real human accuracy (25%)
   let effectiveAccuracy = p.accuracy * 0.78 + telemetry.avgAccuracy * 0.22;

   // Normalize legacy slow bot personalities stored in DB/localStorage (if minDelay > 2.2s, compress to fast human range)
   const normMinDelay = p.minDelay > 2.0 ? Math.max(0.85, p.minDelay * 0.42) : p.minDelay;
   const normMaxDelay = p.maxDelay > 4.2 ? Math.max(normMinDelay + 1.2, p.maxDelay * 0.5) : p.maxDelay;

   // Compute bot's speed factor relative to average human (0.78 for fast bots .. 1.12 for slower bots)
   let speedFactor = Math.min(1.15, Math.max(0.75, (normMinDelay + normMaxDelay) / 4.3));

   // Apply persistence behavioral modifiers in late game
   if (isLateGame && scoreDeficit > 20) {
      if (p.persistence === "never_gives_up") {
         effectiveAccuracy = Math.min(0.98, effectiveAccuracy + 0.08);
         speedFactor *= 0.86;
      } else if (p.persistence === "tilts_when_behind" && scoreDeficit > 35) {
         effectiveAccuracy = Math.max(0.42, effectiveAccuracy - 0.18);
         speedFactor *= 0.76; // Rushes frantically
      } else if (p.persistence === "gives_up_if_crushed" && scoreDeficit > 60) {
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
      speedFactor *= 0.92; // Extra urgency in Double Points round
   }

   // Subtle prompt length adjustment (kept tight so bots don't lag behind fast readers)
   const promptLen = question?.prompt?.length || 0;
   const promptOffset = promptLen > 95 ? 0.3 : promptLen > 60 ? 0.14 : 0;

   // Anchor distribution tiers to the topic's real human percentiles scaled by bot's speedFactor
   const fastFloor = Math.max(0.78, Math.min(normMinDelay, telemetry.p25Time * 0.72) * speedFactor);
   const p25Target = Math.max(fastFloor + 0.35, telemetry.p25Time * speedFactor + promptOffset * 0.5);
   const medianTarget = Math.max(p25Target + 0.45, telemetry.medianTime * speedFactor + promptOffset);
   const p75Target = Math.min(
      duration - 0.6,
      Math.max(medianTarget + 0.65, telemetry.p75Time * speedFactor + promptOffset * 1.2),
   );

   // Right-skewed human reaction sampling:
   // - 46% Fast Reflex Tier (fastFloor .. p25Target): ~0.85s - 1.65s -> Bot frequently beats user!
   // - 39% Typical Human Tier (p25Target .. medianTarget): ~1.55s - 2.45s -> Neck-and-neck race!
   // - 15% Deliberation Tier (medianTarget .. p75Target): ~2.45s - 3.90s -> Bot hesitates on tough question
   const tierRoll = Math.random();
   let rawTime: number;
   if (tierRoll < 0.46) {
      rawTime = fastFloor + Math.random() * (p25Target - fastFloor);
   } else if (tierRoll < 0.85) {
      rawTime = p25Target + Math.random() * (medianTarget - p25Target);
   } else {
      rawTime = medianTarget + Math.random() * (p75Target - medianTarget);
   }

   const time_taken = parseFloat(
      Math.min(duration - 0.3, Math.max(0.75, rawTime)).toFixed(2),
   );
   const correct = Math.random() < effectiveAccuracy;

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

   if (
      personality.persistence === "never_gives_up" &&
      !botWon &&
      isCloseGame &&
      personality.rematchPreference !== "declines_rematch"
   ) {
      probability = Math.min(0.85, probability + 0.15);
   }

   const finalProb = probability * fatigueFactor;
   const shouldRequest = Math.random() < finalProb;
   const delayMs = Math.round(1800 + Math.random() * 2400);

   return { shouldRequest, delayMs };
}

/**
 * Determines how a bot responds when the human player clicks "Request Rematch".
 * If the user initiates the rematch quickly (within 3 seconds of gameover),
 * the bot is still actively on the match screen and is heavily inclined to accept (~88% chance).
 */
export function evaluateBotResponseToUserRematch(
   personality: BotPersonality | null | undefined,
   botWon: boolean,
   isDraw: boolean,
   consecutiveRematches: number = 0,
   elapsedSinceGameOverSec: number = 5.0,
): { action: "accept" | "decline" | "ignore"; delayMs: number } {
   const pref = personality?.rematchPreference || "random";
   const isQuickRequest = elapsedSinceGameOverSec <= 3.0;
   const fatiguePenalty = consecutiveRematches * (isQuickRequest ? 0.14 : 0.22);

   let acceptProb = 0.5;
   if (isQuickRequest) {
      // User clicked Request Rematch within 3 seconds of gameover:
      // Bot is right there and strongly inclined to accept most of the time
      switch (pref) {
         case "likes_rematch":
            acceptProb = 0.94 - fatiguePenalty;
            break;
         case "sore_loser":
            acceptProb = (!botWon || isDraw ? 0.94 : 0.78) - fatiguePenalty;
            break;
         case "random":
            acceptProb = 0.86 - fatiguePenalty;
            break;
         case "declines_rematch":
            acceptProb = 0.72 - fatiguePenalty;
            break;
      }
   } else {
      switch (pref) {
         case "likes_rematch":
            acceptProb = 0.82 - fatiguePenalty;
            break;
         case "sore_loser":
            acceptProb = (!botWon || isDraw ? 0.85 : 0.28) - fatiguePenalty;
            break;
         case "random":
            acceptProb = 0.55 - fatiguePenalty;
            break;
         case "declines_rematch":
            acceptProb = 0.15 - fatiguePenalty;
            break;
      }
   }

   const delayMs = isQuickRequest
      ? Math.round(900 + Math.random() * 1400)
      : Math.round(1200 + Math.random() * 2200);

   if (Math.random() < Math.max(0.1, acceptProb)) {
      return { action: "accept", delayMs };
   }

   const action = Math.random() < 0.8 ? "decline" : "ignore";
   return { action, delayMs };
}
